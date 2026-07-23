import React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import "./StorageMaintenancePanel.css";

type StorageFootprintKind = "application" | "data" | "runtime-cache" | "database" | "backup" | "log" | "preference";

type StorageFootprintEntry = {
  id: string;
  name: string;
  kind: StorageFootprintKind;
  path: string;
  exists: boolean;
  bytes: number;
  files: number;
  directories: number;
  cleanable: boolean;
  note: string;
};

type DatabaseTableFootprint = {
  name: string;
  rowCount: number | null;
  dataBytes: number;
  indexBytes: number;
  totalBytes: number;
};

type DatabaseFootprint = {
  connected: boolean;
  provider: "mysql" | "tidb";
  sourceKey: string;
  database: string;
  totalBytes: number;
  tableCount: number;
  tables: DatabaseTableFootprint[];
  message: string;
};

export type StorageFootprintReport = {
  scannedAt: string;
  dataRoot: string;
  userDataRoot: string;
  appRoot: string;
  totalBytes: number;
  cleanableBytes: number;
  databaseBytes: number;
  entries: StorageFootprintEntry[];
  database: DatabaseFootprint;
};

export type CacheCleanupResult = {
  cleanedAt: string;
  releasedBytes: number;
  removedEntries: number;
  report: StorageFootprintReport;
};

function formatStorageSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function StorageMaintenancePanel() {
  const [report, setReport] = React.useState<StorageFootprintReport | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const scan = React.useCallback(() => {
    if (!window.aistudyRuntime?.storageFootprint) {
      setError("空间检测暂时不可用。");
      return;
    }

    setIsScanning(true);
    setMessage("");
    setError("");
    window.aistudyRuntime.storageFootprint()
      .then((nextReport) => {
        setReport(nextReport);
        setMessage(`可清理 ${formatStorageSize(nextReport.cleanableBytes)}。`);
      })
      .catch((scanError: unknown) => {
        setReport(null);
        setError(scanError instanceof Error ? scanError.message : "空间占用暂时无法检测。");
      })
      .finally(() => setIsScanning(false));
  }, []);

  const clean = React.useCallback(() => {
    if (!window.aistudyRuntime?.cleanCaches) {
      setError("缓存清理暂时不可用。");
      return;
    }

    setIsCleaning(true);
    setMessage("");
    setError("");
    window.aistudyRuntime.cleanCaches()
      .then((result) => {
        setReport(result.report);
        setMessage(`已释放 ${formatStorageSize(result.releasedBytes)}。`);
      })
      .catch((cleanError: unknown) => {
        setError(cleanError instanceof Error ? cleanError.message : "缓存暂时无法清理。");
      })
      .finally(() => setIsCleaning(false));
  }, []);

  React.useEffect(() => {
    scan();
  }, [scan]);

  const cacheEntries = report?.entries.filter((entry) => entry.id.startsWith("cache-")) ?? [];

  return (
    <div className="storage-maintenance-panel">
      <section className="settings-section storage-maintenance-intro">
        <div className="settings-section-heading">
          <div>
            <h3>存储空间</h3>
            <p>只清理可恢复缓存，资料和登录状态保留。</p>
          </div>
          <div className="runtime-check-actions">
            <button className="secondary-button" type="button" onClick={scan} disabled={isScanning || isCleaning}>
              <RefreshCw size={15} />
              {isScanning ? "检测中" : "重新检测"}
            </button>
            <button className="primary-button" type="button" onClick={clean} disabled={isScanning || isCleaning || !report?.cleanableBytes}>
              <Trash2 size={15} />
              {isCleaning ? "清理中" : "清理缓存"}
            </button>
          </div>
        </div>
      </section>

      {message ? <p className="update-status">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      {report ? (
        <>
          <section className="storage-summary-grid" aria-label="空间占用汇总">
            <article>
              <span>总占用</span>
              <strong>{formatStorageSize(report.totalBytes)}</strong>
            </article>
            <article>
              <span>可清理</span>
              <strong>{formatStorageSize(report.cleanableBytes)}</strong>
            </article>
            <article>
              <span>数据库</span>
              <strong>{formatStorageSize(report.databaseBytes)}</strong>
            </article>
          </section>

          <section className="storage-cache-list" aria-label="缓存项目">
            {cacheEntries.map((entry) => (
              <article className={entry.cleanable ? "storage-cache-entry cleanable" : "storage-cache-entry"} key={entry.id}>
                <div>
                  <strong>{entry.name}</strong>
                  <span>{entry.note}</span>
                </div>
                <em>{formatStorageSize(entry.bytes)}</em>
              </article>
            ))}
          </section>
        </>
      ) : (
        <div className="pane-empty-state runtime-empty-state">
          <strong>{isScanning ? "正在检测" : "暂未检测"}</strong>
        </div>
      )}
    </div>
  );
}
