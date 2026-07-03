import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const sourcePath = path.join(projectRoot, "src/renderer/features/documents/documentUrlLinks.ts");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const tempRoot = process.env.TMP || process.env.TEMP || os.tmpdir();
const tempDir = path.join(tempRoot, "aistudy-document-url-links-qa");
fs.mkdirSync(tempDir, { recursive: true });

const outputPath = path.join(tempDir, "documentUrlLinks.mjs");
fs.writeFileSync(
  outputPath,
  ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true
    },
    fileName: sourcePath
  }).outputText,
  "utf8"
);

const urlLinks = await import(pathToFileURL(outputPath).href);

const normalizedWww = urlLinks.normalizeDocumentUrl("www.example.com/docs");
assert(normalizedWww === "https://www.example.com/docs", "www URL should be normalized to https");
assert(urlLinks.normalizeDocumentUrl("file:///C:/Windows") === null, "non-http protocols must not be accepted");

const split = urlLinks.splitDocumentElementUrlLinks({
  value: "参考 https://example.com/a?b=1。然后继续",
  size: 16
});
assert(split.changed, "plain URL text should be split into linked elements");
assert(split.elements.some((element) => element.value === "https://example.com/a?b=1" && element.url === "https://example.com/a?b=1" && element.color === urlLinks.DOCUMENT_URL_LINK_COLOR), "URL run should be blue and linked");
assert(split.elements.some((element) => typeof element.value === "string" && element.value.startsWith("。")), "Chinese trailing punctuation should stay outside the link");

const alreadyLinked = urlLinks.splitDocumentElementUrlLinks({
  value: "https://example.com",
  url: "https://example.com",
  color: "#111827"
});
assert(alreadyLinked.changed, "existing URL should be restyled when needed");
assert(alreadyLinked.elements[0].underline === true, "existing URL should be underlined");

const content = urlLinks.normalizeDocumentUrlLinksInContent({
  main: [
    { value: "首页 www.aistudy.local/path" },
    {
      value: "",
      trList: [
        {
          tdList: [
            {
              value: [{ value: "表格 https://example.org/table," }]
            }
          ]
        }
      ]
    }
  ]
});
assert(content.changed, "URL normalization should walk document content");
assert(content.content.main[0].url === undefined, "plain prefix should not become a link");
assert(content.content.main.some((element) => element.url === "https://www.aistudy.local/path"), "www link should be detected in main content");
const tableElement = content.content.main.find((element) => Array.isArray(element.trList));
assert(tableElement.trList[0].tdList[0].value.some((element) => element.url === "https://example.org/table"), "table cell links should be detected");

console.log("Document URL link policy: ok");
