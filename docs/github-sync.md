# GitHub 仓库同步检查

本项目的用户端更新由设置页“更新管理”负责，读取 `package.json` 里的 GitHub Release 配置。开发机把当前源码同步到 GitHub 时，先使用仓库同步检查脚本，避免本地环境、远端分支或 Release 资产不一致。

## 常用命令

```bash
npm run github:sync:doctor
```

检查内容：

- 当前目录是否是 Git 仓库。
- `origin` 是否指向 `package.json` 的公开仓库。
- 默认分支、当前分支 upstream、ahead/behind 是否正常。
- 工作区是否还有未提交改动。
- GitHub CLI 是否可运行、是否已登录。
- GitHub latest release 是否存在，并且是否包含 `AIstudy-Setup-*.exe` 安装包资产。

安全自动对接：

```bash
npm run github:sync:fix
```

`github:sync:fix` 只做安全修复：缺少 `origin` 时按 `package.json` 添加；当前分支已有远端同名分支但缺少 upstream 时自动绑定。它不会自动提交、推送、创建 Release，也不会修改数据库或运行时数据。

## 与设置页的关系

- 设置页“运行环境检查”面向用户端运行环境：数据目录、MySQL、Chrome 端口、信息采集工具、更新源。
- 设置页“更新管理”面向用户端升级：检查 GitHub Release、下载安装包、打开发布页。
- `github:sync:doctor` 面向开发机发布前检查：确认当前项目源码、Git 远端和 GitHub Release 配置是否能对齐。

## 发布前建议顺序

1. `npm run build`
2. `npm run dist:oneclick`
3. `npm run github:sync:doctor`
4. 提交源码改动并推送当前分支。
5. 在 GitHub Release 上传 `release/AIstudy-Setup-版本号.exe`。
6. 重新运行 `npm run github:sync:doctor`，确认 latest release 安装包资产可被检测到。
