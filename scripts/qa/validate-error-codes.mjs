const modulePath = new URL("../../dist-electron/appErrors.js", import.meta.url);
const { classifyAppError, createAppError, APP_ERROR_DEFINITIONS } = await import(modulePath);

const cases = [
  {
    name: "MySQL unavailable",
    source: "courses:create",
    error: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), { code: "ECONNREFUSED" }),
    expected: "MYSQL_UNAVAILABLE"
  },
  {
    name: "Duplicate section name",
    source: "course-sections:create",
    error: new Error("分区名称已存在。"),
    expected: "SECTION_NAME_DUPLICATE"
  },
  {
    name: "Document node missing",
    source: "knowledge-documents:save",
    error: createAppError("DOCUMENT_NODE_MISSING", "Mind map node is missing. Save the mind map before writing node details."),
    expected: "DOCUMENT_NODE_MISSING"
  },
  {
    name: "Document snapshot too large",
    source: "knowledge-documents:save",
    error: createAppError("DOCUMENT_SNAPSHOT_TOO_LARGE", "Knowledge document snapshot exceeds 2097152 bytes."),
    expected: "DOCUMENT_SNAPSHOT_TOO_LARGE"
  },
  {
    name: "Mind map inline asset blocked",
    source: "mindmaps:save",
    error: createAppError("MINDMAP_INLINE_ASSET_BLOCKED", "Mind map snapshot contains oversized inline base64 asset."),
    expected: "MINDMAP_INLINE_ASSET_BLOCKED"
  },
  {
    name: "Chrome login required",
    source: "ai-chat:send",
    error: new Error("ChatGPT 需要登录或验证，请先在端口管理确认登录状态"),
    expected: "CHROME_LOGIN_REQUIRED"
  },
  {
    name: "AI no response",
    source: "ai-chat:send",
    error: new Error("ChatGPT 未返回结果"),
    expected: "AI_NO_RESPONSE"
  },
  {
    name: "Import node match failed",
    source: "import:match",
    error: createAppError("IMPORT_NODE_MATCH_FAILED", "No stable node id matched for imported heading."),
    expected: "IMPORT_NODE_MATCH_FAILED"
  }
];

const missingFields = Object.values(APP_ERROR_DEFINITIONS).filter((definition) =>
  !definition.code ||
  !definition.domain ||
  !definition.userMessage ||
  !definition.reason ||
  !definition.action ||
  typeof definition.retryable !== "boolean"
);

if (missingFields.length) {
  console.error("[AIstudy Public] Error code definitions are incomplete:", missingFields.map((item) => item.code).join(", "));
  process.exit(1);
}

const failures = [];
for (const item of cases) {
  const result = classifyAppError(item.source, item.error);
  if (result.code !== item.expected) {
    failures.push(`${item.name}: expected ${item.expected}, got ${result.code}`);
  }
  if (!result.userMessage || result.userMessage.includes("Error:") || /SELECT|INSERT|UPDATE|DELETE|\\|\//i.test(result.userMessage)) {
    failures.push(`${item.name}: unsafe user message "${result.userMessage}"`);
  }
}

if (failures.length) {
  console.error("[AIstudy Public] Error code validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[AIstudy Public] Error code validation passed: ${cases.length} cases, ${Object.keys(APP_ERROR_DEFINITIONS).length} definitions.`);
