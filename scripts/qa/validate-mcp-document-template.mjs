import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildDocumentTemplateElements,
  formatDocumentSnapshotPreservingText,
  normalizeDocumentSnapshot,
  normalizeDocumentMathText
} from "../mcp/aistudy-mcp-server.mjs";

const source = [
  "三、数列极限",
  "1. 数列",
  "数列是定义在正整数集合 N+ 上的函数：",
  "x_n = f(n), n = 1,2,3,...",
  "2. 数列极限定义",
  "若存在常数 a，使得对任意 epsilon>0，存在正整数 N，当 n>N 时恒有：",
  "|x_n-a| < epsilon,",
  "则称数列 {x_n} 收敛于 a，记为：",
  "lim_{n->infinity} x_n = a。",
  "3. epsilon-N 语言核心",
  "任取 epsilon>0；找到 N；当 n>N 时证明 |x_n-a|<epsilon。",
  "4. 子列性质",
  "若 x_n -> a，则任意子列 x_{n_k} -> a。"
].join("\n");

const elements = buildDocumentTemplateElements(source);
const text = elements.map((element) => element.value).join("");

assert.match(text, /三、数列极限\n/);
assert.match(text, /1\. 数列\n/);
assert.match(text, /2\. 数列极限定义\n/);
assert.match(text, /3\. ε-N 语言核心\n/);
assert.match(text, /ℕ⁺/);
assert.match(text, /xₙ = f\(n\)/);
assert.match(text, /\|xₙ-a\| < ε/);
assert.match(text, /lim_\{n→∞\} xₙ = a/);
assert.match(text, /x_\{nₖ\} → a/);
assert(!text.includes("epsilon"), "MCP document template should not keep degraded epsilon tokens");
assert(!text.includes("infinity"), "MCP document template should not keep degraded infinity tokens");
assert(!text.includes("->"), "MCP document template should not keep degraded arrow tokens");
assert(!text.includes("\n\n"), "Chinese article layout should use paragraph spacing instead of visible blank rows");
assert(elements.filter((element) => element.value.startsWith("　　")).length >= 5, "ordinary body paragraphs should use a two-character Chinese first-line indent");
assert.equal(normalizeDocumentMathText("f:Xarrow Y"), "f:X → Y");

const workflowSource = [
  "四、标准执行流程",
  "1. 选品池读取",
  "目标：获得可进入筛选的真实商品候选。",
  "数据来源：",
  "1. 旺店通/慧策供销找货页。",
  "2. 热销推荐接口。",
  "推荐 Action:",
  "1. huice-wdt.hot.goods.recommend.query",
  "2. huice-wdt.goods.analysis.query"
].join("\n");

const workflowElements = buildDocumentTemplateElements(workflowSource);
const workflowByValue = new Map(workflowElements.map((element) => [element.value, element]));

assert.equal(workflowByValue.get("四、标准执行流程\n")?.size, 24, "top-level workflow heading should use Chinese first-level heading style");
assert.equal(workflowByValue.get("四、标准执行流程\n")?.font, "SimHei", "Chinese section headings should use a stable Chinese heading font");
assert.equal(workflowByValue.get("1. 选品池读取\n")?.level, "fourth", "short numbered workflow steps should be third-level article headings");
assert.equal(workflowByValue.get("目标：")?.bold, true, "field labels should be bold labels");
assert.equal(workflowByValue.get(" 获得可进入筛选的真实商品候选。\n")?.bold, false, "field label content should stay body text");
assert.equal(workflowByValue.get("1. 旺店通/慧策供销找货页。\n")?.bold, false, "numbered data-source items should not be promoted to headings");
assert.equal(workflowByValue.get("1. huice-wdt.hot.goods.recommend.query\n")?.bold, false, "API action lines should remain list text");
assert(!workflowElements.some((element) => element.value === "\n\n" && element.size >= 20), "MCP template must not create large blank spacer elements");

