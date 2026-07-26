import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotCache } from "../mcp/snapshot-cache.mjs";

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
requirePattern(stdioServer, /WITH RECURSIVE node_path/, "stdio default node context must use a targeted ancestor query.");
requirePattern(stdioServer, /new SnapshotCache\(\{ maxEntries: 4, maxBytes: DOCUMENT_SNAPSHOT_CACHE_MAX_BYTES \}\)/, "stdio document snapshot cache must have byte and entry limits.");
requirePattern(stdioServer, /DOCUMENT_VERSION_CONFLICT:[\s\S]{0,300}FOR UPDATE|FOR UPDATE[\s\S]{0,1600}DOCUMENT_VERSION_CONFLICT/, "stdio document writes must combine row locking with snapshot version checks.");
requirePattern(stdioServer, /structuredContent:\s*data/, "stdio tools must expose structuredContent.");
requirePattern(helper, /--session/, "local MCP helper must expose persistent session mode.");
requirePattern(helper, /--course-name/, "local MCP helper must expose Windows-safe direct target flags.");
requirePattern(helper, /--query/, "local MCP helper must expose a Windows-safe direct search query flag.");

requirePattern(electronMain, /expectedSnapshotId !== undefined[\s\S]{0,500}DOCUMENT_VERSION_CONFLICT/, "Electron document service must reject stale snapshot writes.");
requirePattern(electronMain, /findKnowledgeDocumentByNode\(connection,\s*knowledgeDocumentTable,\s*request,\s*true,\s*true\)/, "Electron document version check must run under a row lock.");
requirePattern(electronMain, /WITH RECURSIVE node_path/, "Electron default node context must use a targeted ancestor query.");
requirePattern(electronMain, /maxBytes:\s*2 \* 1024 \* 1024/, "Electron document snapshot cache must have a byte limit.");
requirePattern(controller, /read_current_mindmap requires courseId or explicit scope='all'/, "in-app MCP controller must reject implicit all-library mind-map reads.");
requirePattern(controller, /structuredContent:\s*data/, "in-app MCP controller must expose structuredContent.");
requirePattern(remoteAccess, /structuredContent:\s*data/, "remote MCP transport must expose structuredContent.");
requirePattern(workspace, /expectedSnapshotId:\s*currentSnapshotIdRef\.current/, "document workspace saves must carry the last loaded snapshot id.");
requirePattern(documentTypes, /expectedSnapshotId\?: string \| null/, "renderer document save contract must include expectedSnapshotId.");

const cache = new SnapshotCache({ maxEntries: 3, maxBytes: 10 });
cache.set("a", { id: "a" }, 6);
cache.set("b", { id: "b" }, 6);
if (cache.get("a") !== null || cache.get("b")?.id !== "b") {
  throw new Error("Snapshot cache must evict by byte size.");
}
cache.set("oversized", { id: "oversized" }, 11);
if (cache.get("oversized") !== null) {
  throw new Error("Snapshot cache must not retain an entry larger than its byte limit.");
}

console.log("MCP runtime safety validation passed.");
