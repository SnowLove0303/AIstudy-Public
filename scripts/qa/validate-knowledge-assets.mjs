import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function fail(message) {
  console.error(`knowledge asset policy: ${message}`);
  process.exitCode = 1;
}

const main = read("electron/main.ts");
const preload = read("electron/preload.cts");
const service = read("electron/knowledgeAssetService.ts");
const documentTypes = read("src/renderer/features/documents/knowledgeDocumentTypes.ts");
const documentAdapter = read("src/renderer/features/documents/canvasEditorAdapter.ts");
const documentWorkspace = read("src/renderer/features/documents/KnowledgeDocumentWorkspace.tsx");
const mindMapTypes = read("src/renderer/features/mindmap/mindMapTypes.ts");
const mindMapAdapter = read("src/renderer/features/mindmap/simpleMindMapAdapter.ts");
const mindMapWorkspace = read("src/renderer/features/mindmap/MindMapWorkspace.tsx");

const requiredMainMarkers = [
  "KNOWLEDGE_ASSET_PROTOCOL",
  "knowledgeAssetService.registerProtocolHandler()",
  "knowledge-assets:choose-image",
  "syncKnowledgeAssetLinks(connection, knowledgeAssetLinkTable",
  "extractKnowledgeAssetIds(request.snapshot)",
  "collectMindMapNodeAssetReferences"
];

for (const marker of requiredMainMarkers) {
  if (!main.includes(marker)) {
    fail(`main process asset integration is missing ${marker}`);
  }
}

const requiredServiceMarkers = [
  "knowledge-images",
  "sha256",
  "ON DUPLICATE KEY UPDATE",
  "knowledgeAssetLinkTable",
  "aistudyAssetId",
  "MAX_IMAGE_BYTES",
  "protocol.handle(KNOWLEDGE_ASSET_PROTOCOL"
];

for (const marker of requiredServiceMarkers) {
  if (!service.includes(marker)) {
    fail(`asset service is missing ${marker}`);
  }
}

if (!preload.includes("aistudyKnowledgeAssets") || !preload.includes("knowledge-assets:choose-image")) {
  fail("preload must expose only the image chooser asset bridge");
}

if (!documentTypes.includes("insertImage") || !documentTypes.includes("KnowledgeDocumentImageInput")) {
  fail("document editor handle must expose insertImage with asset metadata");
}

for (const marker of ["ElementType.IMAGE", "aistudyAssetId", "aistudyAssetUrl", "executeInsertElementList([createImageElement(image)])"]) {
  if (!documentAdapter.includes(marker)) {
    fail(`document adapter image insertion is missing ${marker}`);
  }
}

if (!documentWorkspace.includes("relationType: \"document-image\"") || !documentWorkspace.includes("<ImageIcon")) {
  fail("document workspace must choose and insert database-backed images");
}

if (!mindMapTypes.includes("imageAssetId") || !mindMapTypes.includes("aistudyAssetId")) {
  fail("mind map types must preserve image asset ids");
}

for (const marker of ["relationType: \"mindmap-node-image\"", "onChooseImage", "mindmap-topic-upload-button"]) {
  if (!mindMapWorkspace.includes(marker)) {
    fail(`mind map workspace image chooser is missing ${marker}`);
  }
}

for (const marker of ["SET_NODE_IMAGE", "SET_NODE_DATA", "aistudyAssetId", "fitTopicImageSize"]) {
  if (!mindMapAdapter.includes(marker)) {
    fail(`mind map adapter asset image persistence is missing ${marker}`);
  }
}

if (/(readAsDataURL|data:image\/|;base64,)/.test(documentWorkspace + mindMapWorkspace + documentAdapter + mindMapAdapter)) {
  fail("renderer image insertion must not embed image base64 data URLs");
}

if (!process.exitCode) {
  console.log("knowledge asset policy: ok");
}
