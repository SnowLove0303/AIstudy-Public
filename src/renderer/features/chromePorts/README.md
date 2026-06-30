# Chrome Ports Module

## Scope

Chrome Ports owns the UI for fixed Chrome debugging-port login and status checks used by the assistant, MCP browser handoff, and external information collection flows.

Current files:

- `ChromePortManager.tsx`: port status cards, refresh, login-window opening, open-page handoff, and temporary login monitoring.

## Boundaries

- Renderer UI must not launch Chrome directly.
- Port probing, profile paths, CDP checks, and login-state detection are owned by Electron main.
- Saved status is metadata only; cookies and secrets are not written into JSON or MySQL. Metadata is written to the local runtime JSON and the fixed MySQL `chrome_port_states` table when MySQL is available.
- The real browser login state belongs to the per-platform Chrome profile directory. Production builds use a stable runtime root outside the app installation directory when `F:\` is available (`F:\AIstudyPublicCleanData\runtime\chrome-profiles`) so reinstalling, rebuilding, or cleaning `win-unpacked` does not erase login cookies. If an older build saved a profile under the exe-adjacent `AIstudyPublicData\runtime\chrome-profiles`, Electron main migrates it into the stable runtime root before launching Chrome.
- Port failures affect browser-assisted features only and must not block course, mind-map, or document editing.
- Current platform ids are `doubao`, `chatgpt`, `bilibili`, `zhihu`, `zhaopin`, `zhipin`, and `xiaohongshu`.

## User Flow

1. User opens the Chrome port page.
2. The UI loads current port status from `window.aistudyChromePorts.status`.
3. User opens a provider login window.
4. Main process starts or reuses Chrome with the provider's fixed profile and port.
5. The UI monitors for login recognition and lets the user refresh later if needed.
6. MCP or collection flows can request a platform page through the same fixed-port main-process API.

## Extension Rules

- Add new providers by extending the main-process port definitions and this typed UI surface together.
- Keep port numbers stable once released so saved profiles remain reusable.
- Do not expose Chrome profile paths or technical CDP errors in product-facing text.
- Add runtime diagnostics for every new provider dependency.
