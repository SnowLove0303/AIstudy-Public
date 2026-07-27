import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const exportModulePath = path.join(projectRoot, "dist-electron/documentExport.js");

if (!fs.existsSync(exportModulePath)) {
  throw new Error("Missing dist-electron/documentExport.js. Compile Electron before node title runtime QA.");
}

const { createKnowledgeDocumentDocxBuffer } = await import(pathToFileURL(exportModulePath).href);
const nodeTitle = "节点文档标题回归";
const snapshot = {
  schemaVersion: 1,
  editor: "aistudy-word",
  editorVersion: "qa",
  updatedAt: new Date(0).toISOString(),
  content: { main: [{ value: "正文回归" }] }
};
const buffer = await createKnowledgeDocumentDocxBuffer({ title: nodeTitle, snapshot });
const zip = await JSZip.loadAsync(buffer);
const documentXml = await zip.file("word/document.xml")?.async("string");

if (!documentXml) {
  throw new Error("DOCX should contain word/document.xml");
}
if (!new RegExp(`<w:t(?:\\s[^>]*)?>${nodeTitle}</w:t>`).test(documentXml)) {
  throw new Error("DOCX should render the node name as a visible document heading");
}
if (!documentXml.includes("正文回归")) {
  throw new Error("DOCX title projection must preserve the document body");
}

console.log("node document title runtime validation passed.");
