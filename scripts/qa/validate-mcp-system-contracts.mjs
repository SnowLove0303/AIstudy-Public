import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDocumentTemplateElements,
  createDocumentRagIndexStatus,
  createMcpEditPolicy,
  createMcpTaskPlan,
  resolveDocumentTitle
} from "../mcp/aistudy-mcp-server.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const helperPath = path.join(projectRoot, "scripts", "mcp", "call-aistudy-mcp.mjs");
const qaArgsPath = path.join(projectRoot, ".tmp", "mcp-system-contract-args.json");
mkdirSync(path.dirname(qaArgsPath), { recursive: true });

function runHelper(args, input = undefined, envOverrides = {}) {
  return spawnSync(process.execPath, [helperPath, ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      TEMP: process.env.TEMP || "F:\\AIAPP\\Codex\\Temp",
      TMP: process.env.TMP || "F:\\AIAPP\\Codex\\Temp",
      AISTUDY_PUBLIC_DATA_ROOT: path.join(projectRoot, ".runtime"),
      AISTUDY_MCP_ALLOW_EDIT: "0",
      ...envOverrides
    },
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000
  });
}

const exactTokens = [
  "F:\\XIANGMU\\AIstudy-public\\scripts\\mcp\\call-aistudy-mcp.mjs",
  "\\\\server\\share\\AI Study\\document.json",
  "mcp_get_started",
  "read_node_context",
  "read_node_document",
  "mindmap_7e63",
  "--args-json",
  '{"courseId":"course_123","nodeId":"node_456"}',
  "aistudy://node/1a5dd446/7ebe2aaf?map=mindmap_7e63"
];
const documentText = buildDocumentTemplateElements([
  "一、精确文本",
  `路径：${exactTokens[0]}`,
  `共享路径：${exactTokens[1]}`,
  `工具：${exactTokens.slice(2, 5).join("、")}`,
  `标识：${exactTokens[5]}`,
  `参数：${exactTokens[6]} ${exactTokens[7]}`,
  `引用：${exactTokens[8]}`
].join("\n")).map((element) => element.value).join("");

for (const token of exactTokens) {
  assert(documentText.includes(token), `MCP document formatting must preserve exact technical token: ${token}`);
}
assert(!documentText.includes("readₙode_context"), "MCP tool names must never be rewritten as Unicode subscript text.");
assert(!documentText.includes("mcp_getₛtarted"), "MCP tool names must never be rewritten as Unicode subscript text.");

const ordinaryPlan = createMcpTaskPlan({ intent: "打开并编辑节点文档", allowEdit: true, courseId: "course_123" });
assert(!ordinaryPlan.steps.some((step) => String(step.tool).startsWith("chrome_")), "Opening a node document must not schedule Chrome tools.");
assert(ordinaryPlan.steps.some((step) => step.tool === "write_node_document"), "Document editing should plan the specific write tool.");
const formatPlan = createMcpTaskPlan({ intent: "排版节点文档", allowEdit: true });
assert(formatPlan.steps.some((step) => step.tool === "format_node_document"), "Formatting intent should plan format_node_document only.");

const previousPolicyEnv = {
  edit: process.env.AISTUDY_MCP_ALLOW_EDIT,
  tools: process.env.AISTUDY_MCP_ALLOWED_EDIT_TOOLS,
  courses: process.env.AISTUDY_MCP_ALLOWED_COURSE_IDS,
  nodes: process.env.AISTUDY_MCP_ALLOWED_NODE_IDS
};
try {
  process.env.AISTUDY_MCP_ALLOW_EDIT = "1";
  process.env.AISTUDY_MCP_ALLOWED_EDIT_TOOLS = "append_node_document,format_node_document";
  process.env.AISTUDY_MCP_ALLOWED_COURSE_IDS = "course_123";
  process.env.AISTUDY_MCP_ALLOWED_NODE_IDS = "node_456";
  assert.deepEqual(createMcpEditPolicy(), {
    enabled: true,
    allowedTools: ["append_node_document", "format_node_document"],
    allowedCourseIds: ["course_123"],
    allowedNodeIds: ["node_456"],
    toolRestricted: true,
    courseRestricted: true,
    nodeRestricted: true
  });
} finally {
  if (previousPolicyEnv.edit === undefined) delete process.env.AISTUDY_MCP_ALLOW_EDIT;
  else process.env.AISTUDY_MCP_ALLOW_EDIT = previousPolicyEnv.edit;
  if (previousPolicyEnv.tools === undefined) delete process.env.AISTUDY_MCP_ALLOWED_EDIT_TOOLS;
  else process.env.AISTUDY_MCP_ALLOWED_EDIT_TOOLS = previousPolicyEnv.tools;
  if (previousPolicyEnv.courses === undefined) delete process.env.AISTUDY_MCP_ALLOWED_COURSE_IDS;
  else process.env.AISTUDY_MCP_ALLOWED_COURSE_IDS = previousPolicyEnv.courses;
  if (previousPolicyEnv.nodes === undefined) delete process.env.AISTUDY_MCP_ALLOWED_NODE_IDS;
  else process.env.AISTUDY_MCP_ALLOWED_NODE_IDS = previousPolicyEnv.nodes;
}

