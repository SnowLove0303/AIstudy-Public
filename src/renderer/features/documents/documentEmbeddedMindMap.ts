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

export function createBlankEmbeddedMindMapData(root = "中心主题"): EmbeddedMindMapData {
  return {
    version: 1,
    root: cleanLabel(root, "中心主题"),
    groups: []
  };
}

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
    root: cleanLabel(source.root, "中心主题"),
    groups: normalizedGroups
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

export function getEmbeddedMindMapHeight(input: EmbeddedMindMapData) {
  const data = normalizeEmbeddedMindMapData(input);
  if (data.groups.length === 0) return 96;
  const groupHeights = data.groups.map((group) => Math.max(42, Math.max(1, group.children.length) * 26 + Math.max(0, group.children.length - 1) * 8));
  const totalGroupsHeight = groupHeights.reduce((total, height) => total + height, 0) + Math.max(0, data.groups.length - 1) * 24;
  return Math.max(126, Math.min(1600, totalGroupsHeight + 32));
}

function estimateNodeWidth(label: string, min: number, max: number, fontSize: number) {
  const wideChars = Array.from(label).reduce((total, char) => total + (/[\u4e00-\u9fff]/.test(char) ? 1 : 0.58), 0);
  return Math.max(min, Math.min(max, Math.round(wideChars * fontSize + 30)));
}

export function getEmbeddedMindMapWidth(input: EmbeddedMindMapData) {
  const data = normalizeEmbeddedMindMapData(input);
  const rootWidth = estimateNodeWidth(data.root, 88, 150, 20);
  const maxBranchWidth = data.groups.reduce((max, group) => Math.max(max, estimateNodeWidth(group.title, 78, 148, 14)), 0);
  const maxChildWidth = data.groups.reduce(
    (max, group) => Math.max(max, ...group.children.map((child) => estimateNodeWidth(child.title, 48, 190, 14))),
    0
  );
  if (data.groups.length === 0) return Math.max(190, rootWidth + 118);
  return Math.max(330, Math.min(720, rootWidth + 84 + maxBranchWidth + 76 + maxChildWidth + 28));
}

