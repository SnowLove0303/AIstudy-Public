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
  const prefix = source.match(/^[\s│|]*/)?.[0] ?? "";
  const barDepth = (prefix.match(/[│|]/g) || []).length;
  const spaceDepth = Math.floor(prefix.replace(/[│|]/g, "").length / 3);
  const treeDepth = /^[\s│|]*[├└]/.test(source) ? 1 : 0;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function getEmbeddedMindMapHeight(data: EmbeddedMindMapData) {
  const maxChildren = data.groups.reduce((max, group) => Math.max(max, group.children.length), 1);
  return Math.max(260, Math.min(520, 112 + data.groups.length * 56 + maxChildren * 12));
}

export function createEmbeddedMindMapSrcDoc(blockId: string, input: EmbeddedMindMapData) {
  const data = normalizeEmbeddedMindMapData(input);
  const groupHtml = data.groups
    .map(
      (group) => `
        <section class="group" data-group-id="${escapeHtml(group.id)}">
          <div class="group-title" contenteditable="true" spellcheck="false">${escapeHtml(group.title)}</div>
          <button class="icon remove-group" type="button" title="删除分支">×</button>
          <div class="brace"></div>
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
            <button class="add-child" type="button" title="添加节点">＋</button>
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
  *{box-sizing:border-box} body{margin:0;background:#fff;color:#172033;font-family:"Microsoft YaHei",Arial,sans-serif;font-size:14px;overflow:hidden}
  .map{min-height:100vh;padding:18px 20px;display:flex;align-items:center;gap:28px}
  .root{min-width:118px;max-width:150px;padding:11px 16px;border-radius:8px;background:#2563eb;color:#fff;text-align:center;font-size:18px;font-weight:700;outline:none}
  .trunk{width:42px;height:2px;background:#2563eb;flex:0 0 auto}
  .groups{display:flex;flex-direction:column;gap:12px;min-width:420px}
  .group{display:grid;grid-template-columns:148px 22px 28px 1fr;align-items:center;gap:10px;min-height:44px}
  .group-title{padding:7px 12px;border:1px solid #93c5fd;background:#eff6ff;border-radius:8px;text-align:center;font-weight:700;outline:none}
  .brace{height:100%;min-height:42px;border:2px solid #2563eb;border-left:0;border-radius:0 12px 12px 0}
  .children{display:flex;flex-direction:column;gap:6px}
  .child{display:flex;align-items:center;gap:6px;min-height:22px}
  .child:before{content:"";width:7px;height:7px;border-radius:50%;background:#60a5fa;flex:0 0 auto}
  .child span{min-width:80px;max-width:260px;padding:2px 4px;outline:none;border-radius:4px}
  [contenteditable="true"]:focus{box-shadow:0 0 0 2px rgba(37,99,235,.16);background:#fff}
  button{border:0;background:transparent;color:#64748b;cursor:pointer;font:inherit}
  .icon{width:22px;height:22px;border-radius:5px}
  .icon:hover,.add-child:hover,.add-group:hover{background:#e0ecff;color:#2563eb}
  .add-child{align-self:flex-start;padding:1px 8px;border-radius:5px}
  .add-group{margin-left:calc(118px + 42px + 28px);padding:4px 10px;border-radius:6px;background:#f8fafc}
</style>
</head>
<body>
  <main class="map">
    <div class="root" contenteditable="true" spellcheck="false">${escapeHtml(data.root)}</div>
    <div class="trunk"></div>
    <div>
      <div class="groups">${groupHtml}</div>
      <button class="add-group" type="button" title="添加分支">＋</button>
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
  parent.postMessage({ source, blockId, data: next, height: Math.max(260, Math.min(520, document.documentElement.scrollHeight + 12)) }, "*");
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
    wrapper.innerHTML = '<div class="group-title" contenteditable="true" spellcheck="false">分支</div><button class="icon remove-group" type="button" title="删除分支">×</button><div class="brace"></div><div class="children"><div class="child" data-child-id="' + createId("node") + '"><span contenteditable="true" spellcheck="false">节点</span><button class="icon remove-child" type="button" title="删除节点">×</button></div><button class="add-child" type="button" title="添加节点">＋</button></div>';
    document.querySelector(".groups").append(wrapper);
    wrapper.querySelector(".group-title").focus();
    notify();
  }
});
</script>
</body>
</html>`;
}
