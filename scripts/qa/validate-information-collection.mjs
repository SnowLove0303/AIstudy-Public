import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

function assertMatches(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

const main = read("electron/main.ts");
const runtime = read("electron/informationCollectionRuntime.ts");
const preload = read("electron/preload.cts");
const panel = read("src/renderer/features/collection/InformationCollectionPanel.tsx");
const storageBoundary = read("electron/storageBoundary.ts");
const packageScript = read("scripts/package/close-and-dist.ps1");

assertContains(main, "InformationProcessProgress", "Information collection must expose process progress payloads.");
assertContains(main, "information-collection:process-progress", "Information collection process must emit progress events.");
assertContains(main, "from \"./informationCollectionRuntime.js\"", "Main process must route information collection runtime helpers through a dedicated module.");
assertContains(runtime, "readInformationToolStatus", "Information collection runtime module must own tool detection.");
assertContains(runtime, "runInformationExecFile", "Information collection runtime module must own external command execution.");
assertContains(runtime, "createInformationCollectionRunId", "Information collection runtime module must own run directory ids.");
if (main.includes("async function readInformationToolStatus") || main.includes("async function runExecFile")) {
  throw new Error("main.ts must not re-own information collection tool detection or command execution.");
}
assertContains(preload, "onProcessProgress", "Renderer must be able to subscribe to information collection progress.");
assertContains(panel, "requestId", "Process requests must carry a request id so progress is scoped.");
assertContains(panel, "onProcessProgress", "Information collection panel must subscribe to process progress.");

assertContains(main, "download-subtitle", "Subtitle download step must have its own stable id.");
assertContains(main, "download-audio", "Audio download step must have its own stable id.");
assertMatches(
  runtime,
  /type InformationProcessStep = \{\s*id: "metadata" \| "subtitle" \| "official-text" \| "download-subtitle" \| "download-audio" \| "transcribe" \| "organize";/s,
  "Process step ids must be unique and explicit."
);
assertContains(panel, "{ id: \"download-subtitle\", name: \"下载字幕\"", "Frontend initial process steps must include subtitle download.");
assertContains(panel, "{ id: \"download-audio\", name: \"下载音频\"", "Frontend initial process steps must include audio download.");
assertContains(panel, "{ id: \"organize\", name: \"整理文档\"", "Frontend initial process steps must include document organization.");

assertContains(main, "createInformationCollectionRunId", "Information collection must isolate each processing run.");
assertMatches(
  main,
  /path\.join\(getInformationCollectionRuntimeRoot\(\), "bilibili", bvid, createInformationCollectionRunId\(\)\)/,
  "Process work directory must include a unique run id under the BV directory."
);
assertContains(main, "path.join(getInformationCollectionRuntimeRoot(), \"youtube\"", "YouTube processing must use the information collection runtime boundary.");
assertContains(main, "collectYoutubeInformation", "Information collection must support YouTube lookup fallback.");
assertContains(main, "processYoutubeVideo", "Information collection must support YouTube processing.");
assertContains(main, "--no-cache-dir", "yt-dlp must not use default user cache.");

assertContains(panel, "href: video.url", "Generated Word snapshot must preserve source URL metadata.");
assertContains(panel, "url: video.url", "Generated Word snapshot must preserve clickable source URL metadata.");
assertContains(panel, "preparedDocument", "Generated Word snapshot must use organized document content when available.");

assertContains(main, "hasReadyBilibiliTranscript", "Collection status must distinguish metadata-ready from transcript-ready.");
assertContains(main, "转录需要后续处理", "Partial collection result must explain pending transcript work.");
assertContains(runtime, "organizeInformationDocumentWithMimo", "Runtime must own the Mimo organization boundary.");
assertContains(runtime, "AISTUDY_MIMO_API_KEY", "Mimo credentials must be read from environment only.");
assertContains(runtime, "token-plan-cn.xiaomimimo.com", "Mimo Token Plan keys must use the token-plan endpoint by default.");
assertContains(runtime, '"authorization": `Bearer ${apiKey}`', "Mimo requests must support OpenAI-compatible Bearer authentication.");
assertContains(runtime, '"api-key": apiKey', "Mimo requests must keep Token Plan api-key authentication.");
assertContains(runtime, "shouldRetryMimoWithoutJsonFormat", "Mimo 400/422 request-format failures must retry without response_format.");
assertContains(runtime, "createMimoHttpError", "Mimo HTTP errors must be normalized instead of exposing raw provider JSON.");

assertContains(storageBoundary, "id: \"information-collection\"", "Storage boundary registry must include information collection runtime cache.");
assertContains(storageBoundary, "runtime-cache", "Information collection runtime files must be classified as runtime cache.");
assertContains(packageScript, "bilibili-cookies.txt", "Installer clean source guard must reject Bilibili cookie files.");

console.log("information collection policy: ok");
