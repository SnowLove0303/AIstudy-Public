# 思维导图视口滚动条修复记录

日期：2026-07-27

基线：`main` / `2fcc8b7`

## 问题与影响

- 现象：思维导图底部水平滚动条偶发无法拖动；同一套交互实现也影响右侧垂直滚动条。
- 触发条件：命中范围仅 10px，且拖动依赖组件维护 Pointer Capture；窗口抢焦点、指针取消、布局切换或组件重挂载时，拖动生命周期可能中断。
- 影响范围：导图单页、导图与节点文档并排、缩放后的大画布视口移动。
- 数据风险：问题只影响视口交互，不涉及导图节点、文档正文或数据库结构。

## 处理

- 使用 Chromium 原生 `input[type="range"]` 承接水平和垂直拖动生命周期。
- 保留原有自绘轨道和滑块作为显示层，不改变导图适配器的视口换算与移动接口。
- 将水平高度和垂直宽度的有效命中范围由 10px 扩大到 22px，视觉轨道仍保持紧凑。
- 删除自建 Pointer Capture、窗口失焦清理和临时拖动状态，降低常驻监听与残留状态风险。
- 为两个方向提供可访问名称，支持辅助技术及键盘聚焦。
- 更新知识工作区专项 QA，禁止重新引入窗口级指针监听或自建捕获状态机。

## 真实验证

- `node scripts/qa/validate-knowledge-split-workspace.mjs`：通过。
- `npm run build`：通过，包含 TypeScript、Vite、数据边界、导图快照完整性、节点文档标题和 MCP 文档模板等既有检查。
- `npm run pack`：通过；便携运行数据在打包前保留、打包后恢复，桌面与开始菜单快捷方式校验通过。
- 最新 `release/win-unpacked/AIstudy.exe` 实测：
  - 并排模式连续左右往返拖动 5 次，滑块与导图同步。
  - 导图单页模式拖动正常。
  - 连续放大两级后拖动正常。
  - 关闭应用并重新打开后拖动正常。
  - 同一原生交互层的垂直滚动条拖动正常。
- 验证过程未编辑、覆盖或保存任何导图节点及文档正文。

## 回滚

优先执行 `git revert <本次提交>`，然后重新运行 `npm run build` 和安全打包。文件级回滚仅涉及：

- `src/renderer/lib/ViewportScrollbars.tsx`
- `src/renderer/styles.css`
- `scripts/qa/validate-knowledge-split-workspace.mjs`
- `src/renderer/features/mindmap/README.md`
- 本记录

无需回滚、迁移或恢复数据库。
