import * as electron from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  FileChild,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type IRunOptions
} from "docx";

type KnowledgeDocumentSnapshot = {
  schemaVersion: 1;
  editor: "aistudy-word";
  editorVersion: string;
  content: unknown;
  updatedAt: string;
};

type KnowledgeDocumentDocxExportRequest = {
  title?: unknown;
  snapshot?: unknown;
};

type KnowledgeDocumentDocxExportResult = {
  canceled: boolean;
  filePath: string;
};

type DocxTextStyle = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  size?: number;
  font?: string;
  highlight?: IRunOptions["highlight"];
  link?: string;
  subScript?: boolean;
  superScript?: boolean;
};

const { dialog } = electron;
type BrowserWindow = electron.BrowserWindow;

const DEFAULT_DOCX_TITLE = "AIstudy Document";
const DEFAULT_FONT = "Microsoft YaHei";
const DOCX_PAGE_WIDTH = 11906;
const DOCX_PAGE_HEIGHT = 16838;
const DOCX_TEXT_COLOR = "1F2937";
const DOCX_MUTED_COLOR = "64748B";
const DOCX_PRIMARY_COLOR = "2563EB";
const DOCX_TABLE_BORDER_COLOR = "CBD5E1";
const DOCX_TWIP_PER_PT = 20;
const DOCX_PX_TO_PT = 0.75;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeKnowledgeDocumentDocxFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || DEFAULT_DOCX_TITLE;
}

function normalizeDocxTitle(value: unknown) {
  return (typeof value === "string" && value.trim() ? value.trim() : DEFAULT_DOCX_TITLE).slice(0, 120);
}

function normalizeKnowledgeDocumentSnapshot(value: unknown): KnowledgeDocumentSnapshot {
  if (!isRecord(value)) {
    throw new Error("文档快照格式无效");
  }
  if (value.schemaVersion !== 1 || value.editor !== "aistudy-word") {
    throw new Error("文档快照协议不支持");
  }
  return {
    schemaVersion: 1,
    editor: "aistudy-word",
    editorVersion: typeof value.editorVersion === "string" ? value.editorVersion : "unknown",
    content: value.content ?? { main: [] },
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString()
  };
}

function normalizeHexColor(value: unknown, fallback = DOCX_TEXT_COLOR) {
  if (typeof value !== "string") return fallback;
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return hex.toUpperCase();
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb) return fallback;
  return rgb
    .slice(1, 4)
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function normalizeHighlight(value: unknown): IRunOptions["highlight"] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const color = normalizeHexColor(value, "");
  if (!color) return undefined;
  const known: Record<string, IRunOptions["highlight"]> = {
    FEF3C7: "yellow",
    FDE68A: "yellow",
    FEF08A: "yellow",
    DCFCE7: "green",
    DBEAFE: "cyan",
    EDE9FE: "magenta",
    FCE7F3: "magenta"
  };
  return known[color];
}

function toHalfPointSize(value: unknown, fallbackPt = 12) {
  const numeric = Number(value);
  const pointSize = Number.isFinite(numeric) && numeric > 0
    ? Math.max(8, Math.min(36, Math.round(numeric * DOCX_PX_TO_PT)))
    : fallbackPt;
  return pointSize * 2;
}

function detectHeadingLevel(text: string, element: Record<string, unknown>) {
  const level = typeof element.level === "string" ? element.level : "";
  if (level === "first") return 1;
  if (level === "second") return 2;
  if (level === "third") return 3;
  if (level === "fourth") return 4;
  if (/^[一二三四五六七八九十]+[、.．]\s*/.test(text.trim())) return 1;
  if (/^[（(][一二三四五六七八九十\d]+[）)]、?\s*/.test(text.trim())) return 2;
  if (/^\d+[.．]\s*\S/.test(text.trim())) return 3;
  return 0;
}

