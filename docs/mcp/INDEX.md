# AIstudy MCP 文档索引

## 标准 Skill

- Agent 接入入口：`.claude/skills/aistudy-mcp-access/SKILL.md`
- Skill 索引：`.claude/skills/aistudy-mcp-access/references/index.md`
- 工具清单：`.claude/skills/aistudy-mcp-access/references/tool-index.md`
- 同步检查表：`.claude/skills/aistudy-mcp-access/references/sync-checklist.md`

后续 MCP 工具、权限、连接方式、prompts、resources 或文档安全规则变化时，必须同步更新 `aistudy-mcp-access` skill。

## 人类阅读文档

- `AIstudy-MCP-access-skill.md`：完整接入说明，可直接发给另一台 Codex/Claude Code。
- `AIstudy-MCP-quickstart.md`：新手快速接入。
- `AIstudy-MCP-tailscale-access.md`：Tailscale 内网访问说明。
- `AIstudy-MCP-module-boundary.md`：MCP 模块边界和开发约束。

## 运行时代码入口

- `electron/mcp/controller.ts`：应用内 MCP 控制器和工具定义。
- `electron/mcp/remoteAccess.ts`：HTTP/Tailscale 远程访问、权限和调用监控。
- `electron/main.ts`：MCP 工具的主进程实现。
- `scripts/mcp/aistudy-mcp-server.mjs`：外部 stdio MCP server。
