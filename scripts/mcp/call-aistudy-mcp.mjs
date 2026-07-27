#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const serverPath = path.join(__dirname, "aistudy-mcp-server.mjs");
const DEFAULT_TIMEOUT_MS = 30000;
const EDIT_TOOLS = new Set([
  "create_course",
  "rename_course",
  "move_course",
  "delete_course",
  "create_course_section",
  "rename_course_section",
  "move_course_section",
  "delete_course_section",
  "append_mindmap_node",
  "create_mindmap_node",
  "update_mindmap_node_text",
  "move_mindmap_node",
  "delete_mindmap_node",
  "update_mindmap_node_style",
  "update_mindmap_layout",
  "write_node_document",
  "append_node_document",
  "format_node_document",
  "update_node_document_style",
  "chrome_port_open_page"
]);

function printUsageAndExit() {
  console.error(`Usage:
  '{"ref":"aistudy://node/...","documentMode":"text"}' | node scripts/mcp/call-aistudy-mcp.mjs --tool read_node_context --args-stdin
  node scripts/mcp/call-aistudy-mcp.mjs --tool read_node_context --args-file "F:\\path\\arguments.json"
  node scripts/mcp/call-aistudy-mcp.mjs --tool read_node_context --args-json "{\\"ref\\":\\"aistudy://node/...\\",\\"documentMode\\":\\"text\\"}"
  node scripts/mcp/call-aistudy-mcp.mjs --ref "aistudy://node/..." --max-depth 4 --max-nodes 120
  node scripts/mcp/call-aistudy-mcp.mjs --tool search_nodes --course-id "..." --query "keyword"
  node scripts/mcp/call-aistudy-mcp.mjs --session

Session input (one JSON object per line):
  {"tool":"read_node_context","arguments":{"ref":"aistudy://node/..."}}

Notes:
  In PowerShell, prefer: $args | ConvertTo-Json -Compress | node ... --args-stdin
  --args-file and --args-stdin avoid native-command quote rewriting for complex JSON.
  Use only one of --args-json, --args-file, or --args-stdin.
  Standard MCP clients and --session keep one server process and MySQL pool alive across calls.
  One-shot CLI calls are intended for diagnostics and shell scripts.
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
  if (argv.includes("--session") && argv.includes("--args-stdin")) {
    throw new Error("--session and --args-stdin cannot share standard input.");
  }
  const parsed = {
    tool: "read_node_context",
    arguments: {},
    timeoutMs: DEFAULT_TIMEOUT_MS,
    session: false,
    argumentsSource: null
  };

  const setArguments = (source, value) => {
    if (parsed.argumentsSource) {
      throw new Error(`Use only one arguments source. Already using ${parsed.argumentsSource}; cannot also use ${source}.`);
    }
    parsed.argumentsSource = source;
    parsed.arguments = value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") printUsageAndExit();
    if (arg === "--session") {
      parsed.session = true;
      continue;
    }
    if (arg === "--tool") {
      parsed.tool = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--args-json") {
      const value = takeValue(argv, index, arg);
      try {
        setArguments(arg, JSON.parse(value));
      } catch (error) {
        throw new Error(
          `--args-json is not valid JSON after shell argument parsing. In PowerShell, pipe ConvertTo-Json output to --args-stdin or use --args-file. ${error instanceof Error ? error.message : String(error)}`
        );
      }
      index += 1;
      continue;
    }
    if (arg === "--args-file") {
      const filePath = path.resolve(takeValue(argv, index, arg));
      setArguments(arg, JSON.parse(readFileSync(filePath, "utf8")));
      index += 1;
      continue;
    }
    if (arg === "--args-stdin") {
      setArguments(arg, JSON.parse(readFileSync(0, "utf8")));
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
    if (arg === "--course-name") {
      parsed.arguments.courseName = takeValue(argv, index, arg);
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
    if (arg === "--node-query") {
      parsed.arguments.nodeQuery = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--query") {
      parsed.arguments.query = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--scope") {
      parsed.arguments.scope = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--mode") {
      parsed.arguments.mode = takeValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--max-chars") {
      parsed.arguments.maxChars = Number.parseInt(takeValue(argv, index, arg), 10);
      index += 1;
      continue;
    }
    if (arg === "--include-descendants") {
      parsed.arguments.includeDescendants = true;
      continue;
    }
    if (arg === "--no-ancestors") {
      parsed.arguments.includeAncestors = false;
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
  if (!parsed.arguments || Array.isArray(parsed.arguments) || typeof parsed.arguments !== "object") {
    throw new Error("MCP tool arguments must be a JSON object.");
  }
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
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });

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
    resolveExit({ code, signal });
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

  function close(force = false) {
    child.stdin.end();
    if (force && child.exitCode === null && !child.killed) child.kill();
  }

  return {
    request,
    close,
    exited,
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
  let sessionHadEdit = false;
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "aistudy-line-jsonrpc-client", version: "1.0.0" }
    });

    const call = async (tool, argumentsValue) => {
      const response = await client.request("tools/call", {
        name: tool,
        arguments: argumentsValue
      });
      if (response.error) {
        throw new Error(response.error.message || JSON.stringify(response.error));
      }
      return response;
    };

    if (options.session) {
      const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
      for await (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const input = JSON.parse(line);
          const tool = typeof input?.tool === "string" ? input.tool : "";
          const argumentsValue = input?.arguments && typeof input.arguments === "object" ? input.arguments : {};
          if (!tool) throw new Error("Session request requires tool.");
          if (EDIT_TOOLS.has(tool)) sessionHadEdit = true;
          const response = await call(tool, argumentsValue);
          const output = response?.result?.structuredContent ?? JSON.parse(readToolText(response) || "null");
          console.log(JSON.stringify({ ok: true, tool, result: output }));
        } catch (error) {
          console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      }
    } else {
      const response = await call(options.tool, options.arguments);
      const structured = response?.result?.structuredContent;
      const text = readToolText(response);
      if (structured) {
        console.log(JSON.stringify(structured, null, 2));
      } else if (text) {
        console.log(text);
      } else {
        console.log(JSON.stringify(response.result ?? response, null, 2));
      }
    }
  } catch (error) {
    const stderr = client.getStderr();
    console.error(error instanceof Error ? error.message : String(error));
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    const forceClose = options.session ? !sessionHadEdit : !EDIT_TOOLS.has(options.tool);
    client.close(forceClose);
    if (!forceClose) {
      await Promise.race([
        client.exited,
        new Promise((resolve) => setTimeout(resolve, 2000))
      ]);
    }
  }
}

main();
