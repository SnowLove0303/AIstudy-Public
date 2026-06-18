# Word 详细内容存储约束

## 目标

为每个思维导图节点准备独立的 Word 详细内容存储能力。Word 内容必须和导图结构强索引关联，但不能混入导图快照，避免后续编辑器接入后出现内存膨胀、快照过大、标题误关联和跨功能连锁故障。

## 强索引关系

- 每个节点详情文档使用唯一键：`course_id + mind_map_id + node_id`。
- `node_id` 来自思维导图节点稳定 ID，不允许使用节点标题做关联。
- 保存 Word 详情前，必须先确认 `mind_map_nodes` 中存在对应的 `course_id + mind_map_id + node_id`。
- 节点重命名不得影响 Word 详情文档关联。
- 节点删除后，详情文档先保持软关联，后续由清理任务处理孤儿文档和历史快照。

## 表结构职责

### `knowledge_documents`

当前文档索引表，只存轻量元数据：

- `id`：文档 ID。
- `course_id`：课程 ID。
- `mind_map_id`：导图 ID。
- `node_id`：导图节点 ID。
- `title`：文档标题。
- `current_snapshot_id`：当前快照指针。
- `current_byte_size`：当前快照体积。
- `created_at / updated_at / deleted_at`：生命周期字段。

核心索引：

- `UNIQUE KEY uk_doc_node (course_id, mind_map_id, node_id)`
- `KEY idx_doc_node_lookup (mind_map_id, node_id, deleted_at)`
- `KEY idx_doc_course_updated (course_id, updated_at)`

### `knowledge_document_snapshots`

Word 内容快照表，只保存版本内容：

- `id`：快照 ID。
- `document_id`：文档 ID。
- `sequence_no`：文档内递增版本号。
- `schema_version`：内部文档协议版本。
- `editor / editor_version`：编辑器协议标识。
- `payload_json`：Word 文档 JSON 快照。
- `payload_hash`：内容哈希。
- `byte_size`：快照体积。
- `created_at`：创建时间。

核心索引：

- `UNIQUE KEY uk_doc_sequence (document_id, sequence_no)`
- `KEY idx_doc_created (document_id, created_at)`
- `KEY idx_doc_hash (payload_hash)`
- `KEY idx_doc_size (byte_size)`

## 内存约束

- 课程加载时只加载课程列表、导图快照和节点投影，不加载所有 Word 详情。
- 只有选中节点并打开详情编辑区时，才通过 `knowledge-documents:load` 读取该节点文档。
- 切换节点前必须保存或丢弃当前详情编辑器状态，然后释放旧节点文档快照。
- 渲染层不得缓存整门课程所有 Word 文档。
- Word 编辑器实例只允许挂载当前活动节点。

## 尺寸约束

- 导图快照上限：`5MB`。
- Word 详情快照上限：`2MB`。
- 图片、附件、二进制内容不得以内联 base64 放进 Word JSON；后续必须进入 `assets` 与 `knowledge_asset_links`。
- Word 快照只保存编辑器结构化数据，不保存 UI 临时状态、选区状态、滚动位置和调试文案。

## IPC 契约

### 读取

通道：`knowledge-documents:load`

输入：

```ts
{
  courseId: string;
  mindMapId: string;
  nodeId: string;
}
```

输出：当前节点文档，或 `null`。

### 保存

通道：`knowledge-documents:save`

输入：

```ts
{
  courseId: string;
  mindMapId: string;
  nodeId: string;
  title?: string;
  snapshot: {
    schemaVersion: 1;
    editor: "aistudy-word";
    editorVersion: string;
    content: unknown;
    updatedAt: string;
  };
}
```

## 禁止事项

- 禁止把 Word 内容写入 `mind_map_nodes`。
- 禁止把 Word 内容写入 `mind_map_snapshots`。
- 禁止按节点标题、目录路径或 UI 选中状态推断文档归属。
- 禁止一次性读取整门课程所有 Word 详情。
- 禁止把 Word 编辑器私有实例传出适配层。
- 禁止在 UI 组件中拼 SQL 或直接访问 MySQL。
