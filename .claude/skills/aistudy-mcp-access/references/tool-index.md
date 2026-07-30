# AIstudy MCP Tool Index

Keep this file synchronized with `electron/mcp/controller.ts`, `electron/mcp/remoteAccess.ts`, and `scripts/mcp/aistudy-mcp-server.mjs`.

## Control And Discovery

- `mcp_get_started`: first call; returns health, scope, safety rules, resources, prompts, and next steps.
- `mcp_plan_task`: turns ambiguous or multi-step user intent into ordered MCP calls. Skip it for a direct, unambiguous operation to avoid an unnecessary round trip.
- `mcp_resolve_target`: resolves a compact ref, course, and optional node candidates. Empty targets fail; ambiguous names remain unresolved.
- `health_check`: checks runtime, MySQL, and core tables.
- `copy_config`: in-app helper for copying onboarding config.

## Read Tools

- `read_courses`
- `read_current_mindmap`: requires `courseId`; cross-library summaries require explicit `scope: "all"`.
- `search_nodes`: requires `courseId`; cross-library search requires explicit `scope: "all"` and a non-empty query.
- `list_node_documents`: requires `courseId`; cross-library listing requires explicit `scope: "all"`.
- `read_node_document`: accepts compact `ref` or full `courseId + nodeId`. Default `mode: "text"` is paged by `offset + maxChars` and returns `complete`, `nextOffset`, remaining length, and an exact `requiredNextCall`; `mode: "snapshot"` returns editor JSON; `mode: "audit"` returns diagnostic text variants.
- `read_node_context`: preferred node-level read. Default output uses a targeted target-to-root query and includes the target, ancestors, and document metadata without parsing the full mind-map snapshot. `documentMode: "text"` returns bounded previews plus mandatory `requiredNextCalls`; `documentMode: "full"` atomically returns all selected document text only when the aggregate safety cap is not exceeded.

## Compact Node References

AIstudy document-copy actions may return a compact node reference such as:

```text
aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1
```

Pass it directly as `{"ref":"..."}` to `read_node_context` for fast structured reads, or to `read_node_document({ ref, mode: "snapshot" })` only when editor JSON is required. The MCP server expands short prefixes only inside compact refs and refuses ambiguous matches instead of guessing. Explicit ID fields require full IDs.

For same-machine CLI access, use `scripts/mcp/call-aistudy-mcp.mjs`. Use `--session` for multiple calls so one process and MySQL pool are reused. Prefer direct flags on Windows; for complex objects use `ConvertTo-Json | ... --args-stdin` or `--args-file`. Do not use `Content-Length` MCP framing with `scripts/mcp/aistudy-mcp-server.mjs`.

Claude Code's normal MCP connection is already session-oriented. The helper is for diagnostics or scripted batches, not a wrapper to launch once per Claude tool call.

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

- `write_node_document`: create new content or replace the whole document only when `replaceExisting: true` is explicitly approved. The node name is already the document heading; use `#` only for a distinct article title, then `一、` / `（一）` / `1.` / `（1）` for four heading levels, `> ` for quotations, labels, lists, and one body paragraph per line. New body paragraphs receive Chinese fonts, justified spacing, and a two-character indent. URLs, Windows paths, email, code, formulas, and list/tree syntax are protected. Advanced snapshot replacement should start from `read_node_document.document.snapshot` and preserves canvas-editor tables, column blocks with internal dividers, and cell content.
- `append_node_document`: append structured text with the same Chinese-article typography and protected-content rules. A blank input line marks a paragraph boundary; it does not create a large visual spacer row.
- `format_node_document`: apply the Chinese-article style system to existing content while preserving every editor element `value` exactly; it never inserts missing indent characters.
- `update_node_document_style`: simple full-document font size, color, bold, italic, or underline changes.

All writes against an existing document use `expectedSnapshotId` from the latest read. A stale value fails with `DOCUMENT_VERSION_CONFLICT`. Successful writes return lightweight version, size, length, and hash metadata rather than a full document reread.

Document titles returned by MCP include the node name when the stored legacy title is empty or generic (`节点文档`). A distinct article title remains unchanged and `storedTitle`/`titleSource` expose the distinction without rewriting the database during reads.

Technical literals are exact-copy content: Windows/UNC paths, MCP tool names, underscore identifiers, IDs, compact refs, JSON, command switches, and script names must not be changed by Chinese or mathematical typography.

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

Local/stdio and in-process MCP can further restrict edits with:

- `AISTUDY_MCP_ALLOWED_EDIT_TOOLS`
- `AISTUDY_MCP_ALLOWED_COURSE_IDS`
- `AISTUDY_MCP_ALLOWED_NODE_IDS`

Each is a comma/semicolon/whitespace-separated exact allowlist. Effective values are returned by `mcp_get_started.safety.editPolicy`; missing targets fail closed when a scoped allowlist is configured.

## RAG Status

Document read/write results include `ragIndex`. AIstudy Public currently returns `status: "not_configured"`, `supported: false`, and `synchronized: false` because this repository has no vector-index persistence or version contract. A successful document snapshot write must not be reported as RAG-indexed.
