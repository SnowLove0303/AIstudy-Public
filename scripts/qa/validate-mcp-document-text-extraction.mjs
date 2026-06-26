import assert from "node:assert/strict";

import {
  createDocumentTextIntegrity,
  extractDocumentText,
  normalizeDocumentSnapshot
} from "../mcp/aistudy-mcp-server.mjs";

const nestedBody = "第一阶段 MVP 正文。".repeat(120);
const milestoneBody = "里程碑正文。".repeat(80);

const rawSnapshot = {
  schemaVersion: 1,
  editor: "aistudy-word",
  editorVersion: "canvas-editor@test",
  updatedAt: "2026-06-26T00:00:00.000Z",
  content: {
    main: [
      { value: "一、直接章节\n直接正文。\n", size: 22, bold: true },
      {
        value: "五、目标用户\n",
        size: 22,
        bold: true,
        valueList: [
          { value: "目标用户正文第一段。\n", size: 20 },
          { value: "目标用户正文第二段。\n", size: 20 }
        ]
      },
      {
        value: "",
        listWrap: {
          valueList: [
            { value: "七、项目的用户价值\n", size: 22, bold: true },
            { value: "用户价值正文不能被父级空 value 裁掉。\n", size: 20 }
          ]
        }
      },
      {
        value: "九、第一阶段MVP范围\n",
        valueList: [
          { value: nestedBody, size: 20 }
        ]
      },
      {
        value: "",
        valueList: [
          { value: "十四、开发阶段与里程碑\n", size: 22, bold: true },
          { value: milestoneBody, size: 20 }
        ]
      }
    ]
  }
};

const rawText = extractDocumentText(rawSnapshot.content);
const normalizedSnapshot = normalizeDocumentSnapshot(rawSnapshot);
const normalizedText = extractDocumentText(normalizedSnapshot.content);
const integrity = createDocumentTextIntegrity(rawText, normalizedText);

assert.equal(normalizedText, rawText);
assert.equal(integrity.rawTextLength, rawText.length);
assert.equal(integrity.normalizedTextLength, rawText.length);
assert.equal(integrity.lostTextLength, 0);
assert.equal(integrity.warning, null);
assert.match(normalizedText, /目标用户正文第一段/);
assert.match(normalizedText, /用户价值正文不能被父级空 value 裁掉/);
assert.match(normalizedText, /第一阶段 MVP 正文/);
assert.match(normalizedText, /开发阶段与里程碑/);
assert.match(normalizedText, /里程碑正文/);

console.log("MCP document text extraction validation passed.");
