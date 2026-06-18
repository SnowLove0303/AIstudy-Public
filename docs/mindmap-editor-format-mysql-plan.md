# 思维导图编辑器、文本格式与 MySQL 存储分层规划

日期：2026-06-15

## 总体原则

思维导图能力分三层讨论，不混在一起：

1. 画布编辑器：负责可视化编辑、交互、快捷键、缩放、拖拽。
2. 思维导图文本格式及其存储：负责 AIstudy 内部的导图数据格式、快照、导入导出、文本化表达。
3. MySQL 数据库存储：负责长期保存、查询、节点文档绑定、版本快照。

最终产品仍然只有一个 exe：

```text
AIstudy.exe
  -> Electron main
  -> React renderer
  -> mind-map canvas module
  -> MySQL/local asset storage
```

`simple-mind-map` 只是内嵌在 renderer 里的编辑器库，不作为独立程序运行。

## 一、画布编辑器

### 目标

在 AIstudy 自己的 exe 中提供流畅的思维导图编辑画布。

画布层只负责编辑体验，不直接负责数据库，不直接负责业务规则。

### 采用方案

使用 `simple-mind-map` 的库级内嵌方式。

```text
React MindMapCanvas
  -> dynamic import simple-mind-map
  -> register selected plugins
  -> create editor instance
  -> expose stable AIstudy handle
```

不采用：

- 不绑定 `simple-mind-map` 的 Vue Web 应用。
- 不启动第二个 exe。
- 不使用旧 XMind Java/Eclipse 客户端作为运行时。

### 接入位置

第一阶段放在：

```text
src/renderer/features/mindmap/
  MindMapWorkspace.tsx
  MindMapCanvas.tsx
  MindMapToolbar.tsx
  simpleMindMapAdapter.ts
  xmindAdapter.ts
  mindMapSnapshot.ts
  mindMapProjection.ts
```

后续如果多个产品复用，再抽成内部包：

```text
packages/mindmap-canvas/
```

复用方式是源码/模块复用。打包后仍然只有一个 exe。

### 画布职责

画布层负责：

- 创建根节点、子节点、兄弟节点。
- 编辑节点标题。
- 删除节点。
- 拖拽调整结构。
- 折叠/展开。
- 缩放、平移。
- 选中节点。
- 发出变更事件。
- 返回当前编辑器快照。
- 根据快照恢复画布。

画布层不负责：

- 直接写 MySQL。
- 直接读写本地文件。
- 直接管理课程业务。
- 直接管理知识文档内容。
- 把 `.xmind` 当成内部唯一存储格式。

### 适配器接口

AIstudy 不应该到处直接调用 `simple-mind-map`。

统一封装在 `simpleMindMapAdapter.ts`：

```ts
export type MindMapEditorHandle = {
  getSnapshot(): MindMapSnapshot
  setSnapshot(snapshot: MindMapSnapshot): void
  resize(): void
  destroy(): void
  exec(command: MindMapCommand): void
}
```

事件：

```ts
export type MindMapEditorEvents = {
  onSnapshotChanged(snapshot: MindMapSnapshot): void
  onNodeSelected(nodeId: string | null): void
  onNodeChanged(nodeId: string): void
  onStructureChanged(snapshot: MindMapSnapshot): void
}
```

这样以后如果换成别的画布库，AIstudy 只需要改适配器。

### 插件选择

第一版只接最小插件：

- `Drag`
- `Select`
- `KeyboardNavigation`
- `Export`
- `ExportXMind`

第二阶段再接：

- `Search`
- `MiniMap`
- `Scrollbar`
- `RichText`
- `AssociativeLine`
- `OuterFrame`

暂缓：

- `Cooperate`
- `Demonstrate`
- `Formula`
- `NodeBase64ImageStorage`
- PDF/大图片导出相关重插件

原因：先控制内存和稳定性，不一次性把完整插件体系拉进来。

### 内存与流畅度策略

画布层必须遵守：

- 同一时间只保留一个活跃画布实例。
- 进入导图页面时才动态加载编辑器代码。
- 离开导图页面时保存快照并调用 `destroy()`。
- 切换课程或导图时销毁旧实例，再加载新实例。
- 不隐藏多个导图实例在 tab 中。
- 不把所有课程的导图数据一次性加载到 renderer。
- 不把大图片永久存成 base64。

大图策略：

- 500 个节点以上开始提示或记录性能状态。
- 1000 个节点以上启用性能模式。
- 保存快照、生成节点投影等重操作做 debounce。
- 导出图片、SVG、PDF 等操作由用户主动触发，不自动执行。

## 二、思维导图文本格式及其存储

### 核心判断

