import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function read(relativePath) {
  return fs.readFile(path.join(projectRoot, relativePath), "utf8");
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

const [stdioServer, helper, electronMain, controller, remoteAccess, workspace, documentTypes] = await Promise.all([
  read("scripts/mcp/aistudy-mcp-server.mjs"),
  read("scripts/mcp/call-aistudy-mcp.mjs"),
  read("electron/main.ts"),
  read("electron/mcp/controller.ts"),
  read("electron/mcp/remoteAccess.ts"),
  read("src/renderer/features/documents/KnowledgeDocumentWorkspace.tsx"),
  read("src/renderer/features/documents/knowledgeDocumentTypes.ts")
]);

requirePattern(stdioServer, /assertExplicitCourseOrAllScope\(args,\s*"read_current_mindmap"\)/, "stdio read_current_mindmap must require courseId or explicit all scope.");
requirePattern(stdioServer, /mcp_resolve_target requires ref, courseId, courseName, or nodeQuery/, "stdio target resolution must reject empty targets.");
requirePattern(stdioServer, /const mode = normalizeText\(args\.documentMode,\s*"summary"\)/, "stdio node context must default to summary documents.");
requirePattern(stdioServer, /const includeDescendants = args\.includeDescendants === true/, "stdio node context descendants must be opt-in.");
requirePattern(stdioServer, /DOCUMENT_VERSION_CONFLICT:[\s\S]{0,300}FOR UPDATE|FOR UPDATE[\s\S]{0,1600}DOCUMENT_VERSION_CONFLICT/, "stdio document writes must combine row locking with snapshot version checks.");
requirePattern(stdioServer, /structuredContent:\s*data/, "stdio tools must expose structuredContent.");
requirePattern(helper, /--session/, "local MCP helper must expose persistent session mode.");
requirePattern(helper, /--course-name/, "local MCP helper must expose Windows-safe direct target flags.");

requirePattern(electronMain, /expectedSnapshotId !== undefined[\s\S]{0,500}DOCUMENT_VERSION_CONFLICT/, "Electron document service must reject stale snapshot writes.");
requirePattern(electronMain, /findKnowledgeDocumentByNode\(connection,\s*knowledgeDocumentTable,\s*request,\s*true,\s*true\)/, "Electron document version check must run under a row lock.");
requirePattern(controller, /read_current_mindmap requires courseId or explicit scope='all'/, "in-app MCP controller must reject implicit all-library mind-map reads.");
requirePattern(controller, /structuredContent:\s*data/, "in-app MCP controller must expose structuredContent.");
requirePattern(remoteAccess, /structuredContent:\s*data/, "remote MCP transport must expose structuredContent.");
requirePattern(workspace, /expectedSnapshotId:\s*currentSnapshotIdRef\.current/, "document workspace saves must carry the last loaded snapshot id.");
requirePattern(documentTypes, /expectedSnapshotId\?: string \| null/, "renderer document save contract must include expectedSnapshotId.");

console.log("MCP runtime safety validation passed.");
