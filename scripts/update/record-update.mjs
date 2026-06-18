import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const packageJsonPath = path.join(projectRoot, "package.json");
const updateIndexPath = path.join(projectRoot, "docs/updates/INDEX.md");

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function formatDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds())
  ].join("");
}

function normalizeSummary(values) {
  const summary = values.join(" ").trim() || process.env.AISTUDY_PUBLIC_UPDATE_SUMMARY?.trim();
  return (summary || "一键打包生成安装包")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

function splitSummary(summary) {
  const items = summary
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : [summary];
}

function ensureUpdateDirectory() {
  fs.mkdirSync(path.dirname(updateIndexPath), { recursive: true });
}

function createEmptyIndex() {
  return [
    "# AIstudy Public 更新索引",
    "",
    "> 本文件由 `scripts/update/record-update.mjs` 维护，用于记录版本号、更新时间和功能更新摘要。更新内容不在应用 UI 中展示。",
    "",
    "## 最新版本",
    "",
    "",
    "",
    "## 更新记录",
    ""
  ].join("\n");
}

function replaceLatestSection(content, latestLines) {
  const latestSection = `## 最新版本\n\n${latestLines.join("\n")}\n`;
  const latestPattern = /## 最新版本[\s\S]*?(?=\n## 更新记录|\s*$)/;

  if (latestPattern.test(content)) {
    return content.replace(latestPattern, latestSection);
  }

  return `${latestSection}\n${content.trimStart()}`;
}

function prependEntry(content, entryLines) {
  if (content.includes("## 更新记录")) {
    return content.replace("## 更新记录", `## 更新记录\n\n${entryLines.join("\n")}`);
  }

  return `${content.trimEnd()}\n\n## 更新记录\n\n${entryLines.join("\n")}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeVersionEntries(content, version) {
  const marker = "## 更新记录";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) return content;

  const beforeEntries = content.slice(0, markerIndex + marker.length);
  const entries = content.slice(markerIndex + marker.length);
  const versionPattern = new RegExp(
    `\\n{0,2}### ${escapeRegExp(version)} - [^\\n]+\\n[\\s\\S]*?(?=\\n### |\\s*$)`,
    "g"
  );
  return `${beforeEntries}${entries.replace(versionPattern, "")}`;
}

ensureUpdateDirectory();

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = String(packageJson.version || "0.0.0");
const configuredRepository = typeof packageJson.repository === "string"
  ? packageJson.repository
  : packageJson.repository?.url || "";
const updatedAt = formatDate(new Date());
const summary = normalizeSummary(process.argv.slice(2));
const summaryItems = splitSummary(summary);
const remote = configuredRepository || runGit(["remote", "get-url", "origin"]);
const branch = runGit(["branch", "--show-current"]);
const commit = runGit(["rev-parse", "--short", "HEAD"]);

const latestLines = [
  `- 版本号：${version}`,
  `- 更新时间：${updatedAt}`,
  `- 功能更新：${summary}`,
  remote ? `- GitHub：${remote}` : "",
  branch ? `- 分支：${branch}` : "",
  commit ? `- 提交：${commit}` : ""
].filter(Boolean);

const entryLines = [
  `### ${version} - ${updatedAt}`,
  "",
  ...summaryItems.map((item) => `- ${item}`),
  remote ? `- GitHub：${remote}` : "",
  branch ? `- 分支：${branch}` : "",
  commit ? `- 提交：${commit}` : "",
  ""
].filter((line, index, lines) => line || lines[index - 1] !== "");

const current = fs.existsSync(updateIndexPath) ? fs.readFileSync(updateIndexPath, "utf8") : createEmptyIndex();

const withLatest = replaceLatestSection(current.trim() ? current : createEmptyIndex(), latestLines);
const withoutDuplicateVersion = removeVersionEntries(withLatest, version);
const next = prependEntry(withoutDuplicateVersion, entryLines);

fs.writeFileSync(updateIndexPath, `${next.trimEnd()}\n`, "utf8");
console.log(`[AIstudy Public] Update index recorded: ${version} ${updatedAt}`);