const mermaidSource = [
  "二、页面功能拆解",
  "旺店通选品页可拆成三层：选品渠道、选品方式、筛选与判断字段。",
  "```mermaid",
  "mindmap",
  "  root((旺店通选品页))",
  "    选品渠道",
  "      找爆款",
  "      有上新",
  "    选品方式",
  "      搜索选品",
  "      榜单选品",
  "```"
].join("\n");

const mermaidElements = buildDocumentTemplateElements(mermaidSource);
const mermaidText = mermaidElements.map((element) => element.value).join("");
assert(!mermaidText.includes("```"), "MCP document template must not expose markdown fence markers");
assert(!mermaidText.toLowerCase().includes("mermaid"), "MCP document template must not expose raw mermaid language markers");
assert(mermaidText.includes("旺店通选品页"), "Mermaid mindmap root should be preserved as document text");
assert(mermaidText.includes("找爆款"), "Mermaid mindmap child nodes should be preserved as document text");
assert(mermaidText.includes("1.1. 选品渠道"), "Mermaid mindmap should be converted to stable numbered outline text");
assert(mermaidText.includes("1.1.1. 找爆款"), "Mermaid mindmap child depth should survive without whitespace indentation");

const tildeMermaidSource = mermaidSource.replace(/```/g, "~~~");
const tildeMermaidElements = buildDocumentTemplateElements(tildeMermaidSource);
const tildeMermaidText = tildeMermaidElements.map((element) => element.value).join("");
assert(!tildeMermaidText.includes("~~~"), "MCP document template must not expose tilde fence markers");
assert(!tildeMermaidText.toLowerCase().includes("mermaid"), "MCP document template must not expose tilde mermaid language markers");
assert(tildeMermaidText.includes("旺店通选品页"), "Tilde Mermaid mindmap root should be preserved as document text");
assert(tildeMermaidText.includes("1.1. 选品渠道"), "Tilde Mermaid mindmap should be converted to stable numbered outline text");

const asciiTreeSource = [
  "Figure 1: Product selection structure",
  "├─ 【Selection Channel】",
  "│  ├─ Find trends",
  "│  ├─ New arrivals",
  "│  └─ Category source",
  "├─ 【Selection Method】",
  "│  ├─ Search selection",
  "│  └─ Ranking selection"
].join("\n");
const asciiTreeElements = buildDocumentTemplateElements(asciiTreeSource);
const asciiTreeText = asciiTreeElements.map((element) => element.value).join("");
assert(!/[├└│]/.test(asciiTreeText), "ASCII tree connector glyphs should be converted into styled outline text");
assert(asciiTreeText.includes("Selection Channel"), "ASCII tree parent text should be preserved");
assert(asciiTreeText.includes("  • Find trends\n"), "ASCII tree children should keep readable hierarchy markers");
assert.equal(asciiTreeElements.find((element) => element.value === "Selection Channel\n")?.bold, true, "ASCII tree parent should use highlighted parent style");
assert.equal(asciiTreeElements.find((element) => element.value.includes("Find trends"))?.color, "#334155", "ASCII tree leaf should use quieter item style");

const codeSource = [
  "调试片段：",
  "```ts",
  "const value = \"\\\\n\";",
  "console.log(value);",
  "```"
].join("\n");
const codeElements = buildDocumentTemplateElements(codeSource);
const codeText = codeElements.map((element) => element.value).join("");
assert(!codeText.includes("```"), "ordinary code fences should not leak into document text");
assert(codeText.includes('const value = "\\\\n";'), "ordinary code block content should keep backslashes");
assert(codeElements.some((element) => element.font === "Consolas"), "ordinary code block should use code styling");

const chineseArticleSource = [
  "# 中国文章排版示例",
  "——MCP 节点文档规范",
  "一、总体要求",
  "（一）结构层次",
  "1. 三级标题",
  "（1）四级标题",
  "这是AIstudy MCP写入的第1段,需要正确排版!",
  "> 引用内容",
  "目标：形成规范正文。",
  "- 第一项",
  "路径：F:\\XIANGMU\\AIstudy-public",
  "访问 https://example.com/a?x=1"
].join("\n");
const chineseArticleElements = buildDocumentTemplateElements(chineseArticleSource);
const chineseArticleByText = new Map(chineseArticleElements.map((element) => [element.value, element]));
const chineseArticleText = chineseArticleElements.map((element) => element.value).join("");

