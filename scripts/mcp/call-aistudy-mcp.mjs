#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const serverPath = path.join(__dirname, "aistudy-mcp-server.mjs");
const DEFAULT_TIMEOUT_MS = 30000;

function printUsageAndExit() {
  console.error(`Usage:
  node scripts/mcp/call-aistudy-mcp.mjs --tool read_node_context --args-json "{\\"ref\\":\\"aistudy://node/...\\",\\"documentMode\\":\\"text\\"}"
  node scripts/mcp/call-aistudy-mcp.mjs --ref "aistudy://node/..." --max-depth 4 --max-nodes 120

Notes:
  This client talks to scripts/mcp/aistudy-mcp-server.mjs with one JSON-RPC object per line.
  Do not use Content-Length framing with this local stdio server.`);
  process.exit(2);
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  const parsed = {
    tool: "read_node_context",
    arguments: {},
    timeoutMs: DEFAULT_TIMEOUT_MS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") printUsageAndExit();
    if (arg === "--tool") {
      parsed.tool = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--args-json") {
      const value = takeValue(argv, index, arg);
      parsed.arguments = JSON.parse(value);
      index += 1;
      continue;
    }
    if (arg === "--ref") {
      parsed.arguments.ref = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--course-id") {
      parsed.arguments.courseId = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--mindmap-id") {
      parsed.arguments.mindMapId = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--node-id") {
      parsed.arguments.nodeId = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--document-mode") {
      parsed.arguments.documentMode = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--max-depth") {
      parsed.arguments.maxDepth = Number.parseInt(takeValue(argv, index, arg), 10);
      index += 1;
      continue;
    }
    if (arg === "--max-nodes") {
      parsed.arguments.maxNodes = Number.parseInt(takeValue(argv, index, arg), 10);
      index += 1;
      continue;
    }
    if (arg === "--max-document-chars") {
      parsed.arguments.maxDocumentChars = Number.parseInt(takeValue(argv, index, arg), 10);
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = Number.parseInt(takeValue(argv, index, arg), 10);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!parsed.tool) throw new Error("--tool is required.");
  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 1000) {
    throw new Error("--timeout-ms must be at least 1000.");
  }
  return parsed;
}

function createLineJsonRpcClient(timeoutMs) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AISTUDY_APP_ROOT: process.env.AISTUDY_APP_ROOT || projectRoot,
      AISTUDY_PUBLIC_DATA_ROOT: process.env.AISTUDY_PUBLIC_DATA_ROOT || path.join(projectRoot, ".runtime"),
      AISTUDY_MCP_ALLOW_EDIT: process.env.AISTUDY_MCP_ALLOW_EDIT || "0"
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });

  let nextId = 1;
  let stdoutBuffer = "";
  let stderrBuffer = "";
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    let newlineIndex = stdoutBuffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      newlineIndex = stdoutBuffer.indexOf("\n");
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const request = pending.get(message.id);
      if (!request) continue;
      clearTimeout(request.timer);
      pending.delete(message.id);
      request.resolve(message);
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
  });

  child.on("exit", (code, signal) => {
    const error = new Error(`AIstudy MCP server exited before completing the request. code=${code ?? ""} signal=${signal ?? ""}`);
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  });

  function request(method, params = {}) {
    if (child.killed || child.exitCode !== null) {
      return Promise.reject(new Error("AIstudy MCP server is not running."));
    }
    const id = nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`AIstudy MCP request timed out after ${timeoutMs}ms. Local stdio uses line-delimited JSON-RPC, not Content-Length framing.`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify(payload)}\n`, "utf8");
    });
  }

  function close() {
    child.stdin.end();
    if (child.exitCode === null && !child.killed) child.kill();
  }

  return {
    request,
    close,
    getStderr: () => stderrBuffer.trim()
  };
}

function readToolText(response) {
  const text = response?.result?.content?.find?.((item) => item?.type === "text")?.text;
  return typeof text === "string" ? text : "";
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = createLineJsonRpcClient(options.timeoutMs);
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "aistudy-line-jsonrpc-client", version: "1.0.0" }
    });

    const response = await client.request("tools/call", {
      name: options.tool,
      arguments: options.arguments
    });

    if (response.error) {
      throw new Error(response.error.message || JSON.stringify(response.error));
    }

    const text = readToolText(response);
    if (text) {
      console.log(text);
    } else {
      console.log(JSON.stringify(response.result ?? response, null, 2));
    }
  } catch (error) {
    const stderr = client.getStderr();
    console.error(error instanceof Error ? error.message : String(error));
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

main();
