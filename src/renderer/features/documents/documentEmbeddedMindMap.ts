export type EmbeddedMindMapChild = {
  id: string;
  title: string;
};

export type EmbeddedMindMapGroup = {
  id: string;
  title: string;
  children: EmbeddedMindMapChild[];
};

export type EmbeddedMindMapData = {
  version: 1;
  root: string;
  groups: EmbeddedMindMapGroup[];
};

export const DOCUMENT_MIND_MAP_BLOCK_KIND = "mindmap";
export const DOCUMENT_MIND_MAP_MESSAGE_SOURCE = "aistudy-document-mindmap";

const MAX_GROUPS = 12;
const MAX_CHILDREN_PER_GROUP = 16;
const MAX_LABEL_LENGTH = 42;

function createId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12) || Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}

function cleanLabel(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, MAX_LABEL_LENGTH);
}

function stripTreeDecorations(value: string) {
  return value
    .replace(/[├└│]/g, " ")
    .replace(/[─]+/g, " ")
    .replace(/^[\s+`|\\-]+/, "")
    .replace(/^[•·●]\s*/, "")
    .replace(/^\d+[.、]\s*/, "")
    .replace(/^【\s*/, "")
    .replace(/\s*】$/, "")
    .trim();
}

function readLineDepth(value: string) {
  const source = value.replace(/\t/g, "    ");
  const prefix = source.match(/^[\s│]*/)?.[0] ?? "";
  const barDepth = (prefix.match(/[│]/g) || []).length;
  const spaceDepth = Math.floor(prefix.replace(/[│]/g, "").length / 3);
  const treeDepth = /^[\s│]*[├└]/.test(source) ? 1 : 0;
  return Math.max(treeDepth, barDepth + spaceDepth);
}

export function normalizeEmbeddedMindMapData(value: unknown): EmbeddedMindMapData {
  const source = value && typeof value === "object" ? (value as Partial<EmbeddedMindMapData>) : {};
  const groups = Array.isArray(source.groups) ? source.groups : [];
  const normalizedGroups = groups.slice(0, MAX_GROUPS).map((group, groupIndex) => {
    const children = Array.isArray(group?.children) ? group.children : [];
    return {
      id: cleanLabel(group?.id, createId("group")),
      title: cleanLabel(group?.title, `分支 ${groupIndex + 1}`),
      children: children.slice(0, MAX_CHILDREN_PER_GROUP).map((child, childIndex) => ({
        id: cleanLabel(child?.id, createId("node")),
        title: cleanLabel(child?.title, `节点 ${childIndex + 1}`)
      }))
    };
  });
  return {
    version: 1,
    root: cleanLabel(source.root, "导图"),
    groups: normalizedGroups.length > 0 ? normalizedGroups : [{ id: createId("group"), title: "分支", children: [{ id: createId("node"), title: "节点" }] }]
  };
}

export function parseEmbeddedMindMapText(source: string): EmbeddedMindMapData {
  const parsed = source
    .split(/\r?\n/)
    .map((raw) => ({ depth: readLineDepth(raw), title: stripTreeDecorations(raw) }))
    .filter((item) => item.title);

  if (parsed.length < 2) {
    throw new Error("请先选中层级文本");
  }

  const firstDepth = parsed[0].depth;
  const groups: EmbeddedMindMapGroup[] = [];
  let current: EmbeddedMindMapGroup | null = null;

  parsed.slice(1).forEach((item) => {
    const relativeDepth = Math.max(0, item.depth - firstDepth);
    if (relativeDepth <= 0 || !current) {
      current = { id: createId("group"), title: cleanLabel(item.title, "分支"), children: [] };
      groups.push(current);
      return;
    }
    current.children.push({ id: createId("node"), title: cleanLabel(item.title, "节点") });
  });

  groups.forEach((group) => {
    if (group.children.length === 0) group.children.push({ id: createId("node"), title: "节点" });
  });

  return normalizeEmbeddedMindMapData({
    version: 1,
    root: parsed[0].title,
    groups
  });
}

export function createMindMapOutlineElements(input: EmbeddedMindMapData) {
  const data = normalizeEmbeddedMindMapData(input);
  const elements: Array<{ value: string; size?: number; bold?: boolean; color?: string }> = [
    { value: `${data.root}\n`, size: 16, bold: true, color: "#2563eb" }
  ];

  data.groups.forEach((group) => {
    const groupHasSameTitleAsRoot = group.title === data.root;
    if (!groupHasSameTitleAsRoot) {
      elements.push({ value: `  ${group.title}\n`, size: 15, bold: true, color: "#2563eb" });
    }
    group.children.forEach((child) => {
      elements.push({ value: `    • ${child.title}\n`, size: 14, color: "#172033" });
    });
  });

  elements.push({ value: "\n" });
  return elements;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function getEmbeddedMindMapHeight(data: EmbeddedMindMapData) {
  const normalized = normalizeEmbeddedMindMapData(data);
  const wrappedChildRows = normalized.groups.reduce((total, group) => total + Math.max(1, Math.ceil(group.children.length / 4)), 0);
  return Math.max(240, Math.min(760, 110 + normalized.groups.length * 58 + wrappedChildRows * 22));
}

export function createEmbeddedMindMapSrcDoc(blockId: string, input: EmbeddedMindMapData) {
  const data = normalizeEmbeddedMindMapData(input);
  const groupHtml = data.groups
    .map(
      (group) => `
        <section class="group" data-group-id="${escapeHtml(group.id)}">
          <div class="group-title" contenteditable="true" spellcheck="false">${escapeHtml(group.title)}</div>
          <button class="icon remove-group" type="button" title="删除分支">×</button>
          <div class="children">
            ${group.children
              .map(
                (child) => `
                  <div class="child" data-child-id="${escapeHtml(child.id)}">
                    <span contenteditable="true" spellcheck="false">${escapeHtml(child.title)}</span>
                    <button class="icon remove-child" type="button" title="删除节点">×</button>
                  </div>
                `
              )
              .join("")}
            <button class="add-child" type="button" title="添加节点">+</button>
          </div>
        </section>
      `
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  *{box-sizing:border-box}
  body{margin:0;background:transparent;color:#172033;font-family:"Microsoft YaHei",Arial,sans-serif;font-size:14px;overflow:hidden}
  .map{width:100%;padding:18px 24px 22px;display:grid;grid-template-columns:112px 56px minmax(0,1fr);align-items:start}
  .root{grid-column:1;justify-self:end;margin-top:4px;min-width:96px;max-width:112px;padding:10px 14px;border-radius:9px;background:#2563eb;color:#fff;text-align:center;font-size:18px;font-weight:700;line-height:1.25;outline:none;box-shadow:0 8px 18px rgba(37,99,235,.14)}
  .spine{grid-column:2;position:relative;align-self:stretch;min-height:120px}
  .spine:before{content:"";position:absolute;left:0;right:8px;top:24px;height:2px;background:#2563eb}
  .spine:after{content:"";position:absolute;right:8px;top:24px;bottom:24px;width:2px;background:#2563eb;border-radius:999px}
  .groups{grid-column:3;display:flex;flex-direction:column;gap:14px;min-width:0}
  .group{position:relative;display:grid;grid-template-columns:126px minmax(0,1fr);align-items:start;gap:18px;min-height:42px}
  .group:before{content:"";position:absolute;left:-48px;top:21px;width:48px;height:2px;background:#2563eb}
  .group-title{min-width:106px;padding:7px 12px;border:1px solid #93c5fd;background:#eff6ff;border-radius:8px;text-align:center;font-weight:700;line-height:1.35;outline:none;box-shadow:0 2px 8px rgba(37,99,235,.08)}
  .children{position:relative;display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;min-width:0;padding-top:2px}
  .children:before{content:"";position:absolute;left:-18px;top:20px;width:18px;height:2px;background:#93c5fd}
  .child{display:flex;align-items:center;gap:4px;min-height:28px;padding:3px 8px;border:1px solid #bfdbfe;background:#fff;border-radius:999px;box-shadow:0 2px 7px rgba(15,23,42,.04)}
  .child:before{content:"";width:6px;height:6px;border-radius:50%;background:#60a5fa;flex:0 0 auto}
  .child span{max-width:160px;line-height:1.35;outline:none;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  [contenteditable="true"]:focus{box-shadow:0 0 0 2px rgba(37,99,235,.16);background:#fff}
  button{border:0;background:transparent;color:#64748b;cursor:pointer;font:inherit}
  .icon,.add-child,.add-group{opacity:0;transition:opacity .12s ease,background .12s ease,color .12s ease}
  .group:hover .icon,.group:focus-within .icon,.group:hover .add-child,.group:focus-within .add-child,.map:hover .add-group,.map:focus-within .add-group{opacity:1}
  .icon{width:18px;height:18px;border-radius:999px;line-height:18px;padding:0}
  .icon:hover,.add-child:hover,.add-group:hover{background:#e0ecff;color:#2563eb}
  .add-child{width:26px;height:26px;border:1px dashed #93c5fd;border-radius:999px;color:#2563eb}
  .add-group{margin-top:10px;margin-left:2px;padding:4px 10px;border:1px dashed #93c5fd;border-radius:999px;color:#2563eb;background:#fff}
</style>
</head>
<body>
  <main class="map">
    <div class="root" contenteditable="true" spellcheck="false">${escapeHtml(data.root)}</div>
    <div class="spine"></div>
    <div>
      <div class="groups">${groupHtml}</div>
      <button class="add-group" type="button" title="添加分支">+</button>
    </div>
  </main>
<script>
const blockId = ${escapeScriptJson(blockId)};
let data = ${escapeScriptJson(data)};
const source = ${escapeScriptJson(DOCUMENT_MIND_MAP_MESSAGE_SOURCE)};
const createId = (prefix) => prefix + "_" + Math.random().toString(36).slice(2, 12);
const textOf = (element, fallback) => (element?.textContent || "").replace(/\\s+/g, " ").trim() || fallback;
function collect(){
  data = {
    version: 1,
    root: textOf(document.querySelector(".root"), "导图").slice(0, ${MAX_LABEL_LENGTH}),
    groups: [...document.querySelectorAll(".group")].slice(0, ${MAX_GROUPS}).map((group, index) => ({
      id: group.dataset.groupId || createId("group"),
      title: textOf(group.querySelector(".group-title"), "分支 " + (index + 1)).slice(0, ${MAX_LABEL_LENGTH}),
      children: [...group.querySelectorAll(".child")].slice(0, ${MAX_CHILDREN_PER_GROUP}).map((child, childIndex) => ({
        id: child.dataset.childId || createId("node"),
        title: textOf(child.querySelector("span"), "节点 " + (childIndex + 1)).slice(0, ${MAX_LABEL_LENGTH})
      }))
    }))
  };
  if (!data.groups.length) data.groups.push({ id: createId("group"), title: "分支", children: [{ id: createId("node"), title: "节点" }] });
  data.groups.forEach(group => { if (!group.children.length) group.children.push({ id: createId("node"), title: "节点" }); });
  return data;
}
function notify(){
  const next = collect();
  parent.postMessage({ source, blockId, data: next, height: Math.max(240, Math.min(780, document.documentElement.scrollHeight + 12)) }, "*");
}
document.addEventListener("blur", (event) => {
  if (event.target?.isContentEditable) notify();
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target?.isContentEditable) {
    event.preventDefault();
    event.target.blur();
  }
});
document.addEventListener("click", (event) => {
  const target = event.target;
  const group = target.closest?.(".group");
  if (target.classList?.contains("add-child") && group) {
    const child = document.createElement("div");
    child.className = "child";
    child.dataset.childId = createId("node");
    child.innerHTML = '<span contenteditable="true" spellcheck="false">节点</span><button class="icon remove-child" type="button" title="删除节点">×</button>';
    target.before(child);
    child.querySelector("span").focus();
    notify();
  }
  if (target.classList?.contains("remove-child") && group) {
    const children = group.querySelectorAll(".child");
    if (children.length > 1) target.closest(".child").remove();
    notify();
  }
  if (target.classList?.contains("remove-group")) {
    if (document.querySelectorAll(".group").length > 1) group.remove();
    notify();
  }
  if (target.classList?.contains("add-group")) {
    const wrapper = document.createElement("section");
    wrapper.className = "group";
    wrapper.dataset.groupId = createId("group");
    wrapper.innerHTML = '<div class="group-title" contenteditable="true" spellcheck="false">分支</div><button class="icon remove-group" type="button" title="删除分支">×</button><div class="children"><div class="child" data-child-id="' + createId("node") + '"><span contenteditable="true" spellcheck="false">节点</span><button class="icon remove-child" type="button" title="删除节点">×</button></div><button class="add-child" type="button" title="添加节点">+</button></div>';
    document.querySelector(".groups").append(wrapper);
    wrapper.querySelector(".group-title").focus();
    notify();
  }
});
</script>
</body>
</html>`;
}
