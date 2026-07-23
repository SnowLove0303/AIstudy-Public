# Settings

设置页的独立业务面板放在本目录，避免继续扩张 `src/renderer/main.tsx`。

## 存储维护

- `StorageMaintenancePanel.tsx` 只调用 preload 暴露的空间扫描和缓存清理动作，不读取文件系统或数据库。
- 页面仅展示用户需要判断的占用、可清理容量和缓存类别；真实路径、表名和数据源标识不在界面展示。
- 信息采集任务运行时，对应中间目录由主进程标记为不可清理。
- 样式由 `StorageMaintenancePanel.css` 自主管理，不再写入全局聚合样式。
