# Changelog

All notable changes to the Pi Pico to Codespaces Bridge extension.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

## [2.3.41] - 2026-07-01

- **Fixed**: Cancelling the browser's serial port picker no longer shows a red "Error" state — it now reports a friendly "Connection cancelled" message.
- **Fixed**: Unplugging or resetting the device mid-session no longer produces uncaught `NetworkError` / `UnknownError` promise rejections; the read and write stream pipes are now caught and routed through a single cleanup path.
- **Fixed**: Disconnecting after a device was lost no longer throws "reader has been released" — teardown steps are individually guarded and idempotent, so the UI resets cleanly and reconnection works.
- **Security**: The `serial-data` socket handler now validates input at the boundary — non-string/empty payloads are dropped and a single chunk is capped at 64 KB to prevent flooding the shared REPL.

## [2.3.40] - 2026-05-30

- **Performance**: Project Files panel now paints its styled shell instantly on load, with a "Loading project…" placeholder shown until the file tree is ready — no more waiting for the panel to appear after everything else.
- **Fixed**: Eliminated a render race where the panel could stay blank — the webview message listener is now wired up before the HTML is set, and an initial render is pushed as soon as the view resolves.
- **Fixed**: Project Files panel keeps its content and styling when hidden and reshown (`retainContextWhenHidden`), so it no longer loses its CSS on layout changes or when the server starts.
- **Changed**: Each Python file shows a single device action (Run / Upload via Browser) when the server is running, replacing the two redundant device buttons.
- **Fixed**: Per-file action icons (Run in Emulator, Debug, device) now use the official VS Code codicon glyphs at native size, so they match the rest of the UI.
- **Fixed**: Broad recursive file watcher no longer triggers a render storm — changes under `.git`, `.venv`, `node_modules`, `__pycache__`, and other cache/VCS folders are ignored.
- **Changed**: Removed the redundant title-bar buttons from the Project Files view; per-file actions live on each row instead.

## [2.3.34] - 2026-05-30

- **Performance**: Panel rendering is no longer laggy — logs are batched per animation frame, pin lookups are cached, and SVG assets are only read from disk once.
- **Performance**: Sidebar loads faster — project detection is now async (no longer blocks activation), file-watcher callbacks are debounced, and `.py` saves no longer trigger a full project re-scan.
- **Fixed**: Board detection now correctly identifies official Raspberry Pi Pico boards using both USB Vendor ID and Product ID; all other RP2040 boards are labelled "Generic RP2040".

## [2.3.33] - 2026-05-29

- **Improved**: Raw-REPL protocol is more reliable — uses MicroPython's standard handshake markers instead of fixed sleeps, sends a double Ctrl-C before each command, and surfaces device-side tracebacks on upload failure.
- **Fixed**: File uploads are now binary-safe (non-UTF-8 and mixed content round-trip correctly).
- **Fixed**: Chunked uploads wait for device acknowledgement before sending the next chunk.
- **Added**: Device files can be renamed (with automatic folder creation) from the Files panel.
- **Changed**: Device command titles say "(in Browser)" to reflect they operate via the Web Serial bridge.

## [2.3.32] - 2026-05-29

- **Added**: **Push All →** and **← Pull All** buttons in the Files panel for one-click full sync in either direction.
- **Added**: Pull warns before overwriting existing repo files; device-only files are pulled without prompting.
- **Fixed**: CSP no longer blocks Socket.io connections through the Codespaces HTTPS proxy.
- **Security**: Added CSRF protection, loopback-only server binding, secure headers, and tightened PTY/esptool permissions.
- **Fixed**: Extension now tracks the server's actual listening port, fixing status desync when the default port is taken.

## [2.3.31] - 2026-05-26

- **Changed**: First-run notification now opens the README instead of the walkthrough.
- **Fixed**: Rerunning a script always executes the latest saved version.

## [2.3.30] - 2026-05-26

- **Fixed**: Device-detection spinner no longer leaves stray characters in the terminal.

## [2.3.28] - 2026-05-26

