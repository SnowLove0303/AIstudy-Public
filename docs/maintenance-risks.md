# AIstudy 维护风险登记

本文件记录会影响真实用户数据、运行任务、发布一致性或后续开发效率的风险。每项必须包含现象、触发条件、影响、处理记录、状态和回滚方式。

## R-001 信息采集任务与缓存清理冲突

- 现象：缓存维护会清空 `runtime/information-collection`，原实现未判断采集、字幕下载或转写任务是否仍在运行。
- 触发条件：信息采集处理中，用户同时在设置中执行“清理缓存”。
- 影响：本次任务的字幕、音频或中间稿可能被删除，导致任务失败；知识库正式文档和数据库不受该目录清理影响。
- 处理：新增 `electron/runtimeMaintenanceCoordinator.ts`；主进程将采集入口与缓存清理串行化；扫描时把运行中的采集目录标为不可清理；缓存层再次防御性跳过。
- 验证：`npm run qa:cache-maintenance` 在 F 盘隔离目录真实创建并清理文件，验证运行中间稿保护，以及 state、assets、locators、backups、数据库文件保留。
- 状态：已修复，待完成整包验证和发布。
- 回滚：回退本次风险修复提交；回退后不得在采集任务运行时使用缓存清理。

## R-002 核心聚合文件继续膨胀

- 现象：`electron/main.ts`、`src/renderer/main.tsx` 和 `src/renderer/styles.css` 长期承担过多职责；缓存维护功能曾继续向主页面和全局样式增加大段实现。
- 触发条件：新功能直接写入主进程、应用壳或全局样式。
- 影响：冲突概率、回归面和回滚成本持续上升。
- 处理：缓存维护协调逻辑独立到 main-side 模块；存储维护 UI 和样式移至 `src/renderer/features/settings/`；主页面只保留导航和组件装配。
- 验证：TypeScript 编译、数据边界 QA 和完整构建。
- 状态：本次范围已收口；主进程历史体量仍是持续风险，后续按业务服务逐步拆分，禁止一次性大重构。
- 回滚：恢复主页面和全局样式对应提交；不涉及数据迁移。

## R-003 版本与产物文档漂移

- 现象：交接文档和架构文档仍写 `0.1.76`/`0.1.68`，根 README 的 APK 路径仍写 `0.1.4`，而 `package.json` 已为 `0.1.90`、APK 已为 `0.1.7`。
- 触发条件：接手、部署或打包按文档中的复制版本号选取产物。
- 影响：可能验证或分发旧产物，并误判当前发布基线。
- 处理：版本号统一以 `package.json` 为唯一来源；安装器哈希和提交以 `release/build-manifest.json` 为准；历史版本记录明确标注为历史；APK 路径同步为 `0.1.7`。
- 验证：全库检索过时的“当前版本”引用并运行文档/构建检查。
- 状态：文档源已修复，待随本次提交推送。
- 回滚：恢复文档提交即可，不影响程序或数据。

## R-004 发布清单与源码不一致

- 现象：`release/build-manifest.json` 可能记录 `dirty: true`，或记录的提交落后于当前 `HEAD`。
- 触发条件：工作区存在未提交改动时打包，或源码提交后未重新生成安装包。
- 影响：无法证明安装器对应哪一份源码，发布和回滚不可审计。
- 处理：发布前必须确认工作区改动归属，完成全部 QA；关闭旧进程后执行 `npm run dist:oneclick`，启动最新 `release/win-unpacked/AIstudy.exe`，核对 manifest、安装器和快捷方式，再提交并推送。
- 验证：`release/build-manifest.json` 的版本、提交、dirty 状态、安装器 SHA-256 与真实产物一致；`npm run github:sync:doctor` 通过。
- 状态：待工作区内并行的信息采集改动完成归属确认后收口；当前不得发布。
- 回滚：保留上一个已验证安装器和对应 Git 提交；新包验证失败时不覆盖线上 Release。

## 并行工作保护

2026-07-23 本轮开始时，`docs/updates/INDEX.md`、`electron/informationCollectionRuntime.ts`、`electron/main.ts`、`scripts/qa/validate-information-collection.mjs` 已有信息采集相关未提交改动。本轮不回滚、不覆盖、不代替提交这些改动；最终提交前必须按 diff 拆分归属。
