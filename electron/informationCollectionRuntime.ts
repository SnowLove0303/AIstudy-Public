import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type InformationToolStatus = {
  id: "yt-dlp" | "ffmpeg" | "whisper" | "mimo";
  name: string;
  available: boolean;
  version: string;
  message: string;
};

export type InformationProcessStep = {
  id: "metadata" | "subtitle" | "official-text" | "download-subtitle" | "download-audio" | "transcribe" | "organize";
  name: string;
  status: "pending" | "running" | "done" | "blocked" | "skipped";
  message: string;
};

export type InformationDocumentItem = {
  title: string;
  mainContent: string;
  sourceUrls: string[];
};

export type InformationPreparedDocument = {
  status: "available" | "fallback" | "blocked";
  provider: "mimo" | "local";
  title: string;
  overview: string;
  items: InformationDocumentItem[];
  transcript: string;
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
  const lines = rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      line
      && line !== "WEBVTT"
      && !/^Kind:/i.test(line)
      && !/^Language:/i.test(line)
      && !/^NOTE\b/i.test(line)
      && !/^\d+$/.test(line)
      && !/^\d\d:\d\d[:.]/.test(line)
      && !/^<c[.\w-]*>$/i.test(line)
      && !/^<\/c>$/i.test(line)
    )
    .map((line) => line.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines
    .filter((line, index) => index === 0 || line !== lines[index - 1])
    .join("\n")
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

function readMimoApiKey() {
  return process.env.AISTUDY_MIMO_API_KEY?.trim() || process.env.MIMO_API_KEY?.trim() || "";
}

function readMimoBaseUrl(apiKey: string) {
  const configured = process.env.AISTUDY_MIMO_BASE_URL?.trim() || process.env.MIMO_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return apiKey.startsWith("tp-") ? "https://token-plan-cn.xiaomimimo.com/v1" : "https://api.xiaomimimo.com/v1";
}

function readMimoModel() {
  return process.env.AISTUDY_MIMO_MODEL?.trim() || process.env.MIMO_MODEL?.trim() || "mimo-v2.5-pro";
}

async function readMimoResponseText(response: Response) {
  try {
    return (await response.text()).slice(0, 2000);
  } catch {
    return "";
  }
}

function getMimoErrorDetail(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(getMimoErrorDetail).filter(Boolean).join("; ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return getMimoErrorDetail(record.message) || getMimoErrorDetail(record.detail) || getMimoErrorDetail(record.error);
  }
  return "";
}

function createMimoHttpError(status: number, responseText: string) {
  let detail = responseText.trim();
  try {
    detail = getMimoErrorDetail(JSON.parse(responseText)) || detail;
  } catch {
    // Some compatible endpoints return plain text for request-level errors.
  }
  const normalized = /bad request/i.test(detail)
    ? "Mimo rejected the request format."
    : detail || "Mimo request failed.";
  return new Error(`Mimo returned HTTP ${status}: ${normalized}`.slice(0, 500));
}

function shouldRetryMimoWithoutJsonFormat(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = Number(message.match(/HTTP (\d+)/)?.[1] ?? 0);
  const lowerMessage = message.toLowerCase();
  return status === 400 || status === 422 || lowerMessage.includes("response_format") || lowerMessage.includes("bad request");
}

function createMimoChatCompletionBody(prompt: string, useJsonResponseFormat: boolean) {
  const body: Record<string, unknown> = {
    model: readMimoModel(),
    messages: [
      { role: "system", content: "你负责把视频转录整理成可入库的中文早报文档，只能输出 JSON。" },
      { role: "user", content: prompt }
    ],
    max_tokens: 4096
  };
  if (useJsonResponseFormat) {
    body.response_format = { type: "json_object" };
  }
  return body;
}

async function requestMimoChatCompletion(apiKey: string, prompt: string, useJsonResponseFormat: boolean) {
  const response = await fetch(`${readMimoBaseUrl(apiKey)}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(createMimoChatCompletionBody(prompt, useJsonResponseFormat))
  });
  if (!response.ok) {
    throw createMimoHttpError(response.status, await readMimoResponseText(response));
  }
  return await response.json() as Record<string, unknown>;
}

function collectSourceUrls(value: string) {
  return Array.from(new Set(String(value || "").match(/https?:\/\/[^\s"'<>，。；、)）]+/gi) ?? []));
}

function splitInformationTranscriptParagraphs(value: string) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => index === 0 || line !== lines[index - 1]);
}

function normalizeInformationDocumentItem(value: unknown): InformationDocumentItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const mainContent = typeof record.mainContent === "string" ? record.mainContent.trim() : "";
  const sourceUrls = Array.isArray(record.sourceUrls)
    ? record.sourceUrls.filter((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item.trim())).map((item) => item.trim())
    : [];
  if (!title && !mainContent) return null;
  return {
    title: title || mainContent.slice(0, 60),
    mainContent,
    sourceUrls: Array.from(new Set(sourceUrls))
  };
}

function parseMimoJsonPayload(value: string) {
  const text = value.trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || text.match(/\{[\s\S]*\}/)?.[0] || text;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createLocalInformationDocument(input: {
  title: string;
  author: string;
  publishedAt: string;
  url: string;
  description: string;
  transcript: string;
  message: string;
}): InformationPreparedDocument {
  const paragraphs = splitInformationTranscriptParagraphs(input.transcript);
  const itemLines = paragraphs.filter((line) => /^\d{1,2}[.、]\s*\S/.test(line));
  const items = itemLines.length
    ? itemLines.map((line) => {
        const title = line.replace(/^\d{1,2}[.、]\s*/, "").trim();
        return { title, mainContent: title, sourceUrls: [] };
      })
    : paragraphs
        .filter((line) => line.length >= 16)
        .slice(0, 12)
        .map((line) => ({ title: line.slice(0, 48), mainContent: line, sourceUrls: [] }));

  return {
    status: "fallback",
    provider: "local",
    title: input.title,
    overview: paragraphs.slice(0, 3).join(" "),
    items,
    transcript: input.transcript,
    message: input.message || "Mimo 未配置或暂时不可用，已使用本地规则整理。"
  };
}

export async function organizeInformationDocumentWithMimo(input: {
  title: string;
  author: string;
  publishedAt: string;
  url: string;
  description: string;
  transcript: string;
  workDir: string;
}): Promise<InformationPreparedDocument> {
  const fallback = createLocalInformationDocument({
    ...input,
    message: "Mimo 未配置，已使用本地规则整理。"
  });
  const apiKey = readMimoApiKey();
  if (!apiKey) return fallback;

  const sourceUrls = collectSourceUrls(input.description);
  const prompt = [
    "你是 AIstudy 的信息采集整理器。请只基于提供的视频元数据、来源链接和转录内容整理，不要补充未经材料支持的信息。",
    "输出必须是 JSON，不要 Markdown，不要解释。",
    "JSON 结构：{\"title\":\"文档标题\",\"overview\":\"今日概览，一段话\",\"items\":[{\"title\":\"分点标题\",\"mainContent\":\"主要内容\",\"sourceUrls\":[\"https://...\"]}],\"transcript\":\"清理后的完整转录\"}。",
    "要求：每个早报分点都要有独立标题和主要内容；来源链接只使用材料中出现过的 URL；保留完整转录；删除口播寒暄之外的重复字幕碎片。",
    "",
    `视频标题：${input.title}`,
    `发布者：${input.author}`,
    `发布时间：${input.publishedAt}`,
    `视频链接：${input.url}`,
    `材料中的来源链接：${sourceUrls.join("\n") || "无"}`,
    "",
    "视频简介：",
    input.description || "无",
    "",
    "转录内容：",
    input.transcript
  ].join("\n");

  try {
    let payload: Record<string, unknown>;
    try {
      payload = await requestMimoChatCompletion(apiKey, prompt, true);
    } catch (firstError) {
      if (!shouldRetryMimoWithoutJsonFormat(firstError)) throw firstError;
      payload = await requestMimoChatCompletion(apiKey, prompt, false);
    }
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : null;
    const message = firstChoice?.message && typeof firstChoice.message === "object" ? firstChoice.message as Record<string, unknown> : null;
    const content = typeof message?.content === "string" ? message.content : "";
    const parsed = parseMimoJsonPayload(content);
    if (!parsed) throw new Error("Mimo response is not valid JSON.");
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeInformationDocumentItem).filter((item): item is InformationDocumentItem => Boolean(item))
      : [];
    const document: InformationPreparedDocument = {
      status: "available",
      provider: "mimo",
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : input.title,
      overview: typeof parsed.overview === "string" ? parsed.overview.trim() : fallback.overview,
      items: items.length ? items : fallback.items,
      transcript: typeof parsed.transcript === "string" && parsed.transcript.trim() ? parsed.transcript.trim() : input.transcript,
      message: "已通过 Mimo 整理转录内容。"
    };
    await fs.writeFile(path.join(input.workDir, "mimo-document.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8").catch(() => undefined);
    return document;
  } catch {
    return {
      ...fallback,
      message: "Mimo 整理暂时不可用，已使用本地规则整理。"
    };
  }
}

export async function readInformationToolStatus(): Promise<InformationToolStatus[]> {
  const tools: Array<{ id: InformationToolStatus["id"]; name: string; command: string; args: string[]; missingMessage: string }> = [
    { id: "yt-dlp", name: "视频下载", command: "yt-dlp", args: ["--version"], missingMessage: "未检测到视频下载工具。" },
    { id: "ffmpeg", name: "音频处理", command: "ffmpeg", args: ["-version"], missingMessage: "未检测到音频处理工具。" },
    { id: "whisper", name: "语音转写", command: "whisper", args: ["--help"], missingMessage: "未检测到本地转写工具。" }
  ];

  const runtimeTools = await Promise.all(tools.map(async (tool) => {
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
  return [
    ...runtimeTools,
    {
      id: "mimo",
      name: "内容整理",
      available: Boolean(readMimoApiKey()),
      version: readMimoApiKey() ? readMimoModel() : "",
      message: readMimoApiKey() ? "Mimo 已配置。" : "未配置 Mimo 密钥，将使用本地规则整理。"
    }
  ];
}