- **Added**: Animated device-detection spinner with silent mode.
- **Added**: Chunked file uploads to handle large files on RP2040.
- **Changed**: Richer upload/delete/pull feedback messages and responsive layout improvements.

## [2.3.12] - 2026-05-26

- **Changed**: Sync-status helpers extracted into a dedicated module for easier testing.
- **Added**: Unit tests for sync service, sync-status helpers, and the bridge API.

## [2.3.10] - 2026-05-26

- **Added**: Sync-status rows grouped by directory with one-click folder pull.
- **Added**: Modification times shown in the Files panel; timestamps handle MicroPython's 2000-epoch correctly.
- **Changed**: Workspace file listing skips `__pycache__`; sync reads files in 4 KiB chunks.

## [2.3.2] - 2026-05-25

- **Added**: Device pinout and richer REPL device details in the browser UI.
- **Changed**: VSIX build/install workflow now stages releases to `releases/`.

## [2.3.1] - 2026-05-25

- **Fixed**: Accessibility — correct tab/ARIA semantics, WCAG AA contrast, arrow-key tab navigation, focus trapping in modals, accessible labels on icon-only buttons.

## [2.3.0] - 2026-05-25

- **Added**: REPL, Files, and Plotter as persistent tabs with saved active-tab state.
- **Changed**: Sync UI is inline on the Files tab (no longer a modal).
- **Changed**: Plotter streams while the tab is active; stops on tab leave.

## [2.2.1] - 2026-05-25

- **Added**: Workspace ↔ Pico sync panel — lists every file with sync status (synced / modified / not deployed / orphan), per-file Push/Pull/Delete, inline diff, Push All, and Mirror mode.

## [2.2.0] - 2026-05-25

- **Added**: Mock modules for `asyncio`, `framebuf`, `deflate`, `vfs`, `errno`, `platform`, `machine.Signal`, `micropython.RingIO`, `network.WLAN.config/ipconfig`, `utime.strftime`.
- **Added**: `--max-ticks` runner flag to stop infinite-loop demos in CI.
- **Fixed**: Mock injection is now idempotent and no longer shadows stdlib modules.

## [2.1.18] - 2026-05-25

- **Fixed**: Firmware download no longer fails silently; popup-blocker-safe download and proper error reporting on timeout.
- **Fixed**: Large file-list verification auto-retries in smaller chunks on truncation.

## [2.1.14] - 2026-05-25

- **Added**: Firmware split-button — flash auto-detected board or pick any supported board from a dropdown. Added Pico 2 W to the catalogue.

## [2.1.11] - 2026-05-25

- **Changed**: Upload completion is now marker-based instead of sleep-based (~150 ms vs ~4 s per file).

## [2.1.10] - 2026-05-25

- **Changed**: Upload speed — large files are 4–6× faster.

## [2.1.9] - 2026-05-25

- **Added**: Cache-busting for bridge assets so VS Code reloads always get fresh JS/CSS.
- **Added**: Dynamic version banner in the terminal welcome line.
- **Added**: ESLint coverage for all bridge JS.

## [2.1.7] - 2026-05-25

- **Fixed**: Slow first-install activation — extension now activates in milliseconds instead of seconds.

## [2.1.6] - 2026-05-25

- **Added**: Terminal "Jump to bottom" pill, "Pause output" toggle, 10 k-line scrollback, and optional WebGL renderer.
- **Added**: `List Files` shows timestamps; upload verifies each file with auto-retry.

## [2.1.4] - 2026-03-04

- **Fixed**: Marketplace images render correctly.
- **Fixed**: Emulator emits granular PWM events.

## [2.1.0] - 2026-03-02

- **Fixed**: Log rotation, `launch.json` parsing, IRQ-safe stop handler, `ticks_diff`/`ticks_add` wraparound, server port retry cap.
- **Added**: 36-test launcher suite and 7 new mock validation tests.

## [2.0.0] - 2025-12-14

- **Added**: MicroPython emulator, Pylance auto-config, debugpy integration, board-specific sample scripts.

## [1.0.3] - 2025-12-10

- Renamed extension to "Pi Pico to Codespaces Bridge".

## [1.0.2] - 2025-12-10