function readElementText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readElementText).join("");
  if (!isRecord(value)) return "";
  let text = typeof value.value === "string" ? value.value : "";
  for (const [key, child] of Object.entries(value)) {
    if (key === "value") continue;
    if (["content", "main", "header", "footer", "children", "items", "paragraphs", "rows", "cells", "trList", "tdList", "valueList", "listWrap"].includes(key) || Array.isArray(child)) {
      text += readElementText(child);
    }
  }
  return text;
}

function collectTextRuns(element: unknown, inherited: DocxTextStyle = {}): Array<{ text: string; style: DocxTextStyle }> {
  if (typeof element === "string") return [{ text: element, style: inherited }];
  if (Array.isArray(element)) return element.flatMap((item) => collectTextRuns(item, inherited));
  if (!isRecord(element)) return [];

  const nextStyle: DocxTextStyle = {
    ...inherited,
    bold: typeof element.bold === "boolean" ? element.bold : inherited.bold,
    italics: typeof element.italic === "boolean" ? element.italic : inherited.italics,
    underline: element.underline === true ? true : inherited.underline,
    strike: typeof element.strikeout === "boolean" ? element.strikeout : inherited.strike,
    color: element.color ? normalizeHexColor(element.color, inherited.color ?? DOCX_TEXT_COLOR) : inherited.color,
    size: element.size ? toHalfPointSize(element.size) : inherited.size,
    font: typeof element.font === "string" && element.font.trim() ? element.font.trim() : inherited.font,
    highlight: element.highlight ? normalizeHighlight(element.highlight) : inherited.highlight,
    link: typeof element.href === "string" ? element.href : typeof element.url === "string" ? element.url : inherited.link,
    subScript: element.type === "subscript" ? true : inherited.subScript,
    superScript: element.type === "superscript" ? true : inherited.superScript
  };

  const runs: Array<{ text: string; style: DocxTextStyle }> = [];
  if (typeof element.value === "string") {
    runs.push({ text: element.value, style: nextStyle });
  }
  for (const [key, child] of Object.entries(element)) {
    if (key === "value") continue;
    if (["valueList", "listWrap", "children", "items", "paragraphs"].includes(key) || Array.isArray(child)) {
      runs.push(...collectTextRuns(child, nextStyle));
    }
  }
  return runs;
}

function createTextRun(text: string, style: DocxTextStyle, headingLevel = 0) {
  return new TextRun({
    text,
    bold: headingLevel > 0 ? true : style.bold,
    italics: style.italics,
    underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
    strike: style.strike,
    color: headingLevel > 0 ? DOCX_PRIMARY_COLOR : style.color ?? DOCX_TEXT_COLOR,
    size: headingLevel === 1 ? 32 : headingLevel === 2 ? 28 : headingLevel === 3 ? 24 : style.size ?? 24,
    font: style.font || DEFAULT_FONT,
    highlight: style.highlight,
    subScript: style.subScript,
    superScript: style.superScript
  });
}

function createRunChildren(runs: Array<{ text: string; style: DocxTextStyle }>, headingLevel = 0) {
  const children: Array<TextRun | ExternalHyperlink> = [];
  for (const run of runs.length > 0 ? runs : [{ text: "", style: {} }]) {
    const parts = String(run.text ?? "").split(/(\n)/);
    for (const part of parts) {
      if (part === "") continue;
      if (part === "\n") {
        children.push(new TextRun({ break: 1 }));
        continue;
      }
      const textRun = createTextRun(part, run.style, headingLevel);
      if (run.style.link && /^https?:\/\//i.test(run.style.link)) {
        children.push(new ExternalHyperlink({ link: run.style.link, children: [textRun] }));
      } else {
        children.push(textRun);
      }
    }
  }
  return children;
}

