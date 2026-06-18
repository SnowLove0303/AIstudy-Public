import type { IEditorData, IElement, IRangeStyle } from "@hufe921/canvas-editor";
import type {
  KnowledgeDocumentContent,
  KnowledgeDocumentEditorHandle,
  KnowledgeDocumentFormatState,
  KnowledgeDocumentSnapshot
} from "./knowledgeDocumentTypes";
import { AISTUDY_CORE_CONTRACT } from "../../domain/coreContracts";

const DOCUMENT_EDITOR_VERSION = "canvas-editor@0.9.135";
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_COLOR = "#1f2937";
const DOCUMENT_EDITOR = AISTUDY_CORE_CONTRACT.editors.knowledgeDocument;
const LANDSCAPE_PAGE_RATIO = 794 / 1123;
const DOCUMENT_PAGE_GUTTER = 32;
const MIN_LANDSCAPE_PAGE_WIDTH = 960;
const ZERO_WIDTH_BREAK = "\u200B";

type CanvasEditorModule = typeof import("@hufe921/canvas-editor");
type CanvasEditorInstance = InstanceType<CanvasEditorModule["default"]>;
type CanvasRange = ReturnType<CanvasEditorInstance["command"]["getRange"]>;
type InlineStyleKey = "font" | "size" | "bold" | "color" | "highlight" | "italic" | "underline" | "strikeout" | "textDecoration";

type CanvasDocumentEvents = {
  onSnapshotChanged?: (snapshot: KnowledgeDocumentSnapshot) => void;
  onFormatChanged?: (state: KnowledgeDocumentFormatState) => void;
  onAskAi?: (selectedText: string) => void;
};

let canvasEditorModulePromise: Promise<CanvasEditorModule> | null = null;

const INLINE_STYLE_KEYS: InlineStyleKey[] = [
  "font",
  "size",
  "bold",
  "color",
  "highlight",
  "italic",
  "underline",
  "strikeout",
  "textDecoration"
];

function loadCanvasEditor() {
  if (canvasEditorModulePromise) return canvasEditorModulePromise;

  canvasEditorModulePromise = (import.meta.env.DEV
    ? import("@hufe921/canvas-editor")
    : (() => {
        const moduleUrl = import.meta.url;
        const assetsIndex = moduleUrl.lastIndexOf("/assets/");
        const vendorUrl = assetsIndex >= 0 ? `${moduleUrl.slice(0, assetsIndex)}/vendor/canvas-editor.js` : "./vendor/canvas-editor.js";
        return import(/* @vite-ignore */ vendorUrl) as Promise<CanvasEditorModule>;
      })()
  ).catch((error) => {
    canvasEditorModulePromise = null;
    throw error;
  });

  return canvasEditorModulePromise;
}

export async function preloadCanvasDocumentEditor() {
  await loadCanvasEditor();
}

function normalizeElementList(value: unknown): IElement[] {
  if (!Array.isArray(value)) return [{ value: "" } as IElement];
  const list = value.filter((item): item is IElement => Boolean(item && typeof item === "object"));
  return list.length > 0 ? list : [{ value: "" } as IElement];
}

function normalizeEditorData(content: KnowledgeDocumentContent | null | undefined): IEditorData {
  return {
    header: Array.isArray(content?.header) ? (content?.header as IElement[]) : undefined,
    main: normalizeElementList(content?.main),
    footer: Array.isArray(content?.footer) ? (content?.footer as IElement[]) : undefined,
    graffiti: Array.isArray(content?.graffiti) ? (content?.graffiti as IEditorData["graffiti"]) : undefined
  };
}

function hasExplicitInlineStyle(element: IElement) {
  return INLINE_STYLE_KEYS.some((key) => element[key] !== undefined && element[key] !== null);
}

