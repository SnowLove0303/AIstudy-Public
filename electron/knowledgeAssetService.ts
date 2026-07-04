import { BrowserWindow, dialog, protocol, type IpcMainInvokeEvent, type OpenDialogOptions } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export const KNOWLEDGE_ASSET_PROTOCOL = "aistudy-asset";

export type KnowledgeAssetMysqlRuntime = {
  pool: Pool;
  assetTable: string;
  knowledgeAssetLinkTable: string;
};

export type KnowledgeAssetUploadResult = {
  canceled: boolean;
  assetId?: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
  width?: number;
  height?: number;
};

type KnowledgeAssetServiceDependencies = {
  getMysqlRuntime: () => Promise<KnowledgeAssetMysqlRuntime>;
  getDataPath: (...segments: string[]) => string;
  getEventWindow: (event: IpcMainInvokeEvent) => BrowserWindow | null;
};

type KnowledgeAssetChoiceRequest = {
  courseId?: unknown;
  mindMapId?: unknown;
  nodeId?: unknown;
  relationType?: unknown;
};

type KnowledgeAssetGeneratedImageRequest = KnowledgeAssetChoiceRequest & {
  dataUrl?: unknown;
  fileName?: unknown;
};

type KnowledgeAssetRow = RowDataPacket & {
  id: string;
  localPath: string;
  mimeType: string;
};

const IMAGE_EXTENSIONS = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"]
]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const GENERATED_PNG_DATA_URL_PATTERN = /^data:(image\/png);base64,([A-Za-z0-9+/=]+)$/;
const ASSET_ID_PATTERN = /^[A-Za-z0-9:_-]{1,96}$/;
const ASSET_REFERENCE_KEY = "aistudyAssetId";

function normalizeScopedId(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!ASSET_ID_PATTERN.test(text)) {
    throw new Error(`${label}无效`);
  }
  return text;
}

function normalizeRelationType(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "document-image" || text === "mindmap-node-image" ? text : "document-image";
}

function getKnowledgeAssetUrl(assetId: string) {
  return `${KNOWLEDGE_ASSET_PROTOCOL}://${encodeURIComponent(assetId)}`;
}

function createAssetId() {
  return `kasset_${randomUUID().replaceAll("-", "")}`;
}

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  return null;
}

function readImageDimensions(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === "image/gif" && buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (mimeType === "image/webp") {
    return readWebpDimensions(buffer);
  }
  if (mimeType === "image/jpeg" && buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);
      if (blockLength < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + blockLength;
    }
  }
  return null;
}

async function readImageFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = IMAGE_EXTENSIONS.get(ext);
  if (!mimeType) {
    throw new Error("请选择图片文件");
  }
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error("请选择图片文件");
  }
  if (stat.size <= 0 || stat.size > MAX_IMAGE_BYTES) {
    throw new Error("图片过大");
  }
  const buffer = await fs.readFile(filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const dimensions = readImageDimensions(buffer, mimeType);
  return {
    buffer,
    sha256,
    mimeType,
    byteSize: stat.size,
    ext: ext === ".jpeg" ? ".jpg" : ext,
    fileName: path.basename(filePath),
    width: dimensions?.width,
    height: dimensions?.height
  };
}

function normalizeGeneratedImageFileName(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  const safe = text.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").slice(0, 80);
  return safe ? (safe.toLowerCase().endsWith(".png") ? safe : `${safe}.png`) : "document-diagram.png";
}

function readGeneratedPngDataUrl(dataUrl: unknown, fileName: unknown) {
  const text = typeof dataUrl === "string" ? dataUrl.trim() : "";
  const match = text.match(GENERATED_PNG_DATA_URL_PATTERN);
  if (!match) {
    throw new Error("图片生成失败");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length <= 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("图片过大");
  }
  const mimeType = match[1];
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const dimensions = readImageDimensions(buffer, mimeType);
  return {
    buffer,
    sha256,
    mimeType,
    byteSize: buffer.length,
    ext: ".png",
    fileName: normalizeGeneratedImageFileName(fileName),
    width: dimensions?.width,
    height: dimensions?.height
  };
}

