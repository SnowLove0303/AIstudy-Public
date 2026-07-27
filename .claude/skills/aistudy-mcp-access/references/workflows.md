# AIstudy MCP Workflows

## Read Full Library

```text
mcp_get_started -> read_courses -> read_current_mindmap({ scope: "all" })
```

Cross-library reads are never implicit. Use `scope: "all"` only when the whole library is the intended target.

## Read A Specific Knowledge Base

```text
read_courses -> mcp_resolve_target({ courseName }) -> read_current_mindmap({ courseId })
```

Never guess `courseId` from a display name.

## Search Nodes And Read Documents

For local stdio calls against `scripts/mcp/aistudy-mcp-server.mjs`, use line-delimited JSON-RPC, not `Content-Length` framing. The maintained helper is:

```text
node scripts/mcp/call-aistudy-mcp.mjs --ref "aistudy://node/..."
```

If AIstudy copied a compact node ref, skip locator files and call:

```text
read_node_context({ ref })
```

The default context read performs a targeted target-to-root database query and returns ancestors, the target, document metadata, and no descendant subtree. It does not parse the full mind-map snapshot. Request `includeDescendants: true` and bounded limits only when needed. Request `documentMode: "text"` only when body text is needed.

```text
mcp_resolve_target({ courseName, nodeQuery })
-> search_nodes({ courseId, query })
-> read_node_context({ courseId, nodeId })
```

If multiple nodes match, present candidates or ask the user to choose.

Use `read_node_context` as the default node-level read. Use `read_node_document({ ..., mode: "text" })` for one cleaned text copy, `mode: "snapshot"` for editor JSON, and `mode: "audit"` only for integrity diagnostics.

Explicit IDs must be full IDs. Short prefixes are accepted only in compact refs and must be unique.

## Edit A Mind Map

```text
mcp_plan_task({ intent, allowEdit: true })
-> mcp_resolve_target({ courseName, nodeQuery })
-> read_current_mindmap({ courseId })
-> specific edit tool
-> read_current_mindmap({ courseId })
```

Use exact `courseId`; use exact `nodeId` for node-level edits.

## Edit A Node Document

```text
mcp_resolve_target({ courseName, nodeQuery })
-> read_node_document({ courseId, nodeId, mode: "snapshot" })
-> append_node_document / format_node_document / update_node_document_style / write_node_document
-> read_node_document({ courseId, nodeId, mode: "text" })
```

Use `write_node_document` for replacement only when the user explicitly asks for whole-document overwrite and `replaceExisting: true` is passed.
Pass the last read `currentSnapshotId` as `expectedSnapshotId`. Stale writes fail instead of overwriting concurrent changes. Write tools return lightweight metadata; re-read only when the caller actually needs the new body.

For `write_node_document` and `append_node_document`, do not repeat the node name because AIstudy already renders it as the document heading. Use `# 标题` only when the body has a distinct article title. Use `一、` / `（一）` / `1.` / `（1）` for the four Chinese article heading levels, `> ` for quotations, `字段：内容` for labels, and one natural body paragraph per line. Blank input lines are paragraph boundaries rather than visible spacer rows.

New text receives Chinese heading/body fonts, justified body alignment, proportional line spacing, and a two-ideographic-space first-line indent. AIstudy safely normalizes nearby Chinese punctuation and Chinese-English spacing while protecting URLs, Windows paths, email addresses, code, formulas, list markers, and tree indentation. `format_node_document` applies the same style system to existing content but preserves every `value` exactly, so it cannot add missing indent characters.

Do not write raw Mermaid or Markdown fenced blocks into node documents. Use mind map edit tools for actual mind map structure. When a document needs to describe a diagram, convert it into headings, field labels, and stable numbered outlines so the AIstudy document renderer shows structured content instead of source code or whitespace-dependent trees.

For math-heavy notes, write standard symbols or readable formula text in the final content: `ε`, `δ`, `∞`, `→`, `≤`, `≥`, `x_n`, `x^2`, `lim_{n→∞}`, `|x_n-a| < ε`. Do not leave degraded chat text such as `epsilon`, `delta`, `infinity`, `->`, or `lim_{n->infinity}` in the document.

## Generate A Local Locator

```text
read_courses -> resolve_course_locator({ courseId })
```

Without `courseId`, `resolve_course_locator` creates locators for the full library.

Locator files may include the public runtime data root, fixed database name, fixed table names, and course ids. Treat database/table values as boundary metadata only; AIstudy Public does not support overriding database or table names through MCP setup.

Do not use locator files for ordinary node-document handoff. Prefer compact refs copied from AIstudy, such as `aistudy://node/c4fc3394/ba7672d3?map=mindmap_97c1`, because MCP can expand unique id prefixes directly.

## Open A Fixed Chrome Port

```text
chrome_ports_status -> chrome_port_open_page({ platformId, url? })
```

Allowed platform IDs: `doubao`, `chatgpt`, `bilibili`, `zhihu`, `zhaopin`, `zhipin`, `xiaohongshu`.
