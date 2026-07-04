type DiagramNode = {
  title: string;
  children: string[];
};

const MAX_DIAGRAM_LINES = 80;
const MAX_LABEL_LENGTH = 42;
const ROOT_FILL = "#2563eb";
const GROUP_FILL = "#eff6ff";
const GROUP_STROKE = "#60a5fa";
const TEXT_COLOR = "#1f2937";
const MUTED_TEXT_COLOR = "#475569";
const BRACE_COLOR = "#2563eb";
const CANVAS_PADDING = 28;

function clampText(value: string, maxLength = MAX_LABEL_LENGTH) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function stripTreeDecorations(value: string) {
  return value
    .replace(/[├└│]/g, " ")
    .replace(/[─━]+/g, " ")
    .replace(/^[\s+`|\\-]+/, "")
    .replace(/^[•·●○]\s*/, "")
    .replace(/^\d+[.、]\s*/, "")
    .replace(/^[【\[]\s*/, "")
    .replace(/\s*[】\]]$/, "")
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

export function parseDiagramText(source: string): { root: string; groups: DiagramNode[] } | null {
  const rawLines = source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .slice(0, MAX_DIAGRAM_LINES);
  const parsed = rawLines
    .map((raw) => ({ depth: readLineDepth(raw), title: clampText(stripTreeDecorations(raw)) }))
    .filter((item) => item.title);
  if (parsed.length < 2) return null;

  let root = parsed[0].title;
  const groups: DiagramNode[] = [];
  let current: DiagramNode | null = null;
  const firstDepth = parsed[0].depth;

  parsed.slice(1).forEach((item) => {
    const relativeDepth = Math.max(0, item.depth - firstDepth);
    if (relativeDepth <= 0 || !current) {
      current = { title: item.title, children: [] };
      groups.push(current);
      return;
    }
    current.children.push(item.title);
  });

  if (groups.length === 0 && parsed.length > 1) {
    root = parsed[0].title;
    groups.push({ title: parsed[1].title, children: parsed.slice(2).map((item) => item.title) });
  }
  groups.forEach((group) => {
    if (group.children.length === 0) group.children.push("要点");
  });
  return groups.length ? { root, groups } : null;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBrace(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const mid = y + height / 2;
  const width = 26;
  ctx.beginPath();
  ctx.moveTo(x + width, y);
  ctx.bezierCurveTo(x + 4, y, x + 4, mid - 14, x, mid - 8);
  ctx.bezierCurveTo(x + 4, mid - 4, x + 4, mid + 4, x, mid + 8);
  ctx.bezierCurveTo(x + 4, mid + 14, x + 4, y + height, x + width, y + height);
  ctx.strokeStyle = BRACE_COLOR;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export async function renderDiagramPngDataUrl(source: string) {
  const data = parseDiagramText(source);
  if (!data) throw new Error("先选中层级文本");

  const itemHeight = 28;
  const groupGap = 22;
  const groupTitleWidth = 142;
  const itemWidth = 210;
  const rootWidth = 132;
  const rowHeights = data.groups.map((group) => Math.max(58, 32 + group.children.length * itemHeight));
  const contentHeight = rowHeights.reduce((sum, value) => sum + value, 0) + groupGap * Math.max(0, data.groups.length - 1);
  const width = CANVAS_PADDING * 2 + rootWidth + 58 + groupTitleWidth + 44 + itemWidth;
  const height = CANVAS_PADDING * 2 + Math.max(150, contentHeight);
  const canvas = document.createElement("canvas");
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("图片生成失败");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.font = "15px Microsoft YaHei, sans-serif";
  ctx.textBaseline = "middle";

  const rootX = CANVAS_PADDING;
  const rootY = height / 2 - 24;
  roundedRect(ctx, rootX, rootY, rootWidth, 48, 8);
  ctx.fillStyle = ROOT_FILL;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(data.root, rootX + rootWidth / 2, rootY + 24, rootWidth - 18);

  const braceX = rootX + rootWidth + 28;
  drawBrace(ctx, braceX, CANVAS_PADDING + 6, height - CANVAS_PADDING * 2 - 12);
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rootX + rootWidth, rootY + 24);
  ctx.lineTo(braceX + 8, rootY + 24);
  ctx.stroke();

  let y = CANVAS_PADDING;
  data.groups.forEach((group, index) => {
    const blockHeight = rowHeights[index];
    const groupX = braceX + 46;
    const groupY = y + blockHeight / 2 - 18;
    roundedRect(ctx, groupX, groupY, groupTitleWidth, 36, 7);
    ctx.fillStyle = GROUP_FILL;
    ctx.fill();
    ctx.strokeStyle = GROUP_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "700 15px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(group.title, groupX + groupTitleWidth / 2, groupY + 18, groupTitleWidth - 16);

    drawBrace(ctx, groupX + groupTitleWidth + 16, y + 4, blockHeight - 8);
    const itemX = groupX + groupTitleWidth + 56;
    const itemStartY = y + (blockHeight - group.children.length * itemHeight) / 2 + itemHeight / 2;
    ctx.font = "14px Microsoft YaHei, sans-serif";
    ctx.textAlign = "left";
    group.children.forEach((item, itemIndex) => {
      const itemY = itemStartY + itemIndex * itemHeight;
      ctx.fillStyle = MUTED_TEXT_COLOR;
      ctx.fillText(item, itemX + 15, itemY, itemWidth - 24);
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(itemX, itemY, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    y += blockHeight + groupGap;
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height
  };
}