function copyInlineStyle(target: IElement, source: IElement): IElement {
  const next = { ...target };
  for (const key of INLINE_STYLE_KEYS) {
    if (source[key] !== undefined && source[key] !== null) {
      next[key] = source[key] as never;
    }
  }
  return next;
}

function isParagraphBoundary(element: IElement) {
  return element.type === "pageBreak" || element.value.includes("\n") || element.value.includes(ZERO_WIDTH_BREAK);
}

function isTextElement(element: IElement) {
  return !element.type || element.type === "text";
}

function hasVisibleText(element: IElement) {
  return isTextElement(element) && element.value.replace(/\s/g, "").length > 0;
}

function findParagraphBounds(elementList: IElement[], index: number) {
  let start = 0;
  let end = elementList.length - 1;

  for (let i = Math.min(index, elementList.length - 1); i >= 0; i -= 1) {
    if (isParagraphBoundary(elementList[i])) {
      start = i + 1;
      break;
    }
  }

  for (let i = Math.max(index, 0); i < elementList.length; i += 1) {
    if (isParagraphBoundary(elementList[i])) {
      end = i - 1;
      break;
    }
  }

  return { start, end };
}

function inheritLeadingTextStyle(elementList: IElement[], range: CanvasRange) {
  if (range.startIndex !== range.endIndex || elementList.length === 0) {
    return { elementList, changed: false };
  }

  const cursorIndex = Math.min(Math.max(range.startIndex, 0), elementList.length - 1);
  const { start, end } = findParagraphBounds(elementList, cursorIndex);
  if (start > end) {
    return { elementList, changed: false };
  }

  let firstStyledIndex = -1;
  for (let i = start; i <= end; i += 1) {
    const element = elementList[i];
    if (!hasVisibleText(element)) continue;
    if (hasExplicitInlineStyle(element)) {
      firstStyledIndex = i;
      break;
    }
  }

  if (firstStyledIndex <= start || cursorIndex > firstStyledIndex) {
    return { elementList, changed: false };
  }

  const leadingIndexes: number[] = [];
  for (let i = start; i < firstStyledIndex; i += 1) {
    const element = elementList[i];
    if (!hasVisibleText(element)) continue;
    if (hasExplicitInlineStyle(element)) {
      return { elementList, changed: false };
    }
    leadingIndexes.push(i);
  }

  if (leadingIndexes.length === 0) {
    return { elementList, changed: false };
  }

  const styleSource = elementList[firstStyledIndex];
  const next = elementList.slice();
  for (const index of leadingIndexes) {
    next[index] = copyInlineStyle(next[index], styleSource);
  }

  return { elementList: next, changed: true };
}

function inheritDocumentInputStyle(content: IEditorData, range: CanvasRange) {
  if (range.isCrossRowCol || range.tableId || (range.zone && range.zone !== "main")) {
    return { content, changed: false };
  }

  const normalizedMain = inheritLeadingTextStyle(content.main, range);
  if (!normalizedMain.changed) {
    return { content, changed: false };
  }

  return {
    content: {
      ...content,
      main: normalizedMain.elementList
    },
    changed: true
  };
}

function normalizeSnapshot(value: unknown): KnowledgeDocumentSnapshot {
  if (value && typeof value === "object") {
    const candidate = value as Partial<KnowledgeDocumentSnapshot>;
    return {
      schemaVersion: AISTUDY_CORE_CONTRACT.schemaVersion,
      editor: DOCUMENT_EDITOR,
      editorVersion: typeof candidate.editorVersion === "string" ? candidate.editorVersion : DOCUMENT_EDITOR_VERSION,
      content: normalizeEditorData(candidate.content as KnowledgeDocumentContent | undefined) as KnowledgeDocumentContent,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString()
    };
  }

  return createEmptyKnowledgeDocumentSnapshot();
}