function getAlignment(rowFlex: unknown) {
  if (rowFlex === "center") return AlignmentType.CENTER;
  if (rowFlex === "right") return AlignmentType.RIGHT;
  if (rowFlex === "alignment" || rowFlex === "justify") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function getParagraphSpacing(headingLevel: number) {
  if (headingLevel === 1) return { before: 360, after: 180 };
  if (headingLevel === 2) return { before: 280, after: 140 };
  if (headingLevel === 3) return { before: 220, after: 120 };
  return { before: 80, after: 120, line: 360 };
}

function createParagraphFromElement(element: unknown): Paragraph | null {
  if (!isRecord(element)) return null;
  const text = readElementText(element);
  const runs = collectTextRuns(element);
  const headingLevel = detectHeadingLevel(text, element);
  const cleanedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!cleanedText.trim()) {
    return new Paragraph({ spacing: { before: 40, after: 40 } });
  }

  const listType = typeof element.listType === "string" ? element.listType : "";
  const paragraphOptions = {
    children: createRunChildren(runs, headingLevel),
    heading: headingLevel === 1
      ? HeadingLevel.HEADING_1
      : headingLevel === 2
        ? HeadingLevel.HEADING_2
        : headingLevel === 3
          ? HeadingLevel.HEADING_3
          : undefined,
    alignment: getAlignment(element.rowFlex),
    spacing: getParagraphSpacing(headingLevel),
    indent: headingLevel > 0 ? undefined : { firstLine: listType ? undefined : 420 },
    numbering: listType === "ul"
      ? { reference: "aistudy-bullets", level: 0 }
      : listType === "ol"
        ? { reference: "aistudy-numbering", level: 0 }
        : undefined,
    keepNext: headingLevel > 0
  };
  return new Paragraph(paragraphOptions);
}

function getCellText(cell: unknown) {
  if (!isRecord(cell)) return "";
  return readElementText(cell.value ?? cell.valueList ?? cell.children ?? cell);
}

function createTableFromElement(element: Record<string, unknown>) {
  const rawRows = Array.isArray(element.trList) ? element.trList : [];
  const rows = rawRows.map((row) => {
    const rawCells = isRecord(row) && Array.isArray(row.tdList) ? row.tdList : [];
    return new TableRow({
      cantSplit: true,
      children: rawCells.map((cell, index) => new TableCell({
        shading: index === 0 ? { type: ShadingType.CLEAR, fill: "F8FAFC", color: "auto" } : undefined,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: getCellText(cell) || " ", font: DEFAULT_FONT, size: 22, color: DOCX_TEXT_COLOR })],
            spacing: { before: 0, after: 0, line: 300 }
          })
        ]
      }))
    });
  });
  if (rows.length === 0) return null;
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_BORDER_COLOR },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: DOCX_TABLE_BORDER_COLOR }
    },
    margins: { top: 120, bottom: 120, left: 120, right: 120 }
  });
}

function parseDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+)(?:;[^,]+)*;base64,([\s\S]+)$/i);
  if (!match) return null;
  return { mimeType: match[1], data: Buffer.from(match[2], "base64") };
}

function createImageFromElement(element: Record<string, unknown>) {
  const image = parseDataUrl(element.value ?? element.url ?? element.src);
  if (!image) return null;
  const width = Math.max(120, Math.min(520, Number(element.width) || 420));
  const height = Math.max(80, Math.min(720, Number(element.height) || Math.round(width * 0.62)));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 160 },
    children: [
      new ImageRun({
        data: image.data,
        type: image.mimeType.includes("png") ? "png" : image.mimeType.includes("gif") ? "gif" : "jpg",
        transformation: { width, height }
      })
    ]
  });
}

function buildDocxChildren(snapshot: KnowledgeDocumentSnapshot): FileChild[] {
  const content = isRecord(snapshot.content) ? snapshot.content : {};
  const main = Array.isArray(content.main) ? content.main : [];
  const children: FileChild[] = [];
  for (const element of main) {
    if (isRecord(element) && element.type === "pageBreak") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      continue;
    }
    if (isRecord(element) && Array.isArray(element.trList)) {
      const table = createTableFromElement(element);
      if (table) children.push(table);
      continue;
    }
    if (isRecord(element)) {
      const image = createImageFromElement(element);
      if (image) {
        children.push(image);
        continue;
      }
    }
    const paragraph = createParagraphFromElement(element);
    if (paragraph) children.push(paragraph);
  }
  return children.length > 0 ? children : [new Paragraph({ text: "" })];
}