assert.equal(chineseArticleByText.get("中国文章排版示例\n")?.rowFlex, "center", "explicit article title should be centered");
assert.equal(chineseArticleByText.get("中国文章排版示例\n")?.level, "first", "explicit article title should register as the first catalog level");
assert.equal(chineseArticleByText.get("——MCP 节点文档规范\n")?.font, "KaiTi", "subtitle should use the quieter Chinese subtitle style");
assert.equal(chineseArticleByText.get("一、总体要求\n")?.level, "second", "Chinese first-level numbering should map to the second catalog level under the article title");
assert.equal(chineseArticleByText.get("（一）结构层次\n")?.level, "third", "Chinese parenthesized numbering should map to the next heading level");
assert.equal(chineseArticleByText.get("1. 三级标题\n")?.level, "fourth", "Arabic numbering should map to the third article heading level");
assert.equal(chineseArticleByText.get("（1）四级标题\n")?.level, "fifth", "parenthesized Arabic numbering should map to the fourth article heading level");
assert(chineseArticleText.includes("　　这是 AIstudy MCP 写入的第1段，需要正确排版！\n"), "Chinese prose should receive safe mixed-language spacing, Chinese punctuation, and two-character indentation");
assert.equal(chineseArticleByText.get("引用内容\n")?.font, "KaiTi", "blockquote text should use Chinese quotation styling");
assert.equal(chineseArticleByText.get("- 第一项\n")?.bold, false, "bullet items must remain lists instead of being mistaken for ASCII trees");
assert(chineseArticleText.includes("F:\\XIANGMU\\AIstudy-public"), "Windows paths must survive Chinese typography normalization");
assert(chineseArticleText.includes("https://example.com/a?x=1"), "URLs must survive Chinese typography normalization");

const normalizedIndentSnapshot = normalizeDocumentSnapshot({
  schemaVersion: 1,
  editor: "canvas-editor",
  editorVersion: "qa",
  content: { main: chineseArticleElements },
  updatedAt: new Date(0).toISOString()
});
assert(
  normalizedIndentSnapshot.content.main.some((element) => element.value.startsWith("　　这是")),
  "snapshot sanitization must retain the standard two-character Chinese paragraph indent"
);

const preservingSource = {
  schemaVersion: 1,
  editor: "canvas-editor",
  editorVersion: "qa",
  content: {
    main: [
      { value: "一、原文标题\n", size: 12 },
      { value: "原文必须逐字保留，包括空格、标点与换行。\n", size: 12 },
      { value: "\n", size: 12 }
    ]
  },
  updatedAt: new Date(0).toISOString()
};
const preservedBefore = preservingSource.content.main.map((element) => element.value).join("");
const preservingFormatted = formatDocumentSnapshotPreservingText(preservingSource);
const preservedAfter = preservingFormatted.content.main.map((element) => element.value).join("");
assert.equal(preservedAfter, preservedBefore, "format_node_document formatting must preserve every editor value exactly");
assert.equal(preservingFormatted.content.main[0].font, "SimHei", "existing Chinese headings should receive the Chinese article style");
assert.equal(preservingFormatted.content.main[1].rowFlex, "alignment", "existing body text should receive justified paragraph layout without text mutation");

const desktopMcpSource = readFileSync(new URL("../../electron/main.ts", import.meta.url), "utf8");
for (const parityMarker of [
  'title: { font: "SimHei", size: 30',
  'section: { font: "SimHei", size: 24',
  'body: { font: "SimSun", size: 20',
  'rowFlex: "alignment", rowMargin: 1.65',
  'return `　　${value}`',
  'if (kind === "quote")',
  'lastValue && !lastValue.endsWith("\\n")'
]) {
  assert(desktopMcpSource.includes(parityMarker), `desktop/HTTP MCP formatter must keep parity marker: ${parityMarker}`);
}

console.log("MCP document template validation passed.");
