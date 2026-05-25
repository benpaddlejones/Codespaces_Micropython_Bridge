# Changelog

All notable changes to the Pi Pico to Codespaces Bridge extension.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).

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
