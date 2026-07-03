export const DOCUMENT_URL_LINK_COLOR = "#2563eb";

type DocumentElement = {
  value?: unknown;
  href?: unknown;
  url?: unknown;
  hyperlinkId?: unknown;
  valueList?: unknown;
  trList?: unknown;
  [key: string]: unknown;
};

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]+/gi;
const TRAILING_URL_PUNCTUATION_PATTERN = /[.,;:!?，。；：！？、)\]}>）】》]+$/u;

function isObject(value: unknown): value is DocumentElement {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function normalizeDocumentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = trimmed.toLowerCase().startsWith("www.") ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function splitTrailingPunctuation(value: string) {
  const trailing = value.match(TRAILING_URL_PUNCTUATION_PATTERN)?.[0] ?? "";
  if (!trailing) return { urlText: value, trailing };
  return {
    urlText: value.slice(0, -trailing.length),
    trailing
  };
}

function createLinkedElement(source: DocumentElement, value: string, url: string) {
  return {
    ...source,
    value,
    color: DOCUMENT_URL_LINK_COLOR,
    underline: true,
    href: url,
    url
  };
}

function createPlainElement(source: DocumentElement, value: string) {
  const next: DocumentElement = { ...source, value };
  delete next.href;
  delete next.url;
  delete next.hyperlinkId;
  return next;
}

export function splitDocumentElementUrlLinks(element: DocumentElement): { elements: DocumentElement[]; changed: boolean } {
  const rawValue = toText(element.value);
  if (!rawValue) return { elements: [element], changed: false };

  const existingUrl = normalizeDocumentUrl(element.url ?? element.href);
  if (existingUrl) {
    const needsStyle = element.color !== DOCUMENT_URL_LINK_COLOR || element.underline !== true || element.url !== existingUrl || element.href !== existingUrl;
    return {
      elements: needsStyle ? [createLinkedElement(element, rawValue, existingUrl)] : [element],
      changed: needsStyle
    };
  }

  const parts: DocumentElement[] = [];
  let changed = false;
  let cursor = 0;
  URL_PATTERN.lastIndex = 0;

  for (const match of rawValue.matchAll(URL_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const matchedValue = match[0];
    const { urlText, trailing } = splitTrailingPunctuation(matchedValue);
    const normalizedUrl = normalizeDocumentUrl(urlText);
    if (!normalizedUrl) continue;

    if (matchIndex > cursor) {
      parts.push(createPlainElement(element, rawValue.slice(cursor, matchIndex)));
    }

    parts.push(createLinkedElement(element, urlText, normalizedUrl));
    if (trailing) {
      parts.push(createPlainElement(element, trailing));
    }

    cursor = matchIndex + matchedValue.length;
    changed = true;
  }

  if (!changed) return { elements: [element], changed: false };
  if (cursor < rawValue.length) {
    parts.push(createPlainElement(element, rawValue.slice(cursor)));
  }

  return { elements: parts.filter((part) => toText(part.value).length > 0), changed: true };
}

export function normalizeDocumentUrlLinksInElementList<T extends object>(elements: T[]): { elements: T[]; changed: boolean } {
  let changed = false;
  const nextElements: DocumentElement[] = [];

  for (const element of elements) {
    let nextElement = element as DocumentElement;

    if (Array.isArray(nextElement.valueList)) {
      const normalizedValueList = normalizeDocumentUrlLinksInElementList(nextElement.valueList.filter(isObject));
      if (normalizedValueList.changed) {
        nextElement = {
          ...nextElement,
          valueList: normalizedValueList.elements
        };
        changed = true;
      }
    }

    if (Array.isArray(nextElement.trList)) {
      const nextTrList = nextElement.trList.map((row: unknown) => {
        if (!isObject(row) || !Array.isArray(row.tdList)) return row;
        let rowChanged = false;
        const nextTdList = row.tdList.map((cell) => {
          if (!isObject(cell) || !Array.isArray(cell.value)) return cell;
          const normalizedCellValue = normalizeDocumentUrlLinksInElementList(cell.value.filter(isObject));
          if (!normalizedCellValue.changed) return cell;
          rowChanged = true;
          return {
            ...cell,
            value: normalizedCellValue.elements
          };
        });
        if (!rowChanged) return row;
        changed = true;
        return {
          ...row,
          tdList: nextTdList
        };
      });
      if (nextTrList !== nextElement.trList) {
        nextElement = {
          ...nextElement,
          trList: nextTrList
        };
      }
    }

    const split = splitDocumentElementUrlLinks(nextElement);
    if (split.changed) {
      changed = true;
    }
    nextElements.push(...split.elements);
  }

  return {
    elements: nextElements as T[],
    changed
  };
}

export function normalizeDocumentUrlLinksInContent<TElement extends object, T extends { header?: TElement[]; main: TElement[]; footer?: TElement[] }>(
  content: T
): { content: T; changed: boolean } {
  let changed = false;
  const nextContent = { ...content };

  if (Array.isArray(content.header)) {
    const normalizedHeader = normalizeDocumentUrlLinksInElementList(content.header);
    if (normalizedHeader.changed) {
      nextContent.header = normalizedHeader.elements;
      changed = true;
    }
  }

  const normalizedMain = normalizeDocumentUrlLinksInElementList(content.main);
  if (normalizedMain.changed) {
    nextContent.main = normalizedMain.elements;
    changed = true;
  }

  if (Array.isArray(content.footer)) {
    const normalizedFooter = normalizeDocumentUrlLinksInElementList(content.footer);
    if (normalizedFooter.changed) {
      nextContent.footer = normalizedFooter.elements;
      changed = true;
    }
  }

  return {
    content: changed ? nextContent : content,
    changed
  };
}
