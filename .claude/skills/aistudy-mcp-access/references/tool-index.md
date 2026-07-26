# AIstudy MCP Tool Index

Keep this file synchronized with `electron/mcp/controller.ts`, `electron/mcp/remoteAccess.ts`, and `scripts/mcp/aistudy-mcp-server.mjs`.

## Control And Discovery

- `mcp_get_started`: first call; returns health, scope, safety rules, resources, prompts, and next steps.
- `mcp_plan_task`: turns user intent into ordered MCP calls.
- `mcp_resolve_target`: resolves a compact ref, course, and optional node candidates. Empty targets fail; ambiguous names remain unresolved.
- `health_check`: checks runtime, MySQL, and core tables.
- `copy_config`: in-app helper for copying onboarding config.

## Read Tools

- `read_courses`
- `read_current_mindmap`: requires `courseId`; cross-library summaries require explicit `scope: "all"`.
- `search_nodes`: requires `courseId`; cross-library search requires explicit `scope: "all"` and a non-empty query.
- `list_node_documents`: requires `courseId`; cross-library listing requires explicit `scope: "all"`.
- `read_node_document`: accepts compact `ref` or full `courseId + nodeId`. Default `mode: "text"` returns one cleaned text copy; `mode: "snapshot"` returns editor JSON; `mode: "audit"` returns diagnostic text variants.
- `read_node_context`: preferred node-level read. Default output uses a targeted target-to-root query and includes the target, ancestors, and document metadata without parsing the full mind-map snapshot. Descendants and document body text are opt-in.

## Compact Node References

AIstudy document-copy actions may return a compact node reference such as:

```text
aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1
```

Pass it directly as `{"ref":"..."}` to `read_node_context` for fast structured reads, or to `read_node_document({ ref, mode: "snapshot" })` only when editor JSON is required. The MCP server expands short prefixes only inside compact refs and refuses ambiguous matches instead of guessing. Explicit ID fields require full IDs.

For same-machine CLI access, use `scripts/mcp/call-aistudy-mcp.mjs`. Use `--session` for multiple calls so one process and MySQL pool are reused. Prefer direct flags such as `--course-name`, `--node-query`, `--query`, `--scope`, and `--mode` on Windows. Do not use `Content-Length` MCP framing with `scripts/mcp/aistudy-mcp-server.mjs`.

## Course And Section Edits

- `create_course`
- `rename_course`
- `move_course`
- `delete_course`
- `create_course_section`
- `rename_course_section`
- `move_course_section`
- `delete_course_section`

## Mind Map Edits

- `append_mindmap_node`
- `create_mindmap_node`
- `update_mindmap_node_text`
- `move_mindmap_node`
- `delete_mindmap_node`
- `update_mindmap_node_style`
- `update_mindmap_layout`

## Node Document Edits

- `write_node_document`: create new content or replace the whole document only when `replaceExisting: true` is explicitly approved. Text input should use structured plain text: section heading, short step heading, field labels such as `目标：`/`数据来源：`, numbered or bullet lists, and concise body paragraphs. Keep exactly one blank line between independent knowledge points, do not write raw Mermaid or Markdown fenced blocks as document body, convert diagram descriptions to stable numbered outlines, and use clean math notation such as `ε`, `∞`, `→`, `x_n`, `x^2`, and `lim_{n→∞}`. Advanced snapshot replacement should start from `read_node_document.document.snapshot` and preserves canvas-editor tables, column blocks with internal dividers, and cell content.
- `append_node_document`: append clean text or Markdown-style headings. Use field labels, lists, and stable numbered outlines for structured content. Keep exactly one blank line between independent knowledge points, do not write raw Mermaid or Markdown fenced blocks as document body, and avoid degraded math tokens such as `epsilon`, `infinity`, `->`, or `lim_{n->infinity}`.
- `format_node_document`: style-only cleanup; must preserve every editor element `value` exactly.
- `update_node_document_style`: simple full-document font size, color, bold, italic, or underline changes.

All writes against an existing document use `expectedSnapshotId` from the latest read. A stale value fails with `DOCUMENT_VERSION_CONFLICT`. Successful writes return lightweight version, size, length, and hash metadata rather than a full document reread.

## Locator And Chrome Port Tools

- `resolve_course_locator`: generate local locator files for external agents; database/table values are fixed-boundary metadata, not overrideable runtime config.
- `chrome_ports_status`: inspect fixed Chrome debug ports.
- `chrome_port_open_page`: open or reuse a fixed-port Chrome page for `doubao`, `chatgpt`, `bilibili`, `zhihu`, `zhaopin`, `zhipin`, or `xiaohongshu`.

## Remote Permission Groups

Remote MCP is read-only by default.

- `edit`: global remote edit switch.
- `course`: course and section management.
- `mindmap`: mind map edits.
- `document`: node document writes and formatting.
- `destructive`: delete operations.

Destructive tools require both the relevant edit group and `destructive`.
