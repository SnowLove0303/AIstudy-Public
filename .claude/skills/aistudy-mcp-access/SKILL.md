---
name: "aistudy-mcp-access"
description: "Connect Claude Code, Codex, Cursor, or another AI assistant to an AIstudy MCP endpoint over local stdio, HTTP, or Tailscale LAN access; discover, read, search, and only edit with explicit permission."
---

# AIstudy MCP Access

Use this skill when connecting Claude Code, Codex, Cursor, or another AI assistant to an AIstudy MCP endpoint over local stdio, HTTP, or Tailscale LAN access.

## Core Rule

Treat AIstudy MCP as a full-library knowledge system, not as the user's currently selected UI page. Always discover the target first, then read, then edit only with explicit permission.

## Workflow

1. Collect the connection shape.
   - HTTP/Tailscale: MCP URL, optional API URL, `Authorization: Bearer ...`.
   - Local stdio: server script path, data root, app root, and edit flag.
2. Verify reachability before doing useful work.
   - HTTP: confirm the host is reachable and the token is present.
   - stdio: confirm Node.js can run the server script and the AIstudy data root exists.
3. Start read-only.
   - Call `mcp_get_started`.
   - Call `read_courses`.
   - Resolve a target with `mcp_resolve_target` before reading a specific knowledge base.
4. Read in this order.
   - `read_current_mindmap` with `courseId` for the target knowledge base.
   - `search_nodes` with `courseId` and the user's keyword.
   - `list_node_documents`, then `read_node_document` for node-bound documents.
5. Edit only when the user has clearly allowed it.
   - Confirm the remote edit permission group is enabled in AIstudy settings.
   - Use exact `courseId` and, for document edits, exact `nodeId`.
   - Prefer append/update tools over destructive tools.
   - After editing, re-read the affected course/node/document.

## Safety Defaults

- Do not invent `courseId`, `nodeId`, or local paths.
- Do not rely on the AIstudy UI selected course.
- Do not use destructive tools unless the user explicitly asks.
- If the endpoint is remote, assume read-only until settings say otherwise.
- If a request lacks a target, call `mcp_resolve_target` or ask for the knowledge base name.

## Connection Information To Collect From AIstudy

In AIstudy, open:

```text
设置 -> MCP 控制台 -> 内网访问
```

After enabling it, copy:

```text
MCP URL: ...
API URL: ...
Authorization: Bearer ...
```

The other device must be logged in to the same Tailscale network. The AIstudy host machine must keep the app open and keep LAN access enabled.

## Recommended Prompt

```text
请按下面这份 AIstudy MCP 接入说明操作。先只读，不要编辑，除非我明确允许。

MCP URL: ...
API URL: ...
Authorization: Bearer ...

第一步调用 mcp_get_started，然后 read_courses，再用 mcp_resolve_target 确认目标知识库。
```

## HTTP MCP Configuration Example

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

## Local stdio Configuration Example

For same-machine use, local stdio can be used:

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

Set `AISTUDY_MCP_ALLOW_EDIT=1` only when editing is explicitly requested.

## First-Use Order

1. `mcp_get_started`: confirm service, permissions, and data state.
2. `read_courses`: read the full library list.
3. `mcp_resolve_target`: resolve the target by knowledge-base name, course ID, or keyword.
4. `read_current_mindmap`: read the specified knowledge-base mindmap.
5. `search_nodes`: search nodes.
6. `list_node_documents`: list node documents.
7. `read_node_document`: read a node document.

## Tool Groups

Read-only:

- `mcp_get_started`
- `mcp_plan_task`
- `mcp_resolve_target`
- `read_courses`
- `read_current_mindmap`
- `search_nodes`
- `list_node_documents`
- `read_node_document`
- `health_check`

Knowledge-base and section management:

- `create_course`
- `rename_course`
- `move_course`
- `delete_course`
- `create_course_section`
- `rename_course_section`
- `move_course_section`
- `delete_course_section`

Mindmap editing:

- `create_mindmap_node`
- `append_mindmap_node`
- `update_mindmap_node_text`
- `move_mindmap_node`
- `delete_mindmap_node`
- `update_mindmap_node_style`
- `update_mindmap_layout`

Document editing:

- `write_node_document`
- `append_node_document`
- `update_node_document_style`

## Edit Permissions

Remote MCP is read-only by default. To edit, enable the relevant permissions in AIstudy settings:

- 远程编辑
- 知识库管理
- 导图编辑
- 文档写入
- 删除操作

Editing must include an exact target knowledge-base `courseId`. Document editing must also include an exact `nodeId`. Destructive operations need separate confirmation.

## Common Issues

- TCP timeout: AIstudy is not open, LAN access is not enabled, Tailscale is offline, or port `6188` is not exposed.
- 401/403: token is wrong, or the request header lacks `Authorization`.
- Can read but cannot write: remote edit permissions are not enabled; this is the default safe state.
- `dataRootExists=false`: the local data-root path is wrong.
- `MCP requires an explicit knowledge base`: edit call did not pass `courseId`.
- Target knowledge base cannot be found: call `read_courses` and `mcp_resolve_target`; do not guess IDs.

## Response Style

Prefer replying with knowledge-base names and node titles. Include `courseId` and `nodeId` only when another tool call needs those exact IDs.
