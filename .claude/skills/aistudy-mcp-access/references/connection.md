# AIstudy MCP Connection

## Tailscale / HTTP

In AIstudy, open:

```text
设置 -> MCP 控制台 -> 内网访问
```

Enable LAN access and copy:

```text
MCP URL: ...
API URL: ...
Authorization: Bearer ...
```

The client device must be in the same Tailscale network. The AIstudy host must keep the app open and LAN access enabled.

Example client config:

```json
{
  "mcpServers": {
    "aistudy": {
      "type": "http",
      "url": "http://<tailscale-name-or-ip>:6188/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

## Local stdio

Use stdio for same-machine access:

```json
{
  "mcpServers": {
    "aistudy": {
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

Set `AISTUDY_MCP_ALLOW_EDIT=1` only for explicitly approved editing work.

### Local stdio transport rule

`scripts/mcp/aistudy-mcp-server.mjs` is line-delimited JSON-RPC over stdio. Send exactly one JSON-RPC object followed by `\n`, and read responses as one JSON object per line.

Do not use `Content-Length` framing with this local script. If a custom client hangs after `initialize`, stop it and switch to line-delimited JSON-RPC.

For one-off local reads, use the bundled helper:

```powershell
node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --ref "aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1"
```

Prefer direct flags on Windows instead of shell-escaped `--args-json`:

```powershell
node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --tool mcp_resolve_target --course-name "Pynes" --node-query "目标节点"
```

For node searches, pass the search term without JSON shell escaping:

```powershell
node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --tool search_nodes --course-id "<full-course-id>" --query "目标节点"
```

For multiple calls, keep one server process and MySQL pool alive:

```powershell
@(
  '{"tool":"read_node_context","arguments":{"ref":"aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1"}}'
  '{"tool":"read_node_document","arguments":{"ref":"aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1","mode":"text"}}'
) | node F:\XIANGMU\AIstudy-public\scripts\mcp\call-aistudy-mcp.mjs --session
```

The one-shot form intentionally starts and stops one server and is for diagnostics. Normal MCP clients and `--session` are the high-frequency paths.

## First Probe

After connecting:

1. `mcp_get_started`
2. `read_courses`
3. `mcp_resolve_target`
4. Continue with the workflow-specific read or edit tools.
