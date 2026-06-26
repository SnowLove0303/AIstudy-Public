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

## First Probe

After connecting:

1. `mcp_get_started`
2. `read_courses`
3. `mcp_resolve_target`
4. Continue with the workflow-specific read or edit tools.