AIstudy 内部不直接以 `.xmind` 作为主存储格式。

原因：

- `.xmind` 是压缩包格式，适合交换，不适合频繁增量保存和数据库查询。
- AIstudy 需要把节点绑定到知识文档、复习卡、AI 总结、资源附件。
- MySQL 查询需要扁平节点表，不能每次都解压 `.xmind`。

因此内部使用两种数据：

1. 编辑器快照：用于完整恢复画布。
2. 节点投影：用于业务查询、文档绑定、搜索、AI 功能。

### 内部快照格式

建议定义 `MindMapSnapshot`：

```ts
export type MindMapSnapshot = {
  schemaVersion: 1
  editor: 'simple-mind-map'
  editorVersion: string
  mapId: string
  root: MindMapNode
  layout?: string
  theme?: {
    template?: string
    config?: unknown
  }
  view?: {
    scale?: number
    x?: number
    y?: number
  }
  metadata: {
    createdAt: string
    updatedAt: string
    importedFrom?: 'xmind' | 'markdown' | 'manual'
    sourceFileName?: string
  }
}
```

节点格式：

```ts
export type MindMapNode = {
  id: string
  title: string
  richTitle?: string
  note?: string
  parentId?: string | null
  children: MindMapNode[]
  collapsed?: boolean
  tags?: string[]
  link?: string
  imageAssetId?: string
  style?: unknown
  extra?: Record<string, unknown>
}
```

字段原则：

- `id` 是稳定主键，改标题不能改 id。
- `title` 是纯文本标题，用于搜索、投影、AI。
- `richTitle` 可选，用于富文本标题，第一版可以不启用。
- `note` 存节点备注，第一版可以是纯文本或受控 HTML。
- `imageAssetId` 指向资产表，不直接把大 base64 放节点里。
- `extra` 保存暂时不能结构化的编辑器字段，避免丢失数据。

### 文本化表达

除了编辑器快照，AIstudy 还需要一种轻量文本格式，用于：

- AI 总结输入。
- 快速预览。
- Markdown 导入导出。
- 搜索索引。
- 复制粘贴。

建议使用 Markdown outline：

```markdown
# 高等数学

- 极限
  - 数列极限
  - 函数极限
- 导数
  - 定义
  - 求导法则
```

这个文本格式不是主存储格式，而是由快照/投影生成的派生格式。

### 快照保存策略

编辑时：

```text
simple-mind-map data_change
  -> debounce 800-1500 ms
  -> getData(true)
  -> normalize to MindMapSnapshot
  -> send to Electron main
  -> save snapshot
  -> update node projection
```

强制保存时机：

- 用户点击保存。
- 切换课程。
- 切换导图。
- 关闭窗口。
- 导入文件完成。
- 导出文件前。

### `.xmind` 角色

`.xmind` 只作为导入导出格式。

导入：

```text
.xmind file
  -> xmindAdapter
  -> MindMapSnapshot
  -> editor setSnapshot
  -> save AIstudy snapshot
  -> update MySQL projection
```

导出：

```text
MindMapSnapshot
  -> xmindAdapter
  -> .xmind bytes
  -> Electron main save file
```

第一版支持：

- 根节点。
- 子节点。
- 标题。
- 备注。
- 链接。
- 标签。
- 单 sheet 导入。

后续支持：

- 多 sheet。
- 关系线。
- 外框。
- 概要。
- 图片。
- 主题样式。

## 三、MySQL 数据库存储

### 存储原则

MySQL 不直接依赖画布库的数据结构做业务查询。

MySQL 保存：

1. 当前导图记录。
2. 快照历史。
3. 扁平节点投影。
4. 节点和知识文档、资产的关系。

### 推荐表结构

#### `mind_maps`

保存导图本体。

```sql
CREATE TABLE mind_maps (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  root_node_id VARCHAR(64) NOT NULL,
  current_snapshot_id VARCHAR(64) NULL,
  node_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  INDEX idx_mind_maps_course_id (course_id),
  INDEX idx_mind_maps_updated_at (updated_at)
);
```

#### `mind_map_snapshots`

保存完整编辑器快照。

```sql
CREATE TABLE mind_map_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  mind_map_id VARCHAR(64) NOT NULL,
  sequence_no BIGINT NOT NULL,
  schema_version INT NOT NULL,
  editor VARCHAR(64) NOT NULL,
  editor_version VARCHAR(64) NULL,
  payload_json LONGTEXT NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  byte_size INT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_snapshot_sequence (mind_map_id, sequence_no),
  INDEX idx_snapshots_map_created (mind_map_id, created_at)
);
```

说明：