function createDocxDocument(title: string, snapshot: KnowledgeDocumentSnapshot) {
  const header = new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: title, bold: true, color: DOCX_MUTED_COLOR, size: 18, font: DEFAULT_FONT })
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 80 }
      })
    ]
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "AIstudy", color: DOCX_MUTED_COLOR, size: 18, font: DEFAULT_FONT }),
          new TextRun({ text: "  ·  第 ", color: DOCX_MUTED_COLOR, size: 18, font: DEFAULT_FONT }),
          new TextRun({ children: [PageNumber.CURRENT], color: DOCX_MUTED_COLOR, size: 18, font: DEFAULT_FONT }),
          new TextRun({ text: " 页", color: DOCX_MUTED_COLOR, size: 18, font: DEFAULT_FONT })
        ],
        alignment: AlignmentType.CENTER
      })
    ]
  });
  return new DocxDocument({
    title,
    creator: "AIstudy",
    description: "Exported from AIstudy knowledge document.",
    styles: {
      default: {
        document: {
          run: { font: DEFAULT_FONT, size: 24, color: DOCX_TEXT_COLOR },
          paragraph: { spacing: { line: 360, after: 120 } }
        },
        heading1: {
          run: { font: DEFAULT_FONT, size: 32, bold: true, color: DOCX_PRIMARY_COLOR },
          paragraph: { spacing: { before: 360, after: 180 }, keepNext: true }
        },
        heading2: {
          run: { font: DEFAULT_FONT, size: 28, bold: true, color: DOCX_PRIMARY_COLOR },
          paragraph: { spacing: { before: 280, after: 140 }, keepNext: true }
        },
        heading3: {
          run: { font: DEFAULT_FONT, size: 24, bold: true, color: DOCX_TEXT_COLOR },
          paragraph: { spacing: { before: 220, after: 120 }, keepNext: true }
        }
      }
    },
    numbering: {
      config: [
        {
          reference: "aistudy-bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "·", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
        },
        {
          reference: "aistudy-numbering",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
        }
      ]
    },
    sections: [
      {
        headers: { default: header },
        footers: { default: footer },
        properties: {
          page: {
            size: { width: DOCX_PAGE_WIDTH, height: DOCX_PAGE_HEIGHT },
            margin: { top: 1440, right: 1260, bottom: 1260, left: 1260, header: 720, footer: 720 }
          }
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, color: DOCX_PRIMARY_COLOR, size: 36, font: DEFAULT_FONT })],
            heading: HeadingLevel.TITLE,
            spacing: { before: 120, after: 300 }
          }),
          ...buildDocxChildren(snapshot)
        ]
      }
    ]
  });
}

export async function exportKnowledgeDocumentDocx(
  parentWindow: BrowserWindow | null,
  input: unknown
): Promise<KnowledgeDocumentDocxExportResult> {
  const request = isRecord(input) ? input as KnowledgeDocumentDocxExportRequest : {};
  const title = normalizeDocxTitle(request.title);
  const snapshot = normalizeKnowledgeDocumentSnapshot(request.snapshot);
  const defaultPath = path.join(process.env.USERPROFILE || process.cwd(), "Desktop", `${sanitizeKnowledgeDocumentDocxFileName(title)}.docx`);
  const options = {
    title: "导出 Word 文档",
    defaultPath,
    filters: [{ name: "Word 文档", extensions: ["docx"] }]
  };
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) {
    return { canceled: true, filePath: "" };
  }

  const buffer = await createKnowledgeDocumentDocxBuffer({ title, snapshot });
  await fs.writeFile(result.filePath, buffer);
  return { canceled: false, filePath: result.filePath };
}

export async function createKnowledgeDocumentDocxBuffer(input: unknown): Promise<Buffer> {
  const request = isRecord(input) ? input as KnowledgeDocumentDocxExportRequest : {};
  const title = normalizeDocxTitle(request.title);
  const snapshot = normalizeKnowledgeDocumentSnapshot(request.snapshot);
  const document = createDocxDocument(title, snapshot);
  return Packer.toBuffer(document);
}
