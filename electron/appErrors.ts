export type AppErrorDomain =
  | "system"
  | "mysql"
  | "local-store"
  | "course"
  | "section"
  | "mindmap"
  | "document"
  | "asset"
  | "chrome"
  | "ai"
  | "update"
  | "error-log"
  | "import";

export type AppErrorDefinition = {
  code: string;
  domain: AppErrorDomain;
  userMessage: string;
  reason: string;
  action: string;
  retryable: boolean;
};

export class CodedAppError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(code: string, technicalMessage?: string, context?: Record<string, unknown>) {
    super(technicalMessage || code);
    this.name = "CodedAppError";
    this.code = code;
    this.context = context;
  }
}

export const APP_ERROR_DEFINITIONS = {
  APP_UNKNOWN: {
    code: "APP_UNKNOWN",
    domain: "system",
    userMessage: "操作没有完成，请稍后再试。",
    reason: "系统捕获到未归类异常。",
    action: "记录技术详情，后续补充更精确的错误码。",
    retryable: true
  },
  APP_INVALID_ARGUMENT: {
    code: "APP_INVALID_ARGUMENT",
    domain: "system",
    userMessage: "输入内容不完整，请检查后再试。",
    reason: "调用参数缺失、格式错误或身份字段不合法。",
    action: "校验入口参数，避免无效请求进入存储层。",
    retryable: false
  },
  APP_CONFIG_INVALID: {
    code: "APP_CONFIG_INVALID",
    domain: "system",
    userMessage: "配置内容有误，请检查设置后再试。",
    reason: "配置项名称、表名或连接参数不符合系统要求。",
    action: "保留技术日志，提示用户检查配置。",
    retryable: false
  },
  MYSQL_UNAVAILABLE: {
    code: "MYSQL_UNAVAILABLE",
    domain: "mysql",
    userMessage: "数据库暂时连接不上，内容会先保存在本机。",
    reason: "MySQL 服务不可用、账号不可用、网络连接失败或连接中断。",
    action: "课程分区写入走本地兜底和 pending 队列，其他强一致数据阻止写入。",
    retryable: true
  },
  MYSQL_QUERY_FAILED: {
    code: "MYSQL_QUERY_FAILED",
    domain: "mysql",
    userMessage: "数据库写入没有完成，请稍后再试。",
    reason: "SQL 执行失败、表结构异常、唯一索引冲突或事务回滚。",
    action: "记录 SQL 错误码和调用来源，避免前端暴露 SQL 细节。",
    retryable: true
  },
  LOCAL_STORE_READ_FAILED: {
    code: "LOCAL_STORE_READ_FAILED",
    domain: "local-store",
    userMessage: "本机缓存读取失败，系统会尝试重新初始化。",
    reason: "本地 JSON 缓存损坏、权限不足或文件不可读。",
    action: "隔离损坏文件，优先使用 MySQL 或空镜像继续启动。",
    retryable: true
  },
  LOCAL_STORE_WRITE_FAILED: {
    code: "LOCAL_STORE_WRITE_FAILED",
    domain: "local-store",
    userMessage: "本机缓存没有保存成功，请稍后再试。",
    reason: "本地 JSON 原子写入失败、磁盘权限不足或文件被占用。",
    action: "记录文件系统错误，避免把缓存当作事实源。",
    retryable: true
  },
  PENDING_OPERATION_INVALID: {
    code: "PENDING_OPERATION_INVALID",
    domain: "local-store",
    userMessage: "本机待同步记录异常，系统会保留现场。",
    reason: "pending 队列结构不符合协议。",
    action: "阻止错误队列重放，记录技术详情后等待修复。",
    retryable: false
  },
  PENDING_OPERATION_REPLAY_FAILED: {
    code: "PENDING_OPERATION_REPLAY_FAILED",
    domain: "local-store",
    userMessage: "部分本机改动还没同步到数据库。",
    reason: "MySQL 恢复后重放 pending 操作失败。",
    action: "保留失败操作和后续操作，等待下一次重试。",
    retryable: true
  },
  COURSE_NAME_EMPTY: {
    code: "COURSE_NAME_EMPTY",
    domain: "course",
    userMessage: "知识库名称不能为空。",
    reason: "创建或重命名课程时名称为空。",
    action: "前端提示用户补充名称，不写入数据库。",
    retryable: false
  },
  COURSE_NOT_FOUND: {
    code: "COURSE_NOT_FOUND",
    domain: "course",
    userMessage: "这个知识库不存在或已被删除。",
    reason: "课程 id 在当前数据源中不存在或已软删除。",
    action: "刷新课程列表，避免继续操作失效对象。",
    retryable: false
  },
  COURSE_SAVE_FAILED: {
    code: "COURSE_SAVE_FAILED",
    domain: "course",
    userMessage: "知识库保存没有完成，请稍后再试。",
    reason: "课程创建、重命名、移动、删除或旧整包保存失败。",
    action: "命令式操作可进入本地兜底；旧接口只保留兼容。",
    retryable: true
  },
  SECTION_NAME_EMPTY: {
    code: "SECTION_NAME_EMPTY",
    domain: "section",
    userMessage: "分区名称不能为空。",
    reason: "创建或重命名分区时名称为空。",
    action: "前端提示用户补充名称，不写入数据库。",
    retryable: false
  },
  SECTION_NAME_DUPLICATE: {
    code: "SECTION_NAME_DUPLICATE",
    domain: "section",
    userMessage: "已经有同名分区了。",
    reason: "同名分区会造成用户识别困难。",
    action: "阻止写入，要求用户换一个名称。",
    retryable: false
  },
  SECTION_NOT_FOUND: {
    code: "SECTION_NOT_FOUND",
    domain: "section",
    userMessage: "这个分区不存在或已被删除。",
    reason: "分区 id 在当前数据源中不存在或已软删除。",
    action: "刷新分区列表，避免继续操作失效对象。",
    retryable: false
  },
  MINDMAP_REQUEST_INVALID: {
    code: "MINDMAP_REQUEST_INVALID",
    domain: "mindmap",
    userMessage: "导图请求不完整，请重新打开后再试。",
    reason: "导图读取或保存请求缺少课程、导图或快照参数。",
    action: "拒绝保存无效导图，避免产生孤儿数据。",
    retryable: false
  },
  MINDMAP_SNAPSHOT_INVALID: {
    code: "MINDMAP_SNAPSHOT_INVALID",
    domain: "mindmap",
    userMessage: "导图内容格式异常，请重新打开后再试。",
    reason: "导图快照协议、根节点或编辑器标识不符合契约。",
    action: "阻止写入，保留技术日志。",
    retryable: false
  },
  MINDMAP_SNAPSHOT_TOO_LARGE: {
    code: "MINDMAP_SNAPSHOT_TOO_LARGE",
    domain: "mindmap",
    userMessage: "导图内容太大，暂时不能保存。",
    reason: "导图快照超过系统上限。",
    action: "阻止写入，后续应拆分内容或外置资产。",
    retryable: false
  },
  MINDMAP_INLINE_ASSET_BLOCKED: {
    code: "MINDMAP_INLINE_ASSET_BLOCKED",
    domain: "asset",
    userMessage: "导图里有过大的内嵌素材，暂时不能保存。",
    reason: "导图快照包含超过阈值的 base64 data URL。",
    action: "阻止写入，要求资产进入独立资产存储。",
    retryable: false
  },
  DOCUMENT_REQUEST_INVALID: {
    code: "DOCUMENT_REQUEST_INVALID",
    domain: "document",
    userMessage: "文档请求不完整，请重新打开后再试。",
    reason: "文档读取、状态查询或保存请求缺少绑定键。",
    action: "拒绝保存无效文档，避免标题或 UI 状态误关联。",
    retryable: false
  },
  DOCUMENT_NODE_MISSING: {
    code: "DOCUMENT_NODE_MISSING",
    domain: "document",
    userMessage: "请先保存导图，再保存这个文档。",
    reason: "Word 文档对应的 mind_map_nodes 节点不存在。",
    action: "阻止写入孤儿文档，要求先落库导图节点投影。",
    retryable: true
  },
  DOCUMENT_SNAPSHOT_INVALID: {
    code: "DOCUMENT_SNAPSHOT_INVALID",
    domain: "document",
    userMessage: "文档内容格式异常，请重新打开后再试。",
    reason: "Word 快照协议、编辑器标识或内容结构不符合契约。",
    action: "阻止写入，保留技术日志。",
    retryable: false
  },
  DOCUMENT_SNAPSHOT_TOO_LARGE: {
    code: "DOCUMENT_SNAPSHOT_TOO_LARGE",
    domain: "document",
    userMessage: "文档内容太大，暂时不能保存。",
    reason: "Word 快照超过系统上限。",
    action: "阻止写入，后续应拆分内容或外置资产。",
    retryable: false
  },
  DOCUMENT_INLINE_ASSET_BLOCKED: {
    code: "DOCUMENT_INLINE_ASSET_BLOCKED",
    domain: "asset",
    userMessage: "文档里有过大的内嵌素材，暂时不能保存。",
    reason: "Word 快照包含超过阈值的 base64 data URL。",
    action: "阻止写入，要求资产进入独立资产存储。",
    retryable: false
  },
  CHROME_NOT_FOUND: {
    code: "CHROME_NOT_FOUND",
    domain: "chrome",
    userMessage: "没有找到 Chrome，请检查浏览器路径。",
    reason: "系统未找到可启动的 Chrome 程序。",
    action: "提示用户配置 Chrome 路径。",
    retryable: false
  },
  CHROME_PORT_NOT_CONFIGURED: {
    code: "CHROME_PORT_NOT_CONFIGURED",
    domain: "chrome",
    userMessage: "浏览器端口还没配置好。",
    reason: "指定 AI 平台端口缺失或不可用。",
    action: "引导用户到端口管理完成配置。",
    retryable: false
  },
  CHROME_LOGIN_REQUIRED: {
    code: "CHROME_LOGIN_REQUIRED",
    domain: "chrome",
    userMessage: "需要先确认浏览器登录状态。",
    reason: "AI 平台页面未登录、需要验证或登录态不可用。",
    action: "引导用户在端口管理中完成登录。",
    retryable: true
  },
  AI_PROMPT_EMPTY: {
    code: "AI_PROMPT_EMPTY",
    domain: "ai",
    userMessage: "请输入要发送给 AI 的内容。",
    reason: "AI 请求内容为空。",
    action: "前端提示用户补充内容。",
    retryable: false
  },
  AI_PROVIDER_UNAVAILABLE: {
    code: "AI_PROVIDER_UNAVAILABLE",
    domain: "ai",
    userMessage: "AI 服务暂时不可用，请稍后再试。",
    reason: "AI 页面、端口、脚本执行或平台响应不可用。",
    action: "记录平台和页面状态，保留用户输入。",
    retryable: true
  },
  AI_NO_RESPONSE: {
    code: "AI_NO_RESPONSE",
    domain: "ai",
    userMessage: "AI 暂时没有返回结果，请稍后再试。",
    reason: "AI 页面没有生成可读取的回答。",
    action: "记录页面阻塞原因，允许用户重试。",
    retryable: true
  },
  UPDATE_CONFIG_INVALID: {
    code: "UPDATE_CONFIG_INVALID",
    domain: "update",
    userMessage: "更新配置不可用，请稍后再试。",
    reason: "仓库地址、发布页或版本信息缺失。",
    action: "记录配置问题，阻止继续更新流程。",
    retryable: false
  },
  UPDATE_CHECK_FAILED: {
    code: "UPDATE_CHECK_FAILED",
    domain: "update",
    userMessage: "更新检测没有完成，请稍后再试。",
    reason: "GitHub Release 查询失败或响应不可用。",
    action: "记录 HTTP 状态和响应原因，允许重试。",
    retryable: true
  },
  UPDATE_DOWNLOAD_FAILED: {
    code: "UPDATE_DOWNLOAD_FAILED",
    domain: "update",
    userMessage: "安装包下载没有完成，请稍后再试。",
    reason: "下载地址无效、网络失败或文件写入失败。",
    action: "保留下载错误并允许重试。",
    retryable: true
  },
  UPDATE_INSTALL_FAILED: {
    code: "UPDATE_INSTALL_FAILED",
    domain: "update",
    userMessage: "安装程序没有启动，请稍后再试。",
    reason: "安装包不存在、路径无效或启动失败。",
    action: "提示重新下载或检查安装包。",
    retryable: true
  },
  ERROR_LOG_READ_FAILED: {
    code: "ERROR_LOG_READ_FAILED",
    domain: "error-log",
    userMessage: "报错日志暂时无法读取。",
    reason: "错误日志表不可用或查询失败。",
    action: "记录控制台警告，避免日志功能阻断主流程。",
    retryable: true
  },
  IMPORT_SOURCE_INVALID: {
    code: "IMPORT_SOURCE_INVALID",
    domain: "import",
    userMessage: "导入文件暂时无法识别。",
    reason: "导入源不存在、格式不支持或解析失败。",
    action: "导入模块后续统一接入解析阶段。",
    retryable: false
  },
  IMPORT_NODE_MATCH_FAILED: {
    code: "IMPORT_NODE_MATCH_FAILED",
    domain: "import",
    userMessage: "导入内容没有匹配到对应目录。",
    reason: "导入内容无法匹配稳定 node_id。",
    action: "导入模块必须先匹配节点再生成快照。",
    retryable: false
  },
  IMPORT_WRITE_FAILED: {
    code: "IMPORT_WRITE_FAILED",
    domain: "import",
    userMessage: "导入内容没有保存成功，请稍后再试。",
    reason: "导入生成快照后写入数据库失败。",
    action: "复用文档保存服务，避免导入器直接写表。",
    retryable: true
  }
} as const satisfies Record<string, AppErrorDefinition>;

