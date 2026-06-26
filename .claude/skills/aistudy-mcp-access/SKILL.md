---
name: aistudy-mcp-access
description: Use when Codex, Claude Code, Cursor, or another AI assistant needs to connect to AIstudy MCP over local stdio, HTTP, or Tailscale LAN; read/search AIstudy knowledge bases, operate mind maps or node documents, open fixed Chrome ports, or update the AIstudy MCP skill/docs after MCP tools, permissions, or connection behavior changes.
---

# AIstudy MCP Access

## Core Rule

Treat AIstudy MCP as a full-library knowledge system, not as the user's currently selected UI page. Always discover the target first, then read, then edit only with explicit permission.

## Reference Index

Read only the reference needed for the current task:

- `references/index.md`: canonical file map, maintenance ownership, and update order.
- `references/connection.md`: HTTP/Tailscale and local stdio connection examples.
- `references/tool-index.md`: current MCP tool groups, permission model, and safety notes.
- `references/workflows.md`: standard read, search, edit, document, locator, and Chrome-port workflows.
- `references/sync-checklist.md`: required checklist whenever MCP tools, permissions, prompts, or docs change.

For ordinary MCP use, start with `connection.md` only if connection details are missing, then `workflows.md`. For tool availability or permissions, read `tool-index.md`. For development work that changes MCP behavior, read `sync-checklist.md` before editing.

## First Use

1. Collect the connection shape.
   - HTTP/Tailscale: MCP URL, optional API URL, `Authorization: Bearer ...`.
   - Local stdio: server script path, data root, app root, and edit flag.
2. Start read-only.
   - Call `mcp_get_started`.
   - Call `read_courses`.
   - Use `mcp_resolve_target` before reading or editing a specific knowledge base.
3. Read before editing.
   - Use exact `courseId`.
   - For node documents, use exact `nodeId`.
   - After every edit, re-read the affected course, node, or document.

## Safety Defaults

- Do not invent `courseId`, `mindMapId`, `nodeId`, tokens, or local paths.
- Do not infer the MCP target from the visible AIstudy UI selection.
- Keep remote endpoints read-only until the user explicitly allows edits and AIstudy settings expose the relevant permission group.
- Prefer append/style-specific tools over whole-document replacement.
- Use destructive tools only after explicit user confirmation.

## Document Editing Rules

- Use `write_node_document` only for new content or explicit whole-document replacement with `replaceExisting: true`.
- Use `append_node_document` for additions.
- Use `format_node_document` only for style cleanup that preserves every editor element `value` exactly.
- Use `update_node_document_style` only for simple full-document style changes.
- Do not call `write_node_document` merely to fix formatting.

## When MCP Changes

When MCP tools, permissions, prompts, resources, HTTP routes, or connection instructions change, update this skill in the same change set. Follow `references/sync-checklist.md`, then run the skill validator.
