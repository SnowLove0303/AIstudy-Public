# Claude Code Setup

## Install The Skill

Choose one location:

- One project: `<project>\.claude\skills\aistudy-mcp-access\`
- All local projects: `<user-profile>\.claude\skills\aistudy-mcp-access\`

Copy the whole `aistudy-mcp-access` folder so `SKILL.md` is directly inside that folder. Do not add an extra nested directory.

Claude Code discovers project Skills from `.claude/skills/` and personal Skills from the user profile. Confirm discovery with `/skills`, or invoke `/aistudy-mcp-access` directly. If the top-level skills directory was created after Claude Code started and does not appear, restart Claude Code once.

The Skill teaches Claude how to use AIstudy; it does not create the MCP connection by itself.

## Prefer HTTP For Another Machine

Create a project `.mcp.json` or equivalent user-scoped configuration:

```json
{
  "mcpServers": {
    "aistudy": {
      "type": "http",
      "url": "${AISTUDY_MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${AISTUDY_MCP_TOKEN}"
      }
    }
  }
}
```

Define the two environment variables before starting Claude Code:

```powershell
$env:AISTUDY_MCP_URL = "http://<tailscale-name-or-ip>:6188/mcp"
$env:AISTUDY_MCP_TOKEN = "<token-copied-from-AIstudy>"
claude
```

Do not put a real bearer token in the Skill, a repository, screenshots, logs, or chat history. Project-scoped `.mcp.json` requires workspace trust before Claude Code starts the server.

## Use stdio On The AIstudy Machine

Example `.mcp.json`:

```json
{
  "mcpServers": {
    "aistudy": {
      "type": "stdio",
      "command": "node",
      "args": [
        "F:\\XIANGMU\\AIstudy-public\\scripts\\mcp\\aistudy-mcp-server.mjs"
      ],
      "env": {
        "AISTUDY_PUBLIC_DATA_ROOT": "F:\\XIANGMU\\AIstudy-public\\.runtime",
        "AISTUDY_APP_ROOT": "F:\\XIANGMU\\AIstudy-public",
        "AISTUDY_MCP_ALLOW_EDIT": "0"
      }
    }
  }
}
```

Keep `AISTUDY_MCP_ALLOW_EDIT=0` for ordinary reading. When editing is explicitly approved, prefer narrow allowlists:

```text
AISTUDY_MCP_ALLOWED_EDIT_TOOLS=append_node_document,format_node_document
AISTUDY_MCP_ALLOWED_COURSE_IDS=<full-course-id>
AISTUDY_MCP_ALLOWED_NODE_IDS=<full-node-id>
```

Changing `.mcp.json` or its environment block does not update an already running stdio server. After any permission change, disconnect and reconnect `aistudy` from `/mcp`, or restart Claude Code. Call `mcp_get_started` through the reconnected session and trust its `safety.editPolicy`; `claude mcp get`, the JSON file, and a one-shot helper show saved or diagnostic state only.

## Verify Claude Code

Run:

```powershell
claude mcp list
claude mcp get aistudy
```

Then open `/mcp` inside Claude Code. The server must show connected and expose tools. Start the first AIstudy task with:

```text
Use /aistudy-mcp-access. Call aistudy.mcp_get_started once, stay read-only, and resolve the exact target before reading.
```

HTTP connections can reconnect after transient failures. A failed local stdio process is not automatically restarted; reconnect it from `/mcp` or restart Claude Code after fixing the cause.

## Claude Code Windows Notes

- Use MCP tool calls directly after connection; do not shell-wrap every call.
- The bundled `call-aistudy-mcp.mjs` helper is for diagnostics and scripts.
- In PowerShell helper calls, pipe complex JSON through `--args-stdin` or use an F-drive UTF-8 file with `--args-file`.
- Do not pass complex objects through inline `--args-json`; PowerShell may consume the quotes before Node receives them.
- A normal Claude Code MCP session is already long-running. Do not start a new helper process for each read.
