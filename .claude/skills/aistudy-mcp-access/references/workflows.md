# AIstudy MCP Workflows

## Read Full Library

```text
mcp_get_started -> read_courses -> read_current_mindmap
```

Without `courseId`, `read_current_mindmap` returns all knowledge-base map summaries.

## Read A Specific Knowledge Base

```text
read_courses -> mcp_resolve_target({ courseName }) -> read_current_mindmap({ courseId })
```

Never guess `courseId` from a display name.

## Search Nodes And Read Documents

```text
mcp_resolve_target({ courseName, nodeQuery })
-> search_nodes({ courseId, query })
-> read_node_context({ courseId, nodeId })
```

If multiple nodes match, present candidates or ask the user to choose.

Use `read_node_context` as the default node-level read. It returns the target node, root-to-parent ancestors, a bounded child subtree, and linked documents in one structured payload. Use `read_node_document` only when you need the full editor snapshot for one specific node document.

For `read_node_document`, use `text` or `textClean` as the readable document body. `document.snapshot` is the editor JSON payload and can contain style or structure metadata such as list types, colors, and separators.

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
-> read_node_document({ courseId, nodeId })
-> append_node_document / format_node_document / update_node_document_style / write_node_document
-> read_node_document({ courseId, nodeId })
```

Use `write_node_document` for replacement only when the user explicitly asks for whole-document overwrite and `replaceExisting: true` is passed.

For `write_node_document` and `append_node_document` text, use structured plain text: section heading, short step heading, field labels such as `目标：` or `数据来源：`, numbered or bullet lists, and concise body paragraphs. Separate independent knowledge points with exactly one blank line, but do not add extra blank lines merely for visual spacing.

For math-heavy notes, write standard symbols or readable formula text in the final content: `ε`, `δ`, `∞`, `→`, `≤`, `≥`, `x_n`, `x^2`, `lim_{n→∞}`, `|x_n-a| < ε`. Do not leave degraded chat text such as `epsilon`, `delta`, `infinity`, `->`, or `lim_{n->infinity}` in the document.

## Generate A Local Locator

```text
read_courses -> resolve_course_locator({ courseId })
```

Without `courseId`, `resolve_course_locator` creates locators for the full library.

Locator files may include the public runtime data root, fixed database name, fixed table names, and course ids. Treat database/table values as boundary metadata only; AIstudy Public does not support overriding database or table names through MCP setup.

## Open A Fixed Chrome Port

```text
chrome_ports_status -> chrome_port_open_page({ platformId, url? })
```

Allowed platform IDs: `doubao`, `chatgpt`, `bilibili`, `zhihu`, `zhaopin`, `zhipin`, `xiaohongshu`.
