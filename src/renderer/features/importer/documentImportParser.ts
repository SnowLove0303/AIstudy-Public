import JSZip from "jszip";
import { AISTUDY_CORE_CONTRACT } from "../../domain/coreContracts";
import type { KnowledgeDocumentSnapshot } from "../documents/knowledgeDocumentTypes";
import type { ImportBlock, ImportPackage, ImportPreview, ImportTargetContext } from "./importTypes";

const DOCUMENT_EDITOR_VERSION = "canvas-editor@0.9.135";
const MAX_IMPORT_CHARACTERS = 220_000;
const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "markdown", "docx"]);

type DocxParagraph = {
  text: string;
  style: string;
};

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function stripMarkdownPrefix(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)、]\s*/, "")
    .trim();
}

function isLikelyHeading(text: string) {
  if (!text) return false;
  if (/^第[一二三四五六七八九十百千万\d]+[章节条]/.test(text)) return true;
  if (/^[一二三四五六七八九十]+[、.．]\s*\S+/.test(text)) return true;
  return text.length <= 28 && !/[。；;：:，,]/.test(text);
}

function splitParagraph(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= 80 || /^[（(]?\d+[）).、]/.test(normalized)) return [normalized];

  const parts = normalized.match(/[^。；;]+[。；;]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [normalized];
  return parts.length > 1 ? parts : [normalized];
}

function pushTextBlock(blocks: ImportBlock[], text: string, forcedKind?: ImportBlock["kind"], level = 2) {
  const cleanText = stripMarkdownPrefix(text);
  if (!cleanText) return;
  const kind = forcedKind ?? (isLikelyHeading(cleanText) ? "heading" : "paragraph");
  if (kind === "heading") {
    blocks.push({
      id: `block-${blocks.length + 1}`,
      kind,
      text: cleanText,
      level
    });
    return;
  }

  for (const paragraph of splitParagraph(cleanText)) {
    blocks.push({
      id: `block-${blocks.length + 1}`,
      kind: "paragraph",
      text: paragraph
    });
  }
}

function parsePlainText(text: string) {
  const blocks: ImportBlock[] = [];
  const normalized = normalizeText(text);
  for (const line of normalized.split(/\n+/)) {
    pushTextBlock(blocks, line);
  }
  return blocks;
}

function parseMarkdown(text: string) {
  const blocks: ImportBlock[] = [];
  const normalized = normalizeText(text);
  for (const line of normalized.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pushTextBlock(blocks, headingMatch[2], "heading", headingMatch[1].length);
      continue;
    }
    pushTextBlock(blocks, trimmed);
  }
  return blocks;
}

function getDocxParagraphStyle(paragraph: Element) {
  const styleElement = Array.from(paragraph.getElementsByTagName("w:pStyle"))[0];
  return styleElement?.getAttribute("w:val") || styleElement?.getAttribute("val") || "";
}

function readDocxParagraphText(paragraph: Element) {
  const parts: string[] = [];
  for (const child of Array.from(paragraph.childNodes)) {
    if (!(child instanceof Element)) continue;
    if (child.tagName === "w:r") {
      const textNodes = Array.from(child.getElementsByTagName("w:t"));
      if (textNodes.length === 0 && child.getElementsByTagName("w:tab").length > 0) {
        parts.push(" ");
      }
      for (const textNode of textNodes) {
        parts.push(textNode.textContent ?? "");
      }
    }
    if (child.tagName === "w:hyperlink") {
      for (const textNode of Array.from(child.getElementsByTagName("w:t"))) {
        parts.push(textNode.textContent ?? "");
      }
    }
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

function parseDocxXml(xml: string) {
  const parser = new DOMParser();
  const documentXml = parser.parseFromString(xml, "application/xml");
  if (documentXml.querySelector("parsererror")) {
    throw new Error("DOCX_XML_PARSE_FAILED");
  }

  const paragraphs: DocxParagraph[] = [];
  for (const paragraph of Array.from(documentXml.getElementsByTagName("w:p"))) {
    const text = readDocxParagraphText(paragraph);
    if (!text) continue;
    paragraphs.push({
      text,
      style: getDocxParagraphStyle(paragraph)
    });
  }
  return paragraphs;
}

async function parseDocx(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("DOCX_DOCUMENT_XML_MISSING");
  }

  const paragraphs = parseDocxXml(await documentFile.async("text"));
  const blocks: ImportBlock[] = [];
  for (const paragraph of paragraphs) {
    const isHeading = /heading|title|subtitle/i.test(paragraph.style) || isLikelyHeading(paragraph.text);
    pushTextBlock(blocks, paragraph.text, isHeading ? "heading" : "paragraph", 2);
  }
  return blocks;
}

function ensureValidBlocks(blocks: ImportBlock[]) {
  const characterCount = blocks.reduce((total, block) => total + block.text.length, 0);
  if (blocks.length === 0 || characterCount === 0) {
    throw new Error("IMPORT_EMPTY");
  }
  if (characterCount > MAX_IMPORT_CHARACTERS) {
    throw new Error("IMPORT_TOO_LARGE");
  }
  return characterCount;
}

function blockToElements(block: ImportBlock, index: number) {
  const ending = index === 0 ? "\n" : "\n";
  if (block.kind === "heading") {
    return [
      {
        value: block.text,
        size: block.level === 1 ? 24 : 22,
        bold: true,
        color: "#2563eb"
      },
      { value: ending }
    ];
  }

  return [
    {
      value: block.text,
      size: 18,
      color: "#111827"
    },
    { value: ending }
  ];
}

function createSnapshot(blocks: ImportBlock[]): KnowledgeDocumentSnapshot {
  return {
    schemaVersion: AISTUDY_CORE_CONTRACT.schemaVersion,
    editor: AISTUDY_CORE_CONTRACT.editors.knowledgeDocument,
    editorVersion: DOCUMENT_EDITOR_VERSION,
    content: {
      main: blocks.flatMap(blockToElements)
    },
    updatedAt: new Date().toISOString()
  };
}

function createPackage(file: File, target: ImportTargetContext, blocks: ImportBlock[], characterCount: number): ImportPackage {
  const firstHeading = blocks.find((block) => block.kind === "heading")?.text;
  return {
    schemaVersion: 1,
    source: {
      kind: "file",
      fileName: file.name,
      fileType: getFileExtension(file.name),
      byteSize: file.size,
      importedAt: new Date().toISOString()
    },
    target: {
      kind: "current-node-document",
      courseId: target.courseId,
      mindMapId: target.mindMapId,
      nodeId: target.nodeId,
      title: target.title
    },
    blocks,
    summary: {
      title: firstHeading || target.title || file.name,
      blockCount: blocks.length,
      characterCount
    }
  };
}

export function isSupportedImportFile(file: File) {
  return SUPPORTED_EXTENSIONS.has(getFileExtension(file.name));
}

export async function createDocumentImportPreview(file: File, target: ImportTargetContext): Promise<ImportPreview> {
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("IMPORT_UNSUPPORTED_EXTENSION");
  }

  const blocks = extension === "docx"
    ? await parseDocx(file)
    : extension === "md" || extension === "markdown"
      ? parseMarkdown(await file.text())
      : parsePlainText(await file.text());
  const characterCount = ensureValidBlocks(blocks);

  return {
    package: createPackage(file, target, blocks, characterCount),
    snapshot: createSnapshot(blocks)
  };
}
