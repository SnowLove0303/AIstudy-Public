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
const controller = read("electron/mcp/controller.ts");
const remote = read("electron/mcp/remoteAccess.ts");
const main = read("electron/main.ts");
const toolIndex = read(".claude/skills/aistudy-mcp-access/references/tool-index.md");
const workflows = read(".claude/skills/aistudy-mcp-access/references/workflows.md");
const quickstart = read("docs/mcp/AIstudy-MCP-quickstart.md");

assertContains(server, 'name: "read_node_context"', "stdio MCP server must expose read_node_context.");
assertContains(server, 'if (name === "read_node_context") return readNodeContext(runtime, args);', "stdio MCP server must route read_node_context.");
assertContains(controller, '| "read_node_context"', "in-app MCP tool id union must include read_node_context.");
assertContains(controller, 'id: "read_node_context"', "in-app MCP tool list must include read_node_context.");
assertContains(controller, 'tool.id === "read_node_context"', "in-app MCP controller must dispatch read_node_context.");
assertContains(main, 'async function readMcpNodeContext', "main process must implement readMcpNodeContext.");
assertContains(main, 'if (toolId === "read_node_context") return readMcpNodeContext(args);', "main process must route read_node_context.");
assertContains(remote, '"read_node_context"', "remote MCP allow-list must include read_node_context.");
assertContains(remote, '/context$', "remote HTTP route must expose node context.");
assertContains(toolIndex, "`read_node_context`", "skill tool index must document read_node_context.");
assertContains(workflows, "read_node_context({ courseId, nodeId })", "skill workflows must prefer read_node_context.");
assertContains(quickstart, "`read_node_context`", "MCP quickstart must document read_node_context.");

console.log("validate-mcp-node-context: ok");
