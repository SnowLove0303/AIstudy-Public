import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type InformationToolStatus = {
  id: "yt-dlp" | "ffmpeg" | "whisper";
  name: string;
  available: boolean;
  version: string;
  message: string;
};

export type InformationProcessStep = {
  id: "metadata" | "subtitle" | "official-text" | "download-subtitle" | "download-audio" | "transcribe";
  name: string;
  status: "pending" | "running" | "done" | "blocked" | "skipped";
  message: string;
};

export function createInformationStep(
  id: InformationProcessStep["id"],
  name: string,
  status: InformationProcessStep["status"],
  message: string
): InformationProcessStep {
  return { id, name, status, message };
}

export function getInformationCollectionRuntimeRoot(getDataPath: (...segments: string[]) => string) {
  return getDataPath("runtime", "information-collection");
}

export function createInformationCollectionRunId() {
  return `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
}

export function sanitizeInformationFileSegment(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";
}

export async function readTextFilesFromDirectory(dirPath: string, extensions: string[]) {
  const collected: string[] = [];
  const files = await fs.readdir(dirPath).catch(() => []);
  for (const fileName of files) {
    const lowerName = fileName.toLowerCase();
    if (!extensions.some((extension) => lowerName.endsWith(extension))) continue;
    const rawText = await fs.readFile(path.join(dirPath, fileName), "utf8").catch(() => "");
    if (!rawText.trim()) continue;
    collected.push(rawText);
  }
  return collected;
}

export function normalizeInformationSubtitleText(rawText: string) {
  return rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "WEBVTT" && !/^\d+$/.test(line) && !/^\d\d:\d\d[:.]/.test(line))
    .join("\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function describeInformationToolFailure(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/412|Precondition Failed/i.test(message)) {
    return "B站限制了本次访问。请在端口管理打开 B站、确认已登录后重试。";
  }
  if (/cookies?/i.test(message)) {
    return "B站登录态没有带上。请先通过端口管理打开 B站并保持登录。";
  }
  if (/ffmpeg/i.test(message)) {
    return "ffmpeg 没有准备好，音频无法处理。";
  }
  if (/timed? out|timeout/i.test(message)) {
    return "该步骤执行超时，请稍后重试或先打开 B站端口确认视频可播放。";
  }
  return fallback;
}

export async function runInformationExecFile(command: string, args: string[], cwd: string, timeoutMs: number) {
  return execFileAsync(command, args, {
    cwd,
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
}

export async function readInformationToolStatus(): Promise<InformationToolStatus[]> {
  const tools: Array<{ id: InformationToolStatus["id"]; name: string; command: string; args: string[]; missingMessage: string }> = [
    { id: "yt-dlp", name: "视频下载", command: "yt-dlp", args: ["--version"], missingMessage: "未检测到视频下载工具。" },
    { id: "ffmpeg", name: "音频处理", command: "ffmpeg", args: ["-version"], missingMessage: "未检测到音频处理工具。" },
    { id: "whisper", name: "语音转写", command: "whisper", args: ["--help"], missingMessage: "未检测到本地转写工具。" }
  ];

  return Promise.all(tools.map(async (tool) => {
    try {
      const result = await execFileAsync(tool.command, tool.args, { timeout: 5000, windowsHide: true });
      const version = `${result.stdout || result.stderr}`.split(/\r?\n/)[0]?.trim() ?? "";
      return {
        id: tool.id,
        name: tool.name,
        available: true,
        version,
        message: "已就绪"
      };
    } catch {
      return {
        id: tool.id,
        name: tool.name,
        available: false,
        version: "",
        message: tool.missingMessage
      };
    }
  }));
}