async function upsertKnowledgeAsset(
  connection: PoolConnection,
  assetTable: string,
  asset: {
    sha256: string;
    localPath: string;
    mimeType: string;
    byteSize: number;
  },
  now: Date
) {
  const assetId = createAssetId();
  await connection.execute(
    `INSERT INTO ${assetTable}
      (id, sha256, local_path, mime_type, byte_size, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
      local_path = VALUES(local_path),
      mime_type = VALUES(mime_type),
      byte_size = VALUES(byte_size),
      updated_at = VALUES(updated_at),
      deleted_at = NULL`,
    [assetId, asset.sha256, asset.localPath, asset.mimeType, asset.byteSize, now, now]
  );
  const [rows] = await connection.execute<KnowledgeAssetRow[]>(
    `SELECT id FROM ${assetTable} WHERE sha256 = ? AND deleted_at IS NULL LIMIT 1`,
    [asset.sha256]
  );
  return rows[0]?.id ?? assetId;
}

export async function syncKnowledgeAssetLinks(
  connection: PoolConnection,
  assetLinkTable: string,
  scope: {
    courseId: string;
    mindMapId: string;
    nodeId: string;
    documentId?: string;
    relationType: "document-image" | "mindmap-node-image";
    assetIds: string[];
  },
  now: Date
) {
  const documentId = scope.documentId ?? "";
  const uniqueAssetIds = Array.from(new Set(scope.assetIds.filter((assetId) => ASSET_ID_PATTERN.test(assetId))));

  await connection.execute(
    `UPDATE ${assetLinkTable}
     SET deleted_at = ?
     WHERE course_id = ?
       AND mind_map_id = ?
       AND node_id = ?
       AND document_id = ?
       AND relation_type = ?
       AND deleted_at IS NULL`,
    [now, scope.courseId, scope.mindMapId, scope.nodeId, documentId, scope.relationType]
  );

  for (const assetId of uniqueAssetIds) {
    await connection.execute(
      `INSERT INTO ${assetLinkTable}
        (id, asset_id, course_id, mind_map_id, node_id, document_id, relation_type, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE deleted_at = NULL`,
      [
        `kalink_${randomUUID().replaceAll("-", "")}`,
        assetId,
        scope.courseId,
        scope.mindMapId,
        scope.nodeId,
        documentId,
        scope.relationType,
        now
      ]
    );
  }
}