- Allow workspace listing without project markers; manual refresh button; standardised on `.micropico` marker.

## [1.0.0] - 2025-12-08

- Initial release: bridge server, Web Serial integration, status bar, device commands, workspace files tree, walkthrough.

## [2.3.33] - 2026-05-29

- **Changed**: Reworked the raw-REPL protocol to use MicroPython's read-until-marker handshake (matching the Arduino `micropython.js` reference). Exec now completes on the universal `\x04>` frame terminator (or an injected marker) instead of a blind sleep, sends a double Ctrl-C (`\r\x03\x03`) to interrupt any running program first, waits for the `raw REPL; CTRL-B to exit` banner, and keeps a sleep fallback so it never regresses below the previous timing.
- **Changed**: File uploads are now binary-safe end-to-end. Single-file and batch writes open the destination in `'wb'` mode and feed `a2b_base64(...)` bytes directly (previously `'w'` + `.decode()`), matching the already-binary large-file chunked path so non-UTF-8 and mixed content round-trip byte-for-byte.
- **Added**: Upload now parses the raw-REPL `OK<stdout>\x04<stderr>\x04>` result frame and surfaces any device-side traceback to the terminal instead of silently succeeding.
- **Changed**: Chunked uploads now wait for each chunk's `\x04>` acknowledgement before sending the next, giving the device real request/response backpressure.
- **Added**: Device Files panel can rename device files/orphans (with implicit folder creation when renaming into a new directory) via `os.rename`.
- **Changed**: Device command titles now say "(in Browser)" to reflect that they open the Web Serial bridge in the browser rather than acting on the device from the extension host.

## [2.3.32] - 2026-05-29

