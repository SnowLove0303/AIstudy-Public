# 信息采集模块

信息采集模块负责把外部视频资料整理成 AIstudy 可继续使用的节点文档。当前主流程支持 Bilibili 与 YouTube：先定位视频，再读取元数据、字幕或音频转录，最后生成可写入知识库的结构化 Word 文档。

## 核心能力

- 输入作者、BV、YouTube 链接或标题线索，定位真实视频来源。
- Bilibili 继续复用固定 Chrome 端口登录态和 cookies；YouTube 通过 `yt-dlp` 读取搜索、元数据、字幕和音频。
- “下载转录”通过 `information-collection:process-progress` 回推同一 `requestId` 的步骤进度。
- 每次处理写入独立运行目录：
  - `runtime/information-collection/bilibili/{bvid}/{runId}`
  - `runtime/information-collection/youtube/{videoId}/{runId}`
- 字幕优先；没有字幕时再下载音频并调用本地 Whisper。任何一步缺工具或失败都停在真实状态，不写假转录。
- 转录完成后进入“整理文档”步骤。若配置了 `AISTUDY_MIMO_API_KEY` 或 `MIMO_API_KEY`，调用 MiMo OpenAI-compatible API 生成概览、分点标题、主要内容、来源链接和完整转录；未配置或调用失败时使用本地规则兜底整理，并明确显示状态。
- Word 预览和写入优先使用整理后的 `preparedDocument`，不再直接把原始字幕碎片作为最终文档。

## 数据边界

- 正式输出只写入已有知识库节点文档，不新建独立文档存储表。
- 运行目录、cookies、字幕、音频、HTML、转录和 MiMo 整理中间产物都属于 runtime cache，不得打入安装源或伪装成正式数据。
- Mimo 密钥只允许从环境变量读取，禁止写入源码、文档、日志、缓存或打包产物。
- Word 来源链接必须保留 `href/url` 元数据，不能只做蓝色文本。

## 回归守卫

- `npm run qa:information-collection` 校验进度事件、步骤 ID、运行目录隔离、YouTube 路径、Mimo 环境变量边界、Word 链接元数据和 runtime cache 守卫。
