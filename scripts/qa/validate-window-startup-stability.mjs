import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

const main = read("electron/main.ts");
const preload = read("electron/preload.cts");
const startup = read("electron/windowStartup.ts");
const renderer = read("src/renderer/main.tsx");

requirePattern(
  main,
  /holdWindowUntilRendererReady\(mainWindow\)/,
  "the main window must remain hidden until the hydrated renderer reports readiness"
);
requirePattern(
  startup,
  /event\.sender !== window\.webContents/,
  "the startup gate must accept readiness only from its own renderer"
);
requirePattern(
  startup,
  /setTimeout\(reveal,\s*fallbackMs\)/,
  "the startup gate must retain a bounded fallback so launch cannot remain invisible"
);
requirePattern(
  preload,
  /signalRendererReady:\s*\(\)\s*=>\s*\{\s*ipcRenderer\.send\("app:renderer-ready"\)/s,
  "the preload must expose a narrow renderer-ready signal"
);
requirePattern(
  renderer,
  /if\s*\(!isHydrated\s*\|\|\s*!hasLoadedCourseStore\s*\|\|\s*rendererReadySentRef\.current\)\s*return undefined/,
  "the renderer must not reveal the main window before course hydration finishes"
);
requirePattern(
  renderer,
  /applyCourseStore\(store,\s*"mindmap"\)/,
  "cold startup must use the light mind-map mode instead of restoring both heavy editors"
);
requirePattern(
  renderer,
  /coldStartCourseIdRef\.current === activeCourseId[\s\S]*?setWorkspaceEditorMode\(isColdStartCourse \? "mindmap"/,
  "the first active-course effect must not restore a heavy mode during React async batching"
);

console.log("Window startup stability validation passed.");