export function extractKnowledgeAssetIds(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (current: unknown) => {
    if (!current) return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current !== "object") return;
    const record = current as Record<string, unknown>;
    const assetId = record[ASSET_REFERENCE_KEY];
    if (typeof assetId === "string" && ASSET_ID_PATTERN.test(assetId)) {
      found.add(assetId);
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return Array.from(found);
}

export function createKnowledgeAssetService(dependencies: KnowledgeAssetServiceDependencies) {
  let isProtocolRegistered = false;

  const getAssetFilePath = async (assetId: string) => {
    const runtime = await dependencies.getMysqlRuntime();
    const [rows] = await runtime.pool.execute<KnowledgeAssetRow[]>(
      `SELECT id, local_path AS localPath, mime_type AS mimeType
       FROM ${runtime.assetTable}
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [assetId]
    );
    const row = rows[0];
    if (!row) return null;
    const assetsRoot = path.resolve(dependencies.getDataPath("assets"));
    const filePath = path.resolve(assetsRoot, row.localPath);
    if (!filePath.startsWith(`${assetsRoot}${path.sep}`)) return null;
    return { filePath, mimeType: row.mimeType };
  };

  const registerProtocolHandler = () => {
    if (isProtocolRegistered) return;
    isProtocolRegistered = true;
    protocol.handle(KNOWLEDGE_ASSET_PROTOCOL, async (request) => {
      const url = new URL(request.url);
      const assetId = decodeURIComponent(url.hostname || path.basename(url.pathname));
      if (!ASSET_ID_PATTERN.test(assetId)) return new Response("Asset not found", { status: 404 });

      try {
        const asset = await getAssetFilePath(assetId);
        if (!asset) return new Response("Asset not found", { status: 404 });
        const stat = await fs.stat(asset.filePath);
        if (!stat.isFile()) return new Response("Asset not found", { status: 404 });
        const body = Readable.toWeb(createReadStream(asset.filePath)) as unknown as BodyInit;
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": asset.mimeType,
            "Content-Length": String(stat.size),
            "Cache-Control": "public, max-age=31536000, immutable"
          }
        });
      } catch {
        return new Response("Asset not found", { status: 404 });
      }
    });
  };

  const chooseImage = async (event: IpcMainInvokeEvent, input: unknown): Promise<KnowledgeAssetUploadResult> => {
    const request = (input && typeof input === "object" ? input : {}) as KnowledgeAssetChoiceRequest;
    const courseId = normalizeScopedId(request.courseId, "课程");
    const mindMapId = normalizeScopedId(request.mindMapId, "导图");
    const nodeId = normalizeScopedId(request.nodeId, "节点");
    const relationType = normalizeRelationType(request.relationType);
    const window = dependencies.getEventWindow(event);
    const dialogOptions: OpenDialogOptions = {
      title: "选择图片",
      properties: ["openFile"],
      filters: [
        { name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }
      ]
    };
    const result = window ? await dialog.showOpenDialog(window, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) return { canceled: true };

    const source = await readImageFile(filePath);
    const localPath = path.join("knowledge-images", `${source.sha256}${source.ext}`).replace(/\\/g, "/");
    const targetPath = dependencies.getDataPath("assets", ...localPath.split("/"));
    const runtime = await dependencies.getMysqlRuntime();
    const connection = await runtime.pool.getConnection();
    const now = new Date();

    try {
      await connection.beginTransaction();
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (!existsSync(targetPath)) {
        await fs.writeFile(targetPath, source.buffer);
      }
      const assetId = await upsertKnowledgeAsset(connection, runtime.assetTable, {
        sha256: source.sha256,
        localPath,
        mimeType: source.mimeType,
        byteSize: source.byteSize
      }, now);
      if (relationType === "mindmap-node-image") {
        await syncKnowledgeAssetLinks(connection, runtime.knowledgeAssetLinkTable, {
          courseId,
          mindMapId,
          nodeId,
          relationType,
          assetIds: [assetId]
        }, now);
      }
      await connection.commit();
      return {
        canceled: false,
        assetId,
        url: getKnowledgeAssetUrl(assetId),
        fileName: source.fileName,
        mimeType: source.mimeType,
        byteSize: source.byteSize,
        width: source.width,
        height: source.height
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

  const createGeneratedImage = async (_event: IpcMainInvokeEvent, input: unknown): Promise<KnowledgeAssetUploadResult> => {
    const request = (input && typeof input === "object" ? input : {}) as KnowledgeAssetGeneratedImageRequest;
    const courseId = normalizeScopedId(request.courseId, "璇剧▼");
    const mindMapId = normalizeScopedId(request.mindMapId, "瀵煎浘");
    const nodeId = normalizeScopedId(request.nodeId, "鑺傜偣");
    const relationType = normalizeRelationType(request.relationType);
    const source = readGeneratedPngDataUrl(request.dataUrl, request.fileName);
    const localPath = path.join("knowledge-images", `${source.sha256}${source.ext}`).replace(/\\/g, "/");
    const targetPath = dependencies.getDataPath("assets", ...localPath.split("/"));
    const runtime = await dependencies.getMysqlRuntime();
    const connection = await runtime.pool.getConnection();
    const now = new Date();

    try {
      await connection.beginTransaction();
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (!existsSync(targetPath)) {
        await fs.writeFile(targetPath, source.buffer);
      }
      const assetId = await upsertKnowledgeAsset(connection, runtime.assetTable, {
        sha256: source.sha256,
        localPath,
        mimeType: source.mimeType,
        byteSize: source.byteSize
      }, now);
      if (relationType === "mindmap-node-image") {
        await syncKnowledgeAssetLinks(connection, runtime.knowledgeAssetLinkTable, {
          courseId,
          mindMapId,
          nodeId,
          relationType,
          assetIds: [assetId]
        }, now);
      }
      await connection.commit();
      return {
        canceled: false,
        assetId,
        url: getKnowledgeAssetUrl(assetId),
        fileName: source.fileName,
        mimeType: source.mimeType,
        byteSize: source.byteSize,
        width: source.width,
        height: source.height
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

  return {
    createGeneratedImage,
    chooseImage,
    registerProtocolHandler
  };
}