export function createEmptyKnowledgeDocumentSnapshot(): KnowledgeDocumentSnapshot {
  return {
    schemaVersion: AISTUDY_CORE_CONTRACT.schemaVersion,
    editor: DOCUMENT_EDITOR,
    editorVersion: DOCUMENT_EDITOR_VERSION,
    content: {
      main: [{ value: "" }]
    },
    updatedAt: new Date().toISOString()
  };
}

function toSnapshot(editor: CanvasEditorInstance): KnowledgeDocumentSnapshot {
  const value = editor.command.getValue();
  return {
    schemaVersion: AISTUDY_CORE_CONTRACT.schemaVersion,
    editor: DOCUMENT_EDITOR,
    editorVersion: DOCUMENT_EDITOR_VERSION,
    content: normalizeEditorData(value.data) as KnowledgeDocumentContent,
    updatedAt: new Date().toISOString()
  };
}

function toFormatState(payload: IRangeStyle): KnowledgeDocumentFormatState {
  return {
    fontSize: Number.isFinite(payload.size) ? payload.size : DEFAULT_FONT_SIZE,
    color: payload.color || DEFAULT_COLOR,
    bold: Boolean(payload.bold),
    italic: Boolean(payload.italic),
    underline: Boolean(payload.underline)
  };
}

function toFormatStateFromElement(element: IElement | IRangeStyle | null | undefined, fallback: KnowledgeDocumentFormatState): KnowledgeDocumentFormatState {
  return {
    fontSize: Number.isFinite(element?.size) ? Number(element?.size) : fallback.fontSize,
    color: element?.color || fallback.color,
    bold: element?.bold ?? fallback.bold,
    italic: element?.italic ?? fallback.italic,
    underline: element?.underline ?? fallback.underline
  };
}

function applyFormatToElement(element: IElement, format: KnowledgeDocumentFormatState): IElement {
  return {
    ...element,
    size: format.fontSize,
    color: format.color,
    bold: format.bold,
    italic: format.italic,
    underline: format.underline
  };
}

function readEditorRangeText(editor: CanvasEditorInstance) {
  try {
    return editor.command.getRangeText().trim();
  } catch {
    return "";
  }
}

function getLandscapePageSize(container: HTMLDivElement) {
  const availableWidth = container.parentElement?.clientWidth ?? container.clientWidth;
  const width = Math.max(MIN_LANDSCAPE_PAGE_WIDTH, Math.floor(availableWidth - DOCUMENT_PAGE_GUTTER));
  return {
    width,
    height: Math.round(width * LANDSCAPE_PAGE_RATIO)
  };
}