- 第一版用 `LONGTEXT` 存 JSON，简单可靠。
- 业务查询不要查 `payload_json`，查节点投影表。
- 后续如果快照过大，可以增加 `payload_compressed LONGBLOB`。

#### `mind_map_nodes`

保存扁平节点投影。

```sql
CREATE TABLE mind_map_nodes (
  id VARCHAR(64) PRIMARY KEY,
  mind_map_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  parent_node_id VARCHAR(64) NULL,
  title VARCHAR(512) NOT NULL,
  title_plain TEXT NULL,
  depth INT NOT NULL,
  position_index INT NOT NULL,
  path_text TEXT NULL,
  is_collapsed TINYINT(1) NOT NULL DEFAULT 0,
  has_note TINYINT(1) NOT NULL DEFAULT 0,
  has_document TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  INDEX idx_nodes_map_parent (mind_map_id, parent_node_id),
  INDEX idx_nodes_course_title (course_id, title),
  INDEX idx_nodes_map_depth (mind_map_id, depth)
);
```

说明：

- `id` 对应导图节点稳定 id。
- `title` 用于列表显示。
- `path_text` 可存 `根/章节/小节`，用于搜索结果定位。
- 第一版搜索可以用普通索引，后续再考虑全文索引。

#### `mind_map_node_notes`

节点备注可以单独存，避免节点表膨胀。

```sql
CREATE TABLE mind_map_node_notes (
  node_id VARCHAR(64) PRIMARY KEY,
  mind_map_id VARCHAR(64) NOT NULL,
  note_plain LONGTEXT NULL,
  note_html LONGTEXT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_notes_map (mind_map_id)
);
```

第一版如果备注很轻，也可以先放在 snapshot，不单独建表。若要搜索备注，建议建表。

#### `knowledge_documents`

节点绑定的知识文档。

```sql
CREATE TABLE knowledge_documents (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(64) NOT NULL,
  mind_map_id VARCHAR(64) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  current_snapshot_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_document_node (node_id),
  INDEX idx_documents_course (course_id)
);
```

### 保存事务

保存一次导图快照时：

```text
begin transaction
  insert mind_map_snapshots
  update mind_maps.current_snapshot_id
  upsert mind_map_nodes projection
  mark missing old nodes as deleted_at
commit
```

这样保证：

- 快照和节点投影一致。
- app 崩溃时不会出现半更新。
- 当前快照指针明确。

### 快照压缩与清理

第一版：

- 每次明确保存插入一个快照。
- 自动保存可以覆盖临时快照，或按时间间隔生成。

建议策略：

- 最近 20 个快照全部保留。
- 之后每小时保留 1 个。
- 之后每天保留 1 个。
- 删除旧快照前确认不影响当前快照。

### MySQL 与 renderer 边界

Renderer：

- 调用 preload API。
- 不拿数据库连接。
- 不写 SQL。

Preload：

- 暴露安全、窄接口。

Main：

- 执行 SQL。
- 控制事务。
- 管理文件和资产。

```text
React renderer
  -> window.aistudy.mindmap.saveSnapshot(...)
  -> preload
  -> ipcMain handler
  -> MySQL repository
```

## 三层之间的关系

```text
画布编辑器
  produces editor snapshot

思维导图格式层
  normalizes snapshot
  generates text outline
  imports/exports xmind
  projects nodes

MySQL 存储层
  stores snapshots
  stores node projection
  stores document bindings
```

画布可以换，数据库结构尽量不跟着换。

`.xmind` 可以换版本，内部 `MindMapSnapshot` 通过 `schemaVersion` 做迁移。

## 第一阶段落地顺序

1. 先做画布 spike。
   - 能创建、编辑、删除节点。
   - 能 `getData(true)`。
   - 能 `setData` 恢复。
   - 能销毁实例。

2. 再定义 `MindMapSnapshot`。
   - 写转换函数。
   - 写节点投影函数。
   - 写 Markdown outline 生成函数。

3. 再接 MySQL。
   - 建 `mind_maps`。
   - 建 `mind_map_snapshots`。
   - 建 `mind_map_nodes`。
   - 做一次保存事务。

4. 最后接 `.xmind`。
   - 导入为 snapshot。
   - 导出为 `.xmind`。
   - 记录兼容字段。

这个顺序能避免一开始就被 `.xmind` 和数据库复杂度拖住。

## 当前决策

- 画布：`simple-mind-map` 库级内嵌。
- 内部格式：`MindMapSnapshot` JSON + Markdown outline 派生文本。
- 数据库：快照表 + 节点投影表。
- `.xmind`：交换格式，不是主存储格式。
- 打包：只有一个 AIstudy exe。
