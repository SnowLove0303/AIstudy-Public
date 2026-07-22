# AIstudy MCP Tool Index

Keep this file synchronized with `electron/mcp/controller.ts`, `electron/mcp/remoteAccess.ts`, and `scripts/mcp/aistudy-mcp-server.mjs`.

## Control And Discovery

- `mcp_get_started`: first call; returns health, scope, safety rules, resources, prompts, and next steps.
- `mcp_plan_task`: turns user intent into ordered MCP calls.
- `mcp_resolve_target`: resolves course and optional node candidates.
- `health_check`: checks runtime, MySQL, and core tables.
- `copy_config`: in-app helper for copying onboarding config.

## Read Tools

- `read_courses`
- `read_current_mindmap`
- `search_nodes`
- `list_node_documents`
- `read_node_document`: accepts compact `ref` or `courseId + nodeId`; returns `text`/`textClean` for human-readable content, `textRaw` for audit, and `document.snapshot` as editor JSON for advanced tooling.
- `read_node_context`: preferred node-level read. Given compact `ref` or `courseId + nodeId`, returns the target node, ancestor chain, bounded descendant subtree, and linked documents in one structured response. Use this before `read_current_mindmap` when the target node is known.

## Compact Node References

AIstudy document-copy actions may return a compact node reference such as:

```text
aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1
```

Pass it directly as `{"ref":"..."}` to `read_node_context` for fast structured reads, or to `read_node_document` only when the full editor snapshot is required. The MCP server expands short prefixes to full ids and refuses ambiguous matches instead of guessing.

For same-machine CLI access, use `scripts/mcp/call-aistudy-mcp.mjs` to call compact refs through the local stdio server. That helper uses AIstudy's line-delimited JSON-RPC transport. Do not use `Content-Length` MCP framing with `scripts/mcp/aistudy-mcp-server.mjs`.

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