export async function createCanvasDocumentEditor(
  container: HTMLDivElement,
  snapshot: KnowledgeDocumentSnapshot,
  events: CanvasDocumentEvents
): Promise<KnowledgeDocumentEditorHandle> {
  const { default: Editor, EditorMode, PageMode, PaperDirection, RenderMode } = await loadCanvasEditor();
  const pageSize = getLandscapePageSize(container);
  const editor = new Editor(container, normalizeEditorData(normalizeSnapshot(snapshot).content), {
    mode: EditorMode.EDIT,
    pageMode: PageMode.CONTINUITY,
    paperDirection: PaperDirection.HORIZONTAL,
    renderMode: RenderMode.SPEED,
    defaultFont: "Microsoft YaHei",
    defaultSize: DEFAULT_FONT_SIZE,
    defaultColor: DEFAULT_COLOR,
    minSize: 10,
    maxSize: 72,
    historyMaxRecordCount: 60,
    pageGap: 16,
    width: pageSize.height,
    height: pageSize.width,
    margins: [64, 64, 64, 64]
  });

  let lastSelectedText = "";
  let isNormalizingInputStyle = false;
  let lastRange: CanvasRange | null = null;
  let lastFormatState: KnowledgeDocumentFormatState = {
    fontSize: DEFAULT_FONT_SIZE,
    color: DEFAULT_COLOR,
    bold: false,
    italic: false,
    underline: false
  };
  const isSelectedRange = (range: CanvasRange | null) => {
    return Boolean(range && (range.startIndex !== range.endIndex || range.isCrossRowCol || range.tableId));
  };
  const rememberRange = () => {
    try {
      const range = editor.command.getRange();
      if (isSelectedRange(range)) {
        lastRange = range;
      }
      return range;
    } catch {
      return lastRange;
    }
  };
  const readCurrentSelectionElementList = () => {
    try {
      return editor.command.getRangeContext()?.selectionElementList ?? [];
    } catch {
      return [];
    }
  };
  const rememberSelectedText = () => {
    const selectedText = readEditorRangeText(editor);
    if (selectedText) {
      lastSelectedText = selectedText;
    }
    return selectedText;
  };

  editor.listener.contentChange = () => {
    if (isNormalizingInputStyle) {
      events.onSnapshotChanged?.(toSnapshot(editor));
      return;
    }

    const range = editor.command.getRange();
    const currentValue = editor.command.getValue();
    const normalizedInputStyle = inheritDocumentInputStyle(normalizeEditorData(currentValue.data), range);

    if (normalizedInputStyle.changed) {
      isNormalizingInputStyle = true;
      try {
        editor.command.executeSetValue(normalizedInputStyle.content, { isSetCursor: false });
        editor.command.executeSetRange(
          range.startIndex,
          range.endIndex,
          range.tableId,
          range.startTdIndex,
          range.endTdIndex,
          range.startTrIndex,
          range.endTrIndex
        );
      } finally {
        isNormalizingInputStyle = false;
      }
    }

    events.onSnapshotChanged?.(toSnapshot(editor));
  };
  editor.listener.rangeStyleChange = (payload) => {
    lastFormatState = toFormatState(payload);
    events.onFormatChanged?.(lastFormatState);
    rememberRange();
    rememberSelectedText();
  };
  editor.register.contextMenuList([
    {
      key: "aistudy-ask-ai",
      name: "问 AI",
      when: (context) => context.editorHasSelection,
      callback: () => {
        events.onAskAi?.(rememberSelectedText() || lastSelectedText);
      }
    }
  ]);

  return {
    getSnapshot: () => toSnapshot(editor),
    getSelectedText: () => rememberSelectedText() || lastSelectedText,
    hasSelection: () => {
      rememberRange();
      return Boolean(readEditorRangeText(editor) || readCurrentSelectionElementList().length > 0);
    },
    exec: (command) => {
      if (command === "undo") editor.command.executeUndo();
      if (command === "redo") editor.command.executeRedo();
      if (command === "bold") editor.command.executeBold();
      if (command === "italic") editor.command.executeItalic();
      if (command === "underline") editor.command.executeUnderline();
      if (command === "save") events.onSnapshotChanged?.(toSnapshot(editor));
    },
    setFontSize: (size) => {
      editor.command.executeSize(size);
    },
    setColor: (color) => {
      editor.command.executeColor(color);
    },
    captureFormat: () => {
      rememberRange();
      const selectedElements = readCurrentSelectionElementList();
      const sourceElement = selectedElements.find(hasVisibleText) ?? selectedElements[0] ?? null;
      if (!sourceElement && selectedElements.length === 0) return null;
      return toFormatStateFromElement(sourceElement, lastFormatState);
    },
    applyFormat: (format) => {
      rememberRange();
      const selectedElements = readCurrentSelectionElementList();
      if (selectedElements.length === 0) return false;

      editor.command.executeInsertElementList(
        selectedElements.map((element) => applyFormatToElement(element, format)),
        { isReplace: true }
      );
      rememberRange();
      events.onSnapshotChanged?.(toSnapshot(editor));
      return true;
    },
    focus: () => {
      editor.command.executeFocus();
    },
    destroy: () => {
      try {
        editor.destroy();
      } catch {
        // canvas-editor removes its own container during destroy. During rapid
        // mode/node switches that container may already be detached by React.
      }
    }
  };
}
