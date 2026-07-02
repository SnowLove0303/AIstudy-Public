import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const documentWorkspacePath = path.join(projectRoot, "src", "renderer", "features", "documents", "KnowledgeDocumentWorkspace.tsx");
const textbookWorkspacePath = path.join(projectRoot, "src", "renderer", "features", "textbook", "TextbookWorkspace.tsx");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const documentWorkspaceSource = fs.readFileSync(documentWorkspacePath, "utf8");
const textbookWorkspaceSource = fs.readFileSync(textbookWorkspacePath, "utf8");

assert(
  /import\s*\{\s*deleteLocalSnapshot,\s*readLocalSnapshot,\s*writeLocalSnapshot\s*\}/.test(documentWorkspaceSource),
  "knowledge documents must be able to clear stale local mirrors after a successful empty database read"
);
assert(
  /await\s+saveLocalDocument\(input\)/.test(documentWorkspaceSource) &&
    /Database save is authoritative/.test(documentWorkspaceSource),
  "successful knowledge document saves must refresh the local recovery mirror without replacing the database authority"
);
assert(
  /const nextSnapshot = document\?\.snapshot \?\? createEmptyKnowledgeDocumentSnapshot\(\)/.test(documentWorkspaceSource),
  "successful database reads with no document must open an empty document instead of replaying stale local content"
);
assert(
  /await\s+deleteLocalDocument\(documentBinding\.courseId,\s*documentBinding\.mindMapId,\s*documentBinding\.nodeId\)/.test(documentWorkspaceSource),
  "successful empty database reads must remove the old local document mirror"
);
assert(
  /await\s+deleteLocalDocument\(document\.courseId,\s*document\.mindMapId,\s*document\.nodeId\)/.test(documentWorkspaceSource),
  "database documents with missing snapshots must also clear stale local mirrors"
);

assert(
  /type DetachedPendingStoreSave/.test(textbookWorkspaceSource) &&
    /pendingStoreScopeRef/.test(textbookWorkspaceSource),
  "textbook pending saves must keep their original course and mind-map scope"
);
assert(
  /function detachPendingStoreSave\(\)/.test(textbookWorkspaceSource) &&
    /function persistDetachedStoreSave/.test(textbookWorkspaceSource),
  "textbook pending saves must be detached before scope reset and persisted independently"
);
assert(
  /const detachedPendingSave = detachPendingStoreSave\(\);\s*if \(detachedPendingSave\) void persistDetachedStoreSave\(detachedPendingSave\)/.test(textbookWorkspaceSource),
  "textbook scope changes must not discard the previous scope's delayed save"
);
assert(
  /pendingStoreScopeRef\.current = scope \? \{ \.\.\.scope \} : null/.test(textbookWorkspaceSource),
  "queued textbook saves must record the scope they belong to"
);

console.log("knowledge reliability policy: ok");