- **Added**: Device Files panel now has bulk **Push All →** (workspace → device) and **← Pull All** (device → workspace) buttons with hover labels describing exactly what each overwrites. Only the two explicit directions are offered — there is no automatic two-way "Sync" — so the user resolves any modified-file conflict by choosing which side wins. Buttons hide themselves when there is nothing to do.
- **Added**: Pull now requires explicit approval before overwriting existing repo files. A pull (single-file or Pull All) that would replace files already in the repo with a differing device copy pops up a warning listing the affected files; brand-new (device-only) files are pulled without prompting. Push is unaffected — deploying the workspace to the device is normal behaviour.
- **Fixed**: Bridge UI no longer hits `connect-src` Content-Security-Policy violations when served through the GitHub Codespaces forwarded `*.app.github.dev` HTTPS proxy. `connect-src` now allows `https:` alongside `ws:`/`wss:` so Socket.io polling and websocket upgrades reconnect cleanly. The security boundary remains the loopback bind and the Socket.io origin guard.
- **Security**: Added a dependency-free security middleware (`bridge/src/middleware/security.js`) that rejects cross-site state-changing (non-GET) requests and Socket.io handshakes via `Sec-Fetch-Site` with `Origin`/`Host` fallback — closing CSRF and unauthenticated-trigger gaps on `/api/restart`, `/api/esptool/install`, `/api/resilience/errors/clear`, and `/api/workspace/file`.
- **Security**: Bridge server now binds `127.0.0.1` by default (`PICO_BRIDGE_HOST` override) to defend against DNS-rebinding, and serves CSP plus `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers.
- **Security**: socat PTY/symlink tightened to owner-only (`mode=600`); esptool flash-command validates `port` (allow-list) and `filename` (basename) before reflecting them.
- **Changed**: Removed legacy Engine.IO v3 compatibility (`allowEIO3`) from the Socket.io server.
- **Fixed**: Extension now adopts the server's actual listening port (printed as `PICO_BRIDGE_PORT=<n>`) for health polling, status, and browser open, fixing desync when the default port was taken.
- **Fixed**: Port cleanup derives the port from config and verifies the PID's command line contains `server.js` before signalling, avoiding killing unrelated processes.
- **Changed**: Enforced a single active controller for the device PTY — extra browser tabs are read-only until the controller disconnects, preventing interleaved REPL writes.

## [2.3.31] - 2026-05-26

- **Changed**: First-run welcome notification action now opens the extension README instead of launching the walkthrough.
- **Fixed**: Launcher templates now force a fresh script import by clearing `sys.modules[FILE_NAME]` before `__import__`, ensuring reruns execute updated student code.

## [2.3.30] - 2026-05-26

- **Fixed**: Device-detection spinner no longer leaves a stray `e` artifact in the terminal when the MicroPython REPL echoes characters before silent mode engages. The spinner now starts on a clean row and uses ANSI erase-to-end-of-line (`\x1b[K`) on every redraw and on stop.

## [2.3.28] - 2026-05-26

- **Added**: Animated device-detection spinner with silent mode that suppresses raw REPL chatter during board identification.
- **Added**: Chunked file uploads to prevent RP2040 memory exhaustion on large files.
- **Added**: Marker watcher that reacts dynamically to project switches.
- **Changed**: Richer upload / delete / pull feedback messages in the bridge UI.
- **Changed**: File scanner now picks up additional project file types for upload.
- **Changed**: Responsive style tweaks for narrow viewports.

## [2.3.12] - 2026-05-26

- **Changed**: Extracted sync-status helpers into a dedicated module (`syncStatusHelpers.js`) for easier testing.
- **Added**: Unit tests covering `syncService`, `syncStatusHelpers`, and the bridge API surface.

## [2.3.10] - 2026-05-26

- **Added**: Grouped sync-status rows that collapse files by parent directory in a VS Code-style explorer panel.
- **Added**: `actionPullFolder` to pull every orphan file from a directory in one click.
- **Added**: `formatMtime` helper that correctly handles MicroPython's 2000 epoch timestamps.
- **Added**: Modification time and improved action buttons in each sync row.
- **Added**: `lib/`-aware upload buttons that disable themselves when the project has no `lib/` folder.
- **Changed**: Workspace file listing now includes modification times; file walks skip `__pycache__`.
- **Changed**: Sync-status reads files in 4 KiB chunks for better performance.
- **Removed**: Unused `tabs.js` tab controller.
- **Strengthened**: Community hardware tests with deeper assertions for PWM, I2C, SPI, UART, RTC, pin IRQs, NeoPixel, WLAN, and timing.

## [2.3.2] - 2026-05-25

- **Added**: Device Docs/Pinout and richer REPL device details in the browser UI.
- **Added**: Bulk "Pull All Device Code" action in the Sync panel for one-click device-to-repo sync.
- **Changed**: VSIX build/install/copy workflow now robustly stages releases to the releases/ folder.
- **Fixed**: Version badge and changelog now sync with extension version.

## [2.3.1] - 2026-05-25

Accessibility pass on the bridge browser UI.

- **Fixed**: Files tab label rendered as `  Device` mojibake  now `  Device`.
- **Fixed**: Docs button had blue link text on a blue button background  now explicit white across default/visited/hover/active/focus.
- **Fixed**: WCAG AA contrast failures on `.btn-hard` (3.99  5.04) and `.btn-debugpy` (4.12  5.13) plus their hover states.
- **Added**: full ARIA tablist semantics  tab buttons carry `id`, `aria-controls`, roving `tabindex`; tab panels carry `id`, `role="tabpanel"`, `aria-labelledby`.
- **Added**: arrow-key navigation in the tab strip (Left/Right wrap, Home/End jump to first/last).
- **Added**: accessible names (`aria-label`) on icon-only buttons (refresh, restart server, modal close   buttons), unlabelled selects (`#baudRate`, `#filePicker`, `#lineEnding`), the serial input, and the destructive Wipe button.
- **Added**: modals (`#syncDiffModal`, `#pinoutModal`) marked with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- **Added**: focus trap for both modals (new `js/ui/focusTrap.js`)  Tab/Shift+Tab wrap inside the modal, ESC closes, focus restored to the trigger element on close.
- **Changed**: REPL tab now shows Device-info, Device tab now hosts Docs + Pinout (references for working with the board).

## [2.3.0] - 2026-05-25

Paginated UI: REPL, Files, and Plotter are now first-class tabs.

- **Added**: tab strip directly under the connection toolbar with three views — 💻 **REPL** (terminal + Run/Stop/Soft/Hard/Pinout/Docs), 📦 **Files** (Upload File/Lib/All, Boot/Firmware/Wipe, Device info, and the full Workspace ↔ Pico sync UI inlined), 📈 **Plotter** (live plot + Clear/Freeze/Save PNG/Fullscreen/Auto-Scale).
- **Changed**: the Sync UI is no longer a modal — it lives on the Files tab and is rendered inline, so push/pull/diff/mirror are always one click away when you're managing files.
- **Changed**: the Plotter is no longer a toolbar checkbox — entering the Plotter tab streams data, leaving it stops streaming. The legacy `#plotterCheck` control was removed.
- **Changed**: each tab owns its own toolbar and body via `data-tab` so unrelated controls (e.g. the REPL input bar) are hidden when not relevant.
- **Added**: active tab is persisted to `localStorage` (`picoBridge.activeTab`) and restored on reload; first visit to the Files tab auto-refreshes sync status.
- **Internal**: new `bridge/public/js/tools/tabs.js` controller; `syncStatus.js` no longer manages modal open/close; `plotter/controls.js` no longer wires `#plotterCheck`.

## [2.2.1] - 2026-05-25

Workspace ↔ Pico sync, with file-level diff, directly in the bridge browser UI.

- **Added**: 🔄 **Sync** toolbar button + Sync Status modal. Lists every deployable workspace file alongside what's on the connected Pico, classified by SHA-256 as `synced` / `modified` / `not-deployed` / `orphan-on-device`.
- **Added**: per-row **Push / Pull / Delete** actions and a **Diff** modal (LCS line diff, in-browser, no dependency).
- **Added**: **Push All** and **Mirror Mode** bulk operations (Mirror also deletes device-only files).
- **Added**: server endpoints `GET /api/workspace/sync-status`, `GET /api/workspace/file`, `POST /api/workspace/file` — path-traversal-guarded, 1 MB/4 MB caps, restricted to `.py .mpy .json .txt .html .css .js .csv .cfg .ini .toml .md` and never touches `node_modules` / `.git` / `release` / hidden dirs.
- **Added**: device-side listing via raw REPL — walks `/` and computes `uhashlib.sha256` per file, framed by sentinel markers.
- **Added**: 29 new bridge unit/integration tests (`npm run test:bridge`) — diff LCS correctness + HTML escaping, sync service walker + traversal guard + hashing, REST API round-trip with a temp fixture project.
- **Added**: `test:bridge` and `test:extension` npm scripts. `npm test` now runs both.

## [2.2.0] - 2026-05-25

Emulator now covers a much wider slice of modern MicroPython, plus a way to bound `while True:` demos in CI.

- **Added**: mocks for `asyncio`, `framebuf`, `deflate`, `vfs`, `errno`, `platform`.
- **Added**: `machine.Signal`, `machine.IRQ_LOW_LEVEL`/`IRQ_HIGH_LEVEL`, `micropython.RingIO`, full `network.WLAN.config` round-trip + `ipconfig`, `utime.strftime`.
- **Added**: `--max-ticks N` / `EMULATOR_MAX_TICKS` runner flag — stops infinite-loop demos cleanly after N `sleep` calls.
- **Added**: pinned MicroPython API baseline test (1.20 → 1.23) so the mock can't silently drift from the real API.
- **Added**: 14 new mock tests. Suite is 124/124 in `test/test.py` and 31/31 in `mock_validation_test.py`.
- **Fixed**: `uselect.poll().poll(ms)` now honours the `ms` timeout.
- **Fixed**: stdlib-named mocks (`asyncio`/`errno`/`platform`) no longer self-shadow; runner stashes real modules under `_real_*` sentinels before injection.
- **Fixed**: `_inject_mock_modules` is now idempotent — tests that call it again can't re-shadow stdlib mid-run.
- **Fixed**: `py_scripts/performance_profile.py` now uses `time.ticks_us()`/`ticks_diff()` (real-MicroPython-compatible) instead of CPython-only `time.perf_counter()`.

## [2.1.18] - 2026-05-25

- **Fixed**: Firmware download silently failed after "Fetching…". Swapped `window.open()` after `await` for a synthetic `<a target=_blank>` click (popup-blocker safe), and added 15 s server + 20 s client timeouts so stalled fetches surface as real errors.
- **Fixed**: After a 26-file verify reply was truncated, the bridge used to say "run List to confirm". Now auto-retries in 8-file chunks, and if that still fails, runs `📁 List` itself.

## [2.1.17] - 2026-05-25

- **Changed**: Firmware dropdown rewritten on Bootstrap 5 — handles open/close, outside-click, ESC, focus and viewport positioning for us. Removed all hand-rolled positioning logic.

## [2.1.16] - 2026-05-25

- **Fixed**: Firmware dropdown was being painted behind the terminal. Gave `.header` `position: relative; z-index: 10` so any floating toolbar UI stacks above `#main-content`.

## [2.1.15] - 2026-05-25

- **Fixed**: `ReferenceError: getAllBoards is not defined` clicking the firmware chevron in 2.1.14 — `main.js` was missing the named imports from `tools/firmware.js`.

## [2.1.14] - 2026-05-25

- **Added**: Firmware split-button. Main button still flashes the auto-detected board; the `▾` chevron opens a grouped menu of every supported board so you can override when auto-detect gets it wrong (e.g. a Pico H reporting itself as Pico W). Added Pico 2 W to the catalogue.

## [2.1.13] - 2026-05-25

- **Fixed**: Bottom row of the terminal hid behind the input bar. Bumped padding to 28 px and switched fit logic from `fit()` to `proposeDimensions()` + manual `resize(cols, rows-1)`.
- **Fixed**: Slow `__VERIFY_DONE__` replies were being reported as "failed verification" and triggering full re-uploads. Per-file slack now 40 ms (8 s cap), verify is retried up to 4× with growing waits, only real size mismatches re-upload, and a true no-reply shows a soft warning instead of crying wolf.

## [2.1.11] - 2026-05-25

- **Added**: Marker-based upload completion (`sendRawCommandUntilMarker`) — resolves the moment the device prints a sentinel instead of sleeping the worst-case budget. Per-write overhead drops from ~4 s to ~150 ms.

## [2.1.10] - 2026-05-25

- **Changed**: Upload speed — cut `DEVICE_BUDGET_PER_BYTE_MS` 0.6 → 0.1 (32 KB file: ~23.8 s → ~3.7 s) and raised TX chunking to 256 B / 2 ms gap. Large files are 4–6× faster.
- **Changed**: `List Files` now hides any mtime older than `currentYear - 1` (RP2 firmware without `LFS_MTIME` was leaking stale 2021 dates through the old "year ≤ 2000" filter).

## [2.1.9] - 2026-05-25

- **Added**: Cache-busting middleware — rewrites HTML asset URLs and ES module imports with `?v=<BUILD_TOKEN>` so every VS Code reload invalidates the browser cache.
- **Added**: Dynamic version banner in the terminal welcome line (via injected `<meta name="bridge-version">`); `GET /api/version` endpoint.
- **Added**: ESLint coverage for `bridge/public/js/**` with `no-undef`/`no-unused-vars` as errors. Caught the 2.1.7 missing-import bug at lint time.
- **Fixed**: Missing `sendRawCommandAndCapture` import in `picoSync.js` — verify path threw `ReferenceError` at runtime.

## [2.1.8] - 2026-05-25

- **Fixed**: `ReferenceError: bufferIfPaused is not defined` in `terminal/output.js` broke every `termWrite()` call. Added the missing named import.

## [2.1.7] - 2026-05-25

- **Fixed**: Slow first-install activation — moved `ms-python.python` from `extensionDependencies` to `extensionPack` so we don't block on Python ext startup, made the welcome dialog and workspace-config writes fire-and-forget. Activation now returns in ms instead of seconds.

## [2.1.6] - 2026-05-25

- **Added**: Terminal "Jump to bottom" pill and "Pause output" toggle; xterm scrollback to 10 k lines; rAF-coalesced output; optional WebGL renderer.
- **Added**: `List Files` shows timestamps (`path  Nb, YYYY-MM-DD HH:MM`), falls back to size-only when firmware lacks `utime`, suppresses year-2000 placeholder dates.
- **Added**: Upload verification + auto-retry — every upload is followed by an on-device `os.stat()` check; failed files retry up to 2×.
- **Added**: `sendRawCommandAndCapture()` + capture buffer for internal tooling that needs device responses without leaking raw REPL chatter.
- **Fixed**: Terminal last-line clipping (flexbox `min-height: 0`, `100dvh` grid, ResizeObserver-driven FitAddon, input-bar `z-index`).
- **Fixed**: Silent upload failures on large `main.py` — payload-aware wait formula, critical files written last, verify + auto-retry.

## [2.1.4] - 2026-03-04

- **Fixed**: Marketplace images — converted absolute GitHub URLs to relative and added `--baseContentUrl`/`--baseImagesUrl` so demo GIFs render.
- **Fixed**: Emulator now emits granular `pwm_init`/`pwm_freq`/`pwm_duty`/`pwm_deinit` events (fixes 12 integration-test failures).
- **Improved**: JSDoc coverage across `webviewProvider.ts`, `bridgeServer.ts`, `statusView.ts`, `workspaceFiles.ts`, `PanelMessage`.

## [2.1.3] - 2026-03-02

- **Added**: Demo GIFs (`emulator.gif`, `terminal.gif`, `upload.gif`) packaged under `media/`.
- **Added**: `## 🎬 Demos` section in README with internal anchors from the feature list.

## [2.1.0] - 2026-03-02

- **Fixed**: Log rotation, JSONC parsing of `launch.json`, IRQ-safe stop handler (`micropython.schedule()`), correct 30-bit `ticks_diff`/`ticks_add` wraparound, capped server `EADDRINUSE` retries, removed spurious `Pin.toggle` read event, `machine.freq()` returns the value it was set to.
- **Changed**: Refactor pass — decomposed `handle_exception()`, lazy `rp2.Flash` allocation, mapping-based exception lookup, startup config validation, extracted `DEFAULT_DEBUG_CONFIG`, tabs → 4-space in `utime.py`, numeric `pin._id` in neopixel events.
- **Added**: 36-test suite for `lib/launcher`, 7 new mock validation tests (total 31), tightened ~25 weak assertions.

## [2.0.1] - 2025-12-16

- **Fixed**: Bridge server kills processes on ports 3000/3001 before starting; auto-registers port forwarding via `vscode.env.asExternalUri()`. Removed devcontainer port settings (now handled by the extension).

## [2.0.0] - 2025-12-14

- **Added**: MicroPython emulator (run code without hardware), Pylance auto-config, "Debug Python File" command with debugpy, external API commands (`getMockRunnerPath`/`getMockPath`/`getSelectedBoard`), board-specific sample scripts.
- **Changed**: Shared `src/utils/uri.ts`, `logger.debug()` for verbose output, consistent error handling, all view providers implement `Disposable`.
- **Fixed**: Duplicate `isUri`/`resolveUri` removed, sample-scripts path works when packaged, removed dead singleton in `Logger`.
- **Technical**: Full TypeScript strict mode, zero-warning ESLint, property-level JSDoc.

## [1.0.3] - 2025-12-10

- Renamed extension to "Pi Pico to Codespaces Bridge"; refreshed favicon and header branding.

## [1.0.2] - 2025-12-10

- Allow workspace listing without project markers; manual refresh button; ignore `node_modules`; standardised on `.micropico` marker; file picker now surfaces loose `.py` files.

## [1.0.1] - 2025-12-09

- Rebuilt VSIX with updated assets; doc/packaging polish.

## [1.0.0] - 2025-12-08

- Initial stable release: bridge server start/stop, external-browser Web Serial integration, status bar + activity bar UI, workspace files tree, device commands (run/upload/list/REPL/reset/stop), configurable port and auto-start, keyboard shortcuts, getting-started walkthrough.
