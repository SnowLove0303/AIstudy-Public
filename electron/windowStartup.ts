import { BrowserWindow, ipcMain, type IpcMainEvent } from "electron";

const RENDERER_READY_CHANNEL = "app:renderer-ready";
const DEFAULT_REVEAL_FALLBACK_MS = 5000;

export function holdWindowUntilRendererReady(
  window: BrowserWindow,
  fallbackMs = DEFAULT_REVEAL_FALLBACK_MS
) {
  let isReadyToShow = false;
  let isRendererReady = false;
  let revealTimer: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    ipcMain.off(RENDERER_READY_CHANNEL, handleRendererReady);
  };

  const reveal = () => {
    if (!isReadyToShow || window.isDestroyed()) return;
    cleanup();
    window.show();
  };

  const handleRendererReady = (event: IpcMainEvent) => {
    if (event.sender !== window.webContents) return;
    isRendererReady = true;
    reveal();
  };

  ipcMain.on(RENDERER_READY_CHANNEL, handleRendererReady);
  window.once("ready-to-show", () => {
    isReadyToShow = true;
    if (isRendererReady) {
      reveal();
      return;
    }
    revealTimer = setTimeout(reveal, fallbackMs);
    revealTimer.unref();
  });
  window.once("closed", cleanup);
}