export function createEmbeddedMindMapSrcDoc(blockId: string, input: EmbeddedMindMapData) {
  const data = normalizeEmbeddedMindMapData(input);
  const groupHtml = data.groups
    .map(
      (group) => `
        <section class="group" data-group-id="${escapeHtml(group.id)}">
          <div class="branch" contenteditable="true" spellcheck="false">${escapeHtml(group.title)}</div>
          <button class="ghost remove-group" type="button" title="删除分支">×</button>
          <div class="children">
            ${group.children
              .map(
                (child) => `
                  <div class="node" data-child-id="${escapeHtml(child.id)}">
                    <span contenteditable="true" spellcheck="false">${escapeHtml(child.title)}</span>
                    <button class="ghost remove-child" type="button" title="删除节点">×</button>
                  </div>
                `
              )
              .join("")}
            <button class="ghost add-child" type="button" title="添加节点">+</button>
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
  html,body{margin:0;background:transparent;color:#172033;font-family:"Microsoft YaHei",Arial,sans-serif;font-size:14px;overflow:hidden}
  .map{position:relative;width:1px;height:1px;min-width:1px;min-height:1px;background:transparent}
  .connectors{position:absolute;left:0;top:0;z-index:0;overflow:visible;pointer-events:none}
  .connector{fill:none;stroke:#2546e8;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
  .root,.branch,.node,.add-group,.add-child{position:absolute;z-index:1}
  .root{min-width:88px;max-width:150px;padding:10px 18px;border-radius:7px;background:#2546e8;color:#fff;text-align:center;font-size:20px;font-weight:700;line-height:1.2;outline:none;box-shadow:0 8px 18px rgba(37,70,232,.18)}
  .groups,.group,.children{display:contents}
  .branch{min-width:78px;max-width:148px;padding:7px 13px;border:1px solid #111827;background:#fff;border-radius:7px;text-align:center;font-weight:700;line-height:1.3;outline:none;box-shadow:0 2px 5px rgba(15,23,42,.06)}
  .node{display:flex;align-items:center;gap:5px;min-height:24px;padding:1px 5px;border:0;background:transparent;border-radius:5px}
  .node span{max-width:190px;line-height:1.35;outline:none;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  [contenteditable="true"]:focus{box-shadow:0 0 0 2px rgba(37,70,232,.13);background:#fff}
  button{border:0;background:transparent;color:#64748b;cursor:pointer;font:inherit}
  .ghost{opacity:0;transition:opacity .12s ease,background .12s ease,color .12s ease}
  .map:hover .ghost,.map:focus-within .ghost{opacity:1}
  .remove-group,.remove-child{width:18px;height:18px;border-radius:999px;line-height:18px;padding:0}
  .remove-group{position:absolute;z-index:2}
  .remove-child:hover,.remove-group:hover,.add-child:hover,.add-group:hover{background:#e0ecff;color:#2563eb}
  .add-child{width:22px;height:22px;border-radius:999px;color:#2546e8}
  .add-group{padding:2px 8px;border-radius:999px;color:#2546e8;background:#fff}
  .is-empty .add-group{opacity:.82}
</style>
</head>
<body>
  <main class="map${data.groups.length === 0 ? " is-empty" : ""}">
    <svg class="connectors" aria-hidden="true"></svg>
    <div class="root" contenteditable="true" spellcheck="false">${escapeHtml(data.root)}</div>
    <div class="groups">${groupHtml}</div>
    <button class="ghost add-group" type="button" title="添加分支">+</button>
  </main>
<script>
const blockId = ${escapeScriptJson(blockId)};
let data = ${escapeScriptJson(data)};
const source = ${escapeScriptJson(DOCUMENT_MIND_MAP_MESSAGE_SOURCE)};
const createId = (prefix) => prefix + "_" + Math.random().toString(36).slice(2, 12);
const textOf = (element, fallback) => (element?.textContent || "").replace(/\\s+/g, " ").trim() || fallback;
const svgNamespace = "http://www.w3.org/2000/svg";
const addPath = (svg, d) => {
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("class", "connector");
  path.setAttribute("d", d);
  svg.appendChild(path);
};
const place = (element, x, y) => {
  element.style.left = Math.round(x) + "px";
  element.style.top = Math.round(y) + "px";
};
const sizeOf = (element) => ({ width: element.offsetWidth, height: element.offsetHeight });
function layoutMindMap(){
  const map = document.querySelector(".map");
  const svg = document.querySelector(".connectors");
  const root = document.querySelector(".root");
  if (!map || !svg || !root) return;

  const rootSize = sizeOf(root);
  const groups = [...document.querySelectorAll(".group")].map((group) => {
    const branch = group.querySelector(".branch");
    const children = [...group.querySelectorAll(".node")];
    const addChild = group.querySelector(".add-child");
    return {
      group,
      branch,
      branchSize: branch ? sizeOf(branch) : { width: 0, height: 0 },
      children: children.map((node) => ({ node, size: sizeOf(node) })),
      addChild
    };
  }).filter((item) => item.branch);

  const padTop = 8;
  const padRight = 4;
  const rootX = 0;
  const rootToTrunk = 40;
  const trunkToBranch = 40;
  const branchToBrace = 34;
  const braceToChild = 22;
  const groupGap = 24;
  const childGap = 8;
  const maxBranchWidth = Math.max(78, ...groups.map((item) => item.branchSize.width));
  const maxChildWidth = Math.max(34, ...groups.flatMap((item) => item.children.map((child) => child.size.width)));
  const trunkX = rootX + rootSize.width + rootToTrunk;
  const branchX = trunkX + trunkToBranch;
  const childX = branchX + maxBranchWidth + branchToBrace + braceToChild;
  const contentWidth = groups.length ? childX + maxChildWidth + padRight : rootSize.width + 116;

  const groupLayouts = groups.map((item) => {
    const childCount = Math.max(1, item.children.length);
    const childHeight = item.children.reduce((total, child) => total + child.size.height, 0) + Math.max(0, childCount - 1) * childGap;
    return { item, height: Math.max(item.branchSize.height, childHeight, 34) };
  });
  const groupTotalHeight = groupLayouts.reduce((total, item) => total + item.height, 0) + Math.max(0, groupLayouts.length - 1) * groupGap;
  const contentHeight = Math.max(rootSize.height + 20, groupLayouts.length ? groupTotalHeight : rootSize.height + 12);
  const mapWidth = Math.ceil(contentWidth);
  const mapHeight = Math.ceil(contentHeight + padTop * 2);
  map.style.width = mapWidth + "px";
  map.style.height = mapHeight + "px";
  svg.setAttribute("viewBox", "0 0 " + mapWidth + " " + mapHeight);
  svg.setAttribute("width", String(mapWidth));
  svg.setAttribute("height", String(mapHeight));
  svg.replaceChildren();

  const rootY = (mapHeight - rootSize.height) / 2;
  const rootCy = rootY + rootSize.height / 2;
  const rootRight = rootX + rootSize.width;
  place(root, rootX, rootY);

  if (!groupLayouts.length) {
    const addButton = document.querySelector(".add-group");
    place(addButton, rootRight + 84, rootCy - addButton.offsetHeight / 2);
    addPath(svg, "M " + rootRight + " " + rootCy + " H " + (rootRight + 70));
    return;
  }

  const addGroup = document.querySelector(".add-group");
  place(addGroup, trunkX - addGroup.offsetWidth / 2, Math.max(0, mapHeight - addGroup.offsetHeight - 1));
  let cursorY = padTop;
  const branchCenters = [];
  groupLayouts.forEach(({ item, height: groupHeight }) => {
    const branchCy = cursorY + groupHeight / 2;
    const branchY = branchCy - item.branchSize.height / 2;
    place(item.branch, branchX, branchY);
    const removeGroup = item.group.querySelector(".remove-group");
    if (removeGroup) place(removeGroup, branchX + item.branchSize.width + 5, branchCy - removeGroup.offsetHeight / 2);

    const childrenHeight = item.children.reduce((total, child) => total + child.size.height, 0) + Math.max(0, item.children.length - 1) * childGap;
    let childY = cursorY + (groupHeight - childrenHeight) / 2;
    item.children.forEach((child) => {
      place(child.node, childX, childY);
      childY += child.size.height + childGap;
    });
    if (item.addChild) place(item.addChild, childX + 2, childY - 1);
    branchCenters.push(branchCy);
    cursorY += groupHeight + groupGap;
  });

  const topY = Math.min(...branchCenters);
  const bottomY = Math.max(...branchCenters);
  addPath(svg, "M " + rootRight + " " + rootCy + " H " + trunkX);
  if (Math.abs(bottomY - topY) > 1) addPath(svg, "M " + trunkX + " " + topY + " V " + bottomY);
  groupLayouts.forEach(({ item }, index) => {
    const branchCy = branchCenters[index];
    const branchLeft = branchX;
    const branchRight = branchX + item.branchSize.width;
    addPath(svg, "M " + trunkX + " " + branchCy + " H " + branchLeft);
    if (!item.children.length) return;
    const nodeCenters = item.children.map((child) => Number.parseFloat(child.node.style.top) + child.size.height / 2);
    const braceX = childX - braceToChild;
    const braceRight = braceX + 12;
    addPath(svg, "M " + branchRight + " " + branchCy + " H " + braceX);
    if (item.children.length === 1) {
      addPath(svg, "M " + braceX + " " + nodeCenters[0] + " H " + childX);
      return;
    }
    const bracketTop = nodeCenters[0];
    const bracketBottom = nodeCenters[nodeCenters.length - 1];
    addPath(
      svg,
      "M " + braceRight + " " + bracketTop +
        " H " + (braceX + 6) +
        " Q " + braceX + " " + bracketTop + " " + braceX + " " + (bracketTop + 6) +
        " V " + (bracketBottom - 6) +
        " Q " + braceX + " " + bracketBottom + " " + (braceX + 6) + " " + bracketBottom +
        " H " + braceRight
    );
    nodeCenters.forEach((nodeCy, nodeIndex) => {
      const startX = nodeIndex === 0 || nodeIndex === nodeCenters.length - 1 ? braceRight : braceX;
      addPath(svg, "M " + startX + " " + nodeCy + " H " + childX);
    });
  });
}
function collect(){
  data = {
    version: 1,
    root: textOf(document.querySelector(".root"), "中心主题").slice(0, ${MAX_LABEL_LENGTH}),
    groups: [...document.querySelectorAll(".group")].slice(0, ${MAX_GROUPS}).map((group, index) => ({
      id: group.dataset.groupId || createId("group"),
      title: textOf(group.querySelector(".branch"), "分支 " + (index + 1)).slice(0, ${MAX_LABEL_LENGTH}),
      children: [...group.querySelectorAll(".node")].slice(0, ${MAX_CHILDREN_PER_GROUP}).map((child, childIndex) => ({
        id: child.dataset.childId || createId("node"),
        title: textOf(child.querySelector("span"), "节点 " + (childIndex + 1)).slice(0, ${MAX_LABEL_LENGTH})
      }))
    }))
  };
  data.groups.forEach(group => { if (!group.children.length) group.children.push({ id: createId("node"), title: "节点" }); });
  return data;
}
function notify(){
  layoutMindMap();
  const next = collect();
  parent.postMessage({ source, blockId, data: next, height: Math.max(120, Math.min(1600, document.documentElement.scrollHeight + 8)) }, "*");
}
const notifySoon = () => requestAnimationFrame(notify);
document.addEventListener("blur", (event) => {
  if (event.target?.isContentEditable) notify();
}, true);
document.addEventListener("input", (event) => {
  if (event.target?.isContentEditable) notifySoon();
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
    child.className = "node";
    child.dataset.childId = createId("node");
    child.innerHTML = '<span contenteditable="true" spellcheck="false">节点</span><button class="ghost remove-child" type="button" title="删除节点">×</button>';
    target.before(child);
    child.querySelector("span").focus();
    notifySoon();
  }
  if (target.classList?.contains("remove-child") && group) {
    const children = group.querySelectorAll(".node");
    if (children.length > 1) target.closest(".node").remove();
    notifySoon();
  }
  if (target.classList?.contains("remove-group")) {
    group.remove();
    document.querySelector(".map").classList.toggle("is-empty", document.querySelectorAll(".group").length === 0);
    notifySoon();
  }
  if (target.classList?.contains("add-group")) {
    const wrapper = document.createElement("section");
    wrapper.className = "group";
    wrapper.dataset.groupId = createId("group");
    wrapper.innerHTML = '<div class="branch" contenteditable="true" spellcheck="false">分支</div><button class="ghost remove-group" type="button" title="删除分支">×</button><div class="children"><div class="node" data-child-id="' + createId("node") + '"><span contenteditable="true" spellcheck="false">节点</span><button class="ghost remove-child" type="button" title="删除节点">×</button></div><button class="ghost add-child" type="button" title="添加节点">+</button></div>';
    document.querySelector(".groups").append(wrapper);
    document.querySelector(".map").classList.remove("is-empty");
    wrapper.querySelector(".branch").focus();
    notifySoon();
  }
});
requestAnimationFrame(layoutMindMap);
document.fonts?.ready?.then(() => requestAnimationFrame(layoutMindMap));
window.addEventListener("resize", () => requestAnimationFrame(layoutMindMap));
</script>
</body>
</html>`;
}
