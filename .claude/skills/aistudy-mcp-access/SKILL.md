---
name: aistudy-mcp-access
description: Connect Claude Code or another AI assistant to AIstudy MCP and safely read, search, or edit knowledge bases, mind maps, and node documents. Use for AIstudy MCP setup, compact aistudy:// refs, complete long-document reads, Chinese document formatting, version-safe writes, permission diagnosis, or MCP workflow maintenance.
---

# AIstudy MCP Access

## Non-Negotiable Contract

- Treat AIstudy MCP as a full-library system. Never infer the target from the currently visible AIstudy page.
- A compact `aistudy://node/...` ref is a valid target input. Otherwise resolve an exact knowledge base and node before reading or editing.
- Start read-only. Edit only when the user explicitly requests a write and the effective MCP policy allows that exact tool, course, and node.
- Never treat truncated text as complete, a successful document save as RAG synchronization, or a generic stored title as the effective node-document title.
- Preserve Windows/UNC paths, tool names, field names, IDs, refs, JSON, command switches, scripts, code, and formulas exactly.

## Reference Index

Read only the reference needed for the current task:

- `references/codex.md`: install or repair the Skill and local stdio MCP connection for Codex.
- `references/claude-code.md`: install the Skill and connect Claude Code without storing credentials in it.
- `references/index.md`: canonical file map, maintenance ownership, and update order.
- `references/connection.md`: HTTP/Tailscale and local stdio connection examples.
- `references/tool-index.md`: current MCP tool groups, permission model, and safety notes.
- `references/workflows.md`: standard read, search, edit, document, locator, and Chrome-port workflows.
- `references/sync-checklist.md`: required checklist whenever MCP tools, permissions, prompts, or docs change.

For Codex setup or repair, read `codex.md`. For Claude Code setup, read `claude-code.md`. For an already connected client, read `workflows.md`; add `tool-index.md` only when schemas or permissions matter. For MCP development, read `sync-checklist.md` before editing.

## Choose The Lowest-Cost Path

1. Probe once per MCP session with `mcp_get_started`; do not repeat health and library discovery before every tool call.
2. If a compact ref exists:
   - Metadata/path only: `read_node_context({ ref, documentMode: "none" })`.
   - Body needed: `read_node_context({ ref, documentMode: "text" })`.
   - One document only: `read_node_document({ ref, mode: "text", offset: 0 })`.
3. If no compact ref exists:
   - `read_courses` once, then `mcp_resolve_target({ courseName, nodeQuery })`.
   - Do not continue while the result is empty or ambiguous.
4. Request descendants, full document text, or editor snapshots only when the task requires them.
5. For multiple helper calls, use `--session`; normal Claude Code MCP connections already keep a session alive.

## Read Completion

- `read_node_document({ mode: "text" })`: continue with the exact `requiredNextCall` until `complete: true`.
- `read_node_context({ documentMode: "text" })`: execute every `completion.requiredNextCalls` entry until `completion.complete: true`.
- `documentMode: "full"` is atomic but bounded. If it exceeds the aggregate safety cap, narrow the node range or page documents individually.
- Use `mode: "snapshot"` only when editor JSON is required for an edit. Use `mode: "audit"` only for extraction/integrity diagnosis.
- If a response is truncated, ambiguous, or says a continuation is required, do not summarize it as a complete document.

## Version-Safe Editing

1. Resolve the exact `courseId`, `mindMapId` when needed, and `nodeId`. Explicit ID fields require full IDs; short prefixes are valid only inside a uniquely resolvable compact ref.
2. Read the latest document and capture `currentSnapshotId`.
3. Choose the narrowest tool:
   - Add content: `append_node_document`.
   - Preserve text and normalize Chinese article styling: `format_node_document`.
   - Change only global font/color/emphasis: `update_node_document_style`.
   - Create content, or explicitly replace the whole document: `write_node_document`.
4. Pass the latest `currentSnapshotId` as `expectedSnapshotId` for every existing-document write. Never retry `DOCUMENT_VERSION_CONFLICT` blindly; re-read, reconcile, then write once.
5. Use `replaceExisting: true` only for an explicitly approved whole-document replacement.
6. Re-read lightweight text/metadata after writing. Compare critical literals and inspect `currentSnapshotId`, `contentHash`, `textLength`, and `ragIndex`.

## Chinese Document Input

- The node name is already the document heading. Do not duplicate it; use `# 标题` only for a distinct article title.
- Use `一、` / `（一）` / `1.` / `（1）` for four heading levels, `> ` for quotations, `字段：内容` for labels, and one natural paragraph per line.
- Blank input lines mark paragraph boundaries; do not create spacing with repeated empty rows or embedded `\n\n`.
- New text receives Chinese fonts, justified body alignment, proportional line spacing, and a two-ideographic-space first-line indent.
- Do not use `write_node_document` merely to repair styling. `format_node_document` is value-preserving and cannot insert missing indent characters or restructure paragraphs.
- Use mind-map tools for real diagrams. Do not store raw Mermaid or whitespace-dependent trees as a substitute for a mind map.

## Exactness And Status Checks

- Treat technical literals as immutable. After a write/read round trip, reject changes such as lost `\`, altered `_`, Unicode subscript/superscript conversion, modified JSON, or changed IDs.
- Use standard mathematical symbols and readable formulas such as `ε`, `δ`, `∞`, `→`, `≤`, `≥`, `x_n`, `x^2`, and `lim_{n→∞}`.
- The effective document `title` may fall back from generic `storedTitle` to `nodeTitle`; inspect `titleSource` when title origin matters.
- `ragIndex.status: "not_configured"` means the snapshot is saved but no vector-index synchronization is verifiable.

## Connection And Permission Rules

- Do not invent tokens, IDs, or local paths, and never store a bearer token in this Skill.
- `read_current_mindmap`, `search_nodes`, and `list_node_documents` require `courseId`; use `scope: "all"` only for an intentional cross-library operation.
- In PowerShell helper calls, send complex objects through `ConvertTo-Json | ... --args-stdin` or `--args-file`; do not depend on `--args-json` quote preservation.
- Local editing can be narrowed with `AISTUDY_MCP_ALLOWED_EDIT_TOOLS`, `AISTUDY_MCP_ALLOWED_COURSE_IDS`, and `AISTUDY_MCP_ALLOWED_NODE_IDS`. Trust `mcp_get_started.safety.editPolicy` as the effective policy.
- Destructive tools require explicit confirmation for the exact target.

## When MCP Changes

When MCP tools, permissions, prompts, resources, HTTP routes, or connection instructions change, update this skill in the same change set. Follow `references/sync-checklist.md`, then run the skill validator.
