import React from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import type { KnowledgeDocumentSnapshot } from "../documents/knowledgeDocumentTypes";
import { createDocumentImportPreview, isSupportedImportFile } from "./documentImportParser";
import type { ImportPreview, ImportTargetContext } from "./importTypes";

type ImporterDialogProps = {
  target: ImportTargetContext;
  onClose: () => void;
  onCommit: (snapshot: KnowledgeDocumentSnapshot) => Promise<void> | void;
};

function formatByteSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getUserImportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("UNSUPPORTED")) return "这个文件暂时不能导入。";
  if (message.includes("TOO_LARGE")) return "文件内容太大，请先拆分后再导入。";
  if (message.includes("EMPTY")) return "没有识别到可导入内容。";
  return "文件解析没有完成，请换一个文件试试。";
}

export function ImporterDialog({ target, onClose, onCommit }: ImporterDialogProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [message, setMessage] = React.useState("");

  const parseFile = React.useCallback(async (file: File | null | undefined) => {
    if (!file || isParsing || isCommitting) return;
    if (!isSupportedImportFile(file)) {
      setPreview(null);
      setMessage("支持 txt、md、docx。");
      return;
    }

    setIsParsing(true);
    setMessage("");
    try {
      const nextPreview = await createDocumentImportPreview(file, target);
      setPreview(nextPreview);
      setMessage("");
    } catch (error) {
      setPreview(null);
      setMessage(getUserImportError(error));
    } finally {
      setIsParsing(false);
    }
  }, [isCommitting, isParsing, target]);

  const commitPreview = React.useCallback(async () => {
    if (!preview || isCommitting) return;
    setIsCommitting(true);
    setMessage("");
    try {
      await onCommit(preview.snapshot);
      setMessage("已导入");
      window.setTimeout(onClose, 260);
    } catch {
      setMessage("导入内容没有保存成功，请稍后再试。");
    } finally {
      setIsCommitting(false);
    }
  }, [isCommitting, onClose, onCommit, preview]);

  return (
    <div className="importer-backdrop" role="presentation">
      <section className="importer-dialog" role="dialog" aria-modal="true" aria-label="导入">
        <header className="importer-header">
          <strong>导入</strong>
          <button className="icon-button" title="关闭" aria-label="关闭导入" type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <button
          className={isDragging ? "importer-dropzone dragging" : "importer-dropzone"}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void parseFile(event.dataTransfer.files.item(0));
          }}
          disabled={isParsing || isCommitting}
        >
          <span className="importer-drop-icon">
            {isParsing ? <Loader2 size={28} /> : <UploadCloud size={30} />}
          </span>
          <span>{isParsing ? "解析中" : "拖入文件"}</span>
          <em>txt / md / docx</em>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.docx"
          hidden
          onChange={(event) => {
            void parseFile(event.currentTarget.files?.item(0));
            event.currentTarget.value = "";
          }}
        />

        {preview ? (
          <div className="importer-preview">
            <div className="importer-preview-title">
              <FileText size={18} />
              <div>
                <strong>{preview.package.source.fileName}</strong>
                <span>{formatByteSize(preview.package.source.byteSize)}</span>
              </div>
            </div>
            <div className="importer-preview-stats">
              <span>{preview.package.summary.blockCount} 段</span>
              <span>{preview.package.summary.characterCount} 字</span>
              <span>{target.title || "当前节点"}</span>
            </div>
            <div className="importer-preview-lines">
              {preview.package.blocks.slice(0, 5).map((block) => (
                <p className={block.kind === "heading" ? "heading" : ""} key={block.id}>{block.text}</p>
              ))}
            </div>
          </div>
        ) : null}

        {message ? <p className="importer-message">{message}</p> : null}

        <footer className="importer-footer">
          <button className="secondary-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" type="button" onClick={commitPreview} disabled={!preview || isCommitting}>
            <CheckCircle2 size={15} />
            {isCommitting ? "导入中" : "导入当前节点"}
          </button>
        </footer>
      </section>
    </div>
  );
}
