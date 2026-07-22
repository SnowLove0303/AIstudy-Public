import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

const server = read("scripts/mcp/aistudy-mcp-server.mjs");
const lineClient = read("scripts/mcp/call-aistudy-mcp.mjs");
const controller = read("electron/mcp/controller.ts");
const remote = read("electron/mcp/remoteAccess.ts");
const main = read("electron/main.ts");
const connection = read(".claude/skills/aistudy-mcp-access/references/connection.md");
const toolIndex = read(".claude/skills/aistudy-mcp-access/references/tool-index.md");
const workflows = read(".claude/skills/aistudy-mcp-access/references/workflows.md");
const quickstart = read("docs/mcp/AIstudy-MCP-quickstart.md");
const accessSkillDoc = read("docs/mcp/AIstudy-MCP-access-skill.md");

assertContains(server, 'name: "read_node_context"', "stdio MCP server must expose read_node_context.");
assertContains(server, 'if (name === "read_node_context") return readNodeContext(runtime, args);', "stdio MCP server must route read_node_context.");
assertContains(server, 'buffer.indexOf("\\n")', "stdio MCP server must remain line-delimited JSON-RPC.");
assertContains(lineClient, "line-delimited JSON-RPC", "local MCP helper must document the line-delimited protocol.");
assertContains(lineClient, 'child.stdin.write(`${JSON.stringify(payload)}\\n`, "utf8");', "local MCP helper must send one JSON-RPC object per line.");
assertContains(lineClient, 'client.request("tools/call"', "local MCP helper must call MCP tools through tools/call.");
assertContains(controller, '| "read_node_context"', "in-app MCP tool id union must include read_node_context.");
assertContains(controller, 'id: "read_node_context"', "in-app MCP tool list must include read_node_context.");
assertContains(controller, 'tool.id === "read_node_context"', "in-app MCP controller must dispatch read_node_context.");
assertContains(main, 'async function readMcpNodeContext', "main process must implement readMcpNodeContext.");
assertContains(main, 'if (toolId === "read_node_context") return readMcpNodeContext(args);', "main process must route read_node_context.");
assertContains(remote, '"read_node_context"', "remote MCP allow-list must include read_node_context.");
assertContains(remote, '/context$', "remote HTTP route must expose node context.");
assertContains(remote, 'message = hasError ? getJsonRpcErrorMessage(result) : "MCP 调用完成";', "remote MCP must keep JSON-RPC error details in the response body.");
assertContains(remote, "normalizeRemoteHttpErrorMessage", "remote MCP must sanitize malformed HTTP/JSON-RPC request errors.");
assertContains(remote, 'error: { code: -32603, message }', "remote MCP must return JSON-RPC errors instead of raw HTTP errors for /mcp.");
assertContains(toolIndex, "`read_node_context`", "skill tool index must document read_node_context.");
assertContains(toolIndex, "Do not use `Content-Length` MCP framing", "skill tool index must warn against Content-Length framing for local stdio.");
assertContains(connection, "line-delimited JSON-RPC", "connection guide must document local stdio line-delimited JSON-RPC.");
assertContains(connection, "call-aistudy-mcp.mjs", "connection guide must point agents to the reusable local MCP helper.");
assertContains(workflows, "read_node_context({ courseId, nodeId })", "skill workflows must prefer read_node_context.");
assertContains(workflows, "call-aistudy-mcp.mjs", "skill workflows must mention the local MCP helper.");
assertContains(quickstart, "`read_node_context`", "MCP quickstart must document read_node_context.");
assertContains(quickstart, "line-delimited JSON-RPC", "MCP quickstart must document local stdio protocol.");
assertContains(quickstart, "call-aistudy-mcp.mjs", "MCP quickstart must mention the local MCP helper.");
assertContains(accessSkillDoc, "line-delimited JSON-RPC", "single-file MCP access doc must document local stdio protocol.");
assertContains(accessSkillDoc, "call-aistudy-mcp.mjs", "single-file MCP access doc must mention the local MCP helper.");

console.log("validate-mcp-node-context: ok");
