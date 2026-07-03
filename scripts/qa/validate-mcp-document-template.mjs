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

console.log("MCP document template validation passed.");
