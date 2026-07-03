import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assertIncludes(file, needle, message) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${message}: ${file}`);
  }
}

assertIncludes("src/renderer/lib/ime.ts", "isImeComposingEvent", "IME guard helper should exist");
assertIncludes("src/renderer/features/course/CourseSidebar.tsx", "isImeComposingEvent(event)", "course sidebar input should ignore composing key events");
assertIncludes("src/renderer/features/course/CourseSidebar.tsx", "isSectionInputComposingRef.current", "course section submit should wait for composition end");
assertIncludes("src/renderer/features/course/CourseSidebar.tsx", "requestAnimationFrame", "course section input should focus after layout is stable");
assertIncludes("src/renderer/features/assistant/AiAssistantPanel.tsx", "isImeComposingEvent(event)", "assistant textarea should not send while composing");
assertIncludes("src/renderer/features/documents/KnowledgeDocumentWorkspace.tsx", "isImeComposingEvent(event)", "document editor shortcuts should not run while composing");
assertIncludes("src/renderer/features/mindmap/MindMapWorkspace.tsx", "isImeComposingEvent(event)", "mind map branch shortcuts should not run while composing");
assertIncludes("src/renderer/features/mindmap/MindMapCatalog.tsx", "isImeComposingEvent(event)", "mind map catalog keyboard actions should not run while composing");
assertIncludes("src/renderer/main.tsx", "isImeComposingEvent(event)", "shortcut settings should not capture composing keys");
assertIncludes("src/renderer/main.tsx", "isCourseDialogComposingRef.current", "course dialog submit should wait for composition end");
assertIncludes("src/renderer/main.tsx", "courseNameInputRef.current?.focus", "course dialog input should focus after layout is stable");

console.log("IME input guard policy: ok");
