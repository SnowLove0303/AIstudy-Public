import assert from "node:assert/strict";

import {
  buildDocumentTemplateElements,
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
assert(text.includes("xₙ = f(n), n = 1,2,3,...\n\n2. 数列极限定义"), "independent knowledge points should be separated by one blank line");
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

assert.equal(workflowByValue.get("四、标准执行流程\n")?.size, 22, "top-level workflow heading should use compact section style");
assert.equal(workflowByValue.get("1. 选品池读取\n")?.bold, true, "short numbered workflow steps should be subsection headings");
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

console.log("MCP document template validation passed.");