assert.equal(resolveDocumentTitle("节点文档", "节点真实名称"), "节点真实名称");
assert.equal(resolveDocumentTitle("独立文章标题", "节点真实名称"), "独立文章标题");
assert.deepEqual(createDocumentRagIndexStatus("snapshot_123"), {
  supported: false,
  status: "not_configured",
  currentSnapshotId: "snapshot_123",
  indexedSnapshotId: null,
  synchronized: false,
  verificationAvailable: false,
  message: "AIstudy Public has no configured RAG vector-index contract. A saved document must not be treated as indexed."
});

const stdinArguments = {
  intent: `编辑 ${exactTokens[0]} 中的 read_node_context，参数 ${exactTokens[7]}`,
  allowEdit: true,
  courseId: "course_123"
};
const stdinResult = runHelper(
  ["--tool", "mcp_plan_task", "--args-stdin"],
  JSON.stringify(stdinArguments)
);
assert.equal(stdinResult.status, 0, stdinResult.stderr);
assert.equal(JSON.parse(stdinResult.stdout).intent, stdinArguments.intent, "--args-stdin must preserve PowerShell-hostile JSON text exactly.");

writeFileSync(qaArgsPath, JSON.stringify(stdinArguments), "utf8");
try {
  const fileResult = runHelper(["--tool", "mcp_plan_task", "--args-file", qaArgsPath]);
  assert.equal(fileResult.status, 0, fileResult.stderr);
  assert.equal(JSON.parse(fileResult.stdout).intent, stdinArguments.intent, "--args-file must preserve complex JSON text exactly.");
} finally {
  unlinkSync(qaArgsPath);
}

const malformedResult = runHelper(["--tool", "mcp_plan_task", "--args-json", "{courseId:course_123}"]);
assert.notEqual(malformedResult.status, 0, "Malformed shell-rewritten JSON must fail before an MCP call.");
assert.match(malformedResult.stderr, /--args-stdin|--args-file/, "Malformed JSON error must direct PowerShell callers to a safe input channel.");

const deniedEditResult = runHelper(
  ["--tool", "write_node_document", "--args-stdin"],
  JSON.stringify({ courseId: "course_123", nodeId: "node_456", text: "不会进入数据库" }),
  {
    AISTUDY_MCP_ALLOW_EDIT: "1",
    AISTUDY_MCP_ALLOWED_EDIT_TOOLS: "append_node_document"
  }
);
assert.match(
  `${deniedEditResult.stdout}\n${deniedEditResult.stderr}`,
  /MCP_EDIT_POLICY_DENIED/,
  "Out-of-policy edit tools must fail before target or database resolution."
);

const serverSource = readFileSync(path.join(projectRoot, "scripts", "mcp", "aistudy-mcp-server.mjs"), "utf8");
const mainSource = readFileSync(path.join(projectRoot, "electron", "main.ts"), "utf8");
const controllerSource = readFileSync(path.join(projectRoot, "electron", "mcp", "controller.ts"), "utf8");
for (const marker of [
  'documentMode: { type: "string", enum: ["none", "summary", "text", "full"]',
  "requiredNextCalls",
  "DOCUMENT_CONTEXT_TOO_LARGE",
  "remainingTextLength",
  "createDocumentRagIndexStatus",
  "AISTUDY_MCP_ALLOWED_EDIT_TOOLS",
  "AISTUDY_MCP_ALLOWED_COURSE_IDS",
  "AISTUDY_MCP_ALLOWED_NODE_IDS"
]) {
  assert(serverSource.includes(marker), `stdio MCP system contract is missing: ${marker}`);
}
for (const marker of [
  "MCP_DOCUMENT_CONTEXT_FULL_MAX_CHARS",
  "requiredNextCalls",
  "DOCUMENT_CONTEXT_TOO_LARGE",
  "remainingTextLength",
  "createMcpDocumentRagIndexStatus",
  "resolveMcpDocumentTitle"
]) {
  assert(mainSource.includes(marker), `desktop/HTTP MCP system contract is missing: ${marker}`);
}
assert(controllerSource.includes("getMcpEditPolicyViolation"), "desktop/HTTP MCP controller must enforce fine-grained edit policy.");
assert(!/const browserLike = [^\n]*\|页面\|/.test(controllerSource), "generic document page wording must not trigger Chrome planning.");

console.log("MCP system contracts validation passed.");