export type AppErrorCode = keyof typeof APP_ERROR_DEFINITIONS;

export type ClassifiedAppError = AppErrorDefinition & {
  technicalMessage: string;
  context?: Record<string, unknown>;
};

export function createAppError(code: AppErrorCode, technicalMessage?: string, context?: Record<string, unknown>) {
  return new CodedAppError(code, technicalMessage, context);
}

export function getAppErrorDefinition(code: string): AppErrorDefinition {
  return APP_ERROR_DEFINITIONS[code as AppErrorCode] ?? APP_ERROR_DEFINITIONS.APP_UNKNOWN;
}

function readErrorCode(error: unknown) {
  if (error instanceof CodedAppError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    const code = error.code;
    if (code in APP_ERROR_DEFINITIONS) return code;
  }
  return "";
}

function readTechnicalMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.message}${error.stack ? `\n${error.stack}` : ""}`.slice(0, 12000);
  }
  return String(error ?? "").slice(0, 12000);
}

function rawMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function hasMysqlCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return false;
  return error.code.startsWith("ER_") || ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(error.code);
}

function inferCodeFromSource(source: string, error: unknown): AppErrorCode {
  const explicit = readErrorCode(error);
  if (explicit) return explicit as AppErrorCode;

  const message = rawMessage(error);
  if (hasMysqlCode(error)) {
    const code = (error as { code?: string }).code;
    return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "PROTOCOL_CONNECTION_LOST"
      ? "MYSQL_UNAVAILABLE"
      : "MYSQL_QUERY_FAILED";
  }

  if (/can only contain letters|identifier|配置|config/i.test(message)) return "APP_CONFIG_INVALID";
  if (/is invalid|must be an object|missing .*id|request must/i.test(message)) return "APP_INVALID_ARGUMENT";
  if (/Pending course operation|pending/i.test(message)) return "PENDING_OPERATION_INVALID";

  if (/课程名称不能为空/.test(message)) return "COURSE_NAME_EMPTY";
  if (/课程不存在/.test(message)) return "COURSE_NOT_FOUND";
  if (/分区名称不能为空/.test(message)) return "SECTION_NAME_EMPTY";
  if (/分区名称已存在/.test(message)) return "SECTION_NAME_DUPLICATE";
  if (/分区不存在/.test(message)) return "SECTION_NOT_FOUND";

  if (/Mind map node is missing/.test(message)) return "DOCUMENT_NODE_MISSING";
  if (/Knowledge document snapshot must|Unsupported knowledge document snapshot/.test(message)) return "DOCUMENT_SNAPSHOT_INVALID";
  if (/Knowledge document snapshot exceeds/.test(message)) return "DOCUMENT_SNAPSHOT_TOO_LARGE";
  if (/Knowledge document snapshot contains oversized inline base64/.test(message)) return "DOCUMENT_INLINE_ASSET_BLOCKED";
  if (/Knowledge document request|Knowledge document status/.test(message)) return "DOCUMENT_REQUEST_INVALID";

  if (/Mind map snapshot must|Mind map snapshot root|Unsupported mind map snapshot/.test(message)) return "MINDMAP_SNAPSHOT_INVALID";
  if (/Mind map snapshot exceeds/.test(message)) return "MINDMAP_SNAPSHOT_TOO_LARGE";
  if (/Mind map snapshot contains oversized inline base64/.test(message)) return "MINDMAP_INLINE_ASSET_BLOCKED";
  if (/Mind map save request/.test(message)) return "MINDMAP_REQUEST_INVALID";

  if (/未找到 Chrome/.test(message)) return "CHROME_NOT_FOUND";
  if (/未配置 .*端口|端口 .*未就绪|未知的 Chrome/.test(message)) return "CHROME_PORT_NOT_CONFIGURED";
  if (/需要登录|登录状态|验证/.test(message)) return "CHROME_LOGIN_REQUIRED";

  if (/请输入要发送给 AI/.test(message)) return "AI_PROMPT_EMPTY";
  if (/未返回结果/.test(message)) return "AI_NO_RESPONSE";
  if (/AI|ChatGPT|Doubao|豆包|页面执行失败|发送按钮/.test(message)) return "AI_PROVIDER_UNAVAILABLE";

  if (/仓库|Release|版本号/.test(message)) return "UPDATE_CONFIG_INVALID";
  if (/更新检测|GitHub 更新检测|latest/i.test(message)) return "UPDATE_CHECK_FAILED";
  if (/下载|download/i.test(message)) return "UPDATE_DOWNLOAD_FAILED";
  if (/安装包|安装程序|install/i.test(message)) return "UPDATE_INSTALL_FAILED";

  if (source.startsWith("courses:")) return "COURSE_SAVE_FAILED";
  if (source.startsWith("course-sections:")) return "SECTION_NOT_FOUND";
  if (source.startsWith("mindmaps:")) return "MINDMAP_REQUEST_INVALID";
  if (source.startsWith("knowledge-documents:")) return "DOCUMENT_REQUEST_INVALID";
  if (source.startsWith("chrome-ports:")) return "CHROME_PORT_NOT_CONFIGURED";
  if (source.startsWith("updates:")) return "UPDATE_CHECK_FAILED";
  if (source.startsWith("error-logs:")) return "ERROR_LOG_READ_FAILED";
  return "APP_UNKNOWN";
}

export function classifyAppError(source: string, error: unknown, fallbackUserMessage?: string): ClassifiedAppError {
  const definition = getAppErrorDefinition(inferCodeFromSource(source, error));
  return {
    ...definition,
    userMessage: fallbackUserMessage || definition.userMessage,
    technicalMessage: readTechnicalMessage(error),
    context: error instanceof CodedAppError ? error.context : undefined
  };
}
