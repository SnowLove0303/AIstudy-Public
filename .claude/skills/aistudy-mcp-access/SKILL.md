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
   - Important: `scripts/mcp/aistudy-mcp-server.mjs` uses line-delimited JSON-RPC on stdio: write one JSON object plus `\n`, then read one JSON object per line. Do not use `Content-Length` MCP framing for this local script.
   - For ad-hoc local reads, prefer `node scripts/mcp/call-aistudy-mcp.mjs --ref "aistudy://node/..."` instead of writing a temporary wrapper.
   - For multiple local calls, use `--session` and send one `{ "tool", "arguments" }` JSON object per input line. This keeps one Node process and MySQL pool alive.
2. Start read-only.
   - Call `mcp_get_started`.
   - Call `read_courses`.
   - Use `mcp_resolve_target` before reading or editing a specific knowledge base.
3. Read before editing.
   - If AIstudy copied a compact node ref such as `aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1`, call `read_node_context({ ref })` for lightweight metadata, or add `documentMode: "text"` when body text is needed.
   - Use exact `courseId`.
   - For node documents, use exact `nodeId`.
   - After every edit, re-read the affected course, node, or document.

## Safety Defaults

- Do not invent `courseId`, `mindMapId`, `nodeId`, tokens, or local paths.
- Do not infer the MCP target from the visible AIstudy UI selection.
- `mcp_resolve_target` requires `ref`, `courseId`, `courseName`, or `nodeQuery`; empty resolution is an error.
- `read_current_mindmap`, `search_nodes`, and `list_node_documents` require `courseId`. Pass `scope: "all"` only for an intentional cross-library operation.
- Explicit `courseId`, `mindMapId`, and `nodeId` arguments are full IDs. Short prefixes are supported only inside a compact node ref and must resolve uniquely.
- Keep remote endpoints read-only until the user explicitly allows edits and AIstudy settings expose the relevant permission group.
- Prefer append/style-specific tools over whole-document replacement.
- Use destructive tools only after explicit user confirmation.

## Document Editing Rules

- The node name is already rendered as the document heading. Do not repeat it in the body unless the content has a distinct article title; use `# 标题` only for that explicit article title.
- Use Chinese article hierarchy in text input: `一、` for the first level, `（一）` for the second, `1.` for the third, and `（1）` for the fourth. Use `> ` for quotations, `字段：内容` for labels, and normal bullet or numbered lists where appropriate.
- Put one natural body paragraph on each line. Blank input lines may mark paragraph boundaries, but AIstudy renders paragraph spacing instead of visible blank rows.
- New text written or appended through MCP receives Chinese heading/body fonts, justified body alignment, proportional line spacing, and a two-ideographic-space first-line indent. Safe Chinese-English spacing and Chinese punctuation are normalized while URLs, Windows paths, email addresses, inline/fenced code, formulas, tree indentation, and list markers are protected.
- Use `write_node_document` only for new content or explicit whole-document replacement with `replaceExisting: true`.
- Read `currentSnapshotId` first and pass it as `expectedSnapshotId` for replacement, append, formatting, or style changes. A stale version fails with `DOCUMENT_VERSION_CONFLICT`.
- Use `append_node_document` for additions.
- Do not write raw Mermaid or Markdown fenced blocks into node documents. Use mind map tools for actual mind map structure; if a diagram must appear in a document, convert it to headings, field labels, and stable numbered outlines instead of whitespace-dependent trees.
- For math content, use standard symbols or readable formula text such as `ε`, `δ`, `∞`, `→`, `≤`, `≥`, `x_n`, `x^2`, `lim_{n→∞}`, and `|x_n-a| < ε`; do not leave degraded tokens such as `epsilon`, `infinity`, `->`, or `lim_{n->infinity}` in the final document text.
- Use `format_node_document` only for Chinese-article style cleanup that preserves every editor element `value` exactly. Because it is text-preserving, it does not insert missing first-line indent characters.
- Use `update_node_document_style` only for simple full-document style changes.
- Do not call `write_node_document` merely to fix formatting.

## When MCP Changes

When MCP tools, permissions, prompts, resources, HTTP routes, or connection instructions change, update this skill in the same change set. Follow `references/sync-checklist.md`, then run the skill validator.
