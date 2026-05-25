# Changelog

All notable changes to the Pi Pico to Codespaces Bridge extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.18] - 2026-05-25

### Fixed

- **Firmware download was silently failing after "Fetching..."** ([`bridge/public/js/tools/firmware.js`](bridge/public/js/tools/firmware.js), [`bridge/src/api/firmware.js`](bridge/src/api/firmware.js)): the bridge printed `📥 Fetching latest MicroPython for ...` and then nothing — no version, no download, no error. Two root causes:
  1. The download was triggered with `window.open(url, "_blank")` _after_ an `await`, which breaks the user-gesture chain and is silently swallowed by popup blockers / VS Code webviews. Replaced with a synthetic `<a target="_blank">` click, which the browser treats as a navigation and never blocks.
  2. The server-side `https.get` to micropython.org had no timeout, so any stalled connection (slow upstream, blocked egress) would wedge the API endpoint forever and the client just waited. Added a 15s server timeout and a 20s client-side `AbortController` so a hang now surfaces as a real error in the terminal.
  - Also surfaces the upstream error body (e.g. `HTTP 404` / `No firmware found`) instead of just the status text, and echoes the download URL after kickoff so the user can copy/paste it manually if their browser blocks it anyway.
- **"Uncertain upload outcome" after batched verify reply was unreadable** ([`bridge/public/js/tools/picoSync.js`](bridge/public/js/tools/picoSync.js)): when the device couldn't return `__VERIFY_DONE__` for a 26-file batch in time, the bridge gave up and asked the user to "run 📁 List to confirm" — leaving them guessing. The verifier now automatically retries in **chunks of 8 files**, each of which produces a small reply that fits in the REPL buffer even on a stressed device. If even that fails, it auto-runs `📁 List` itself so the user sees an authoritative on-device listing in the same flow, with no second click required.

## [2.1.17] - 2026-05-25

### Changed

- **Firmware dropdown rewritten on top of Bootstrap 5** ([`bridge/public/index.html`](bridge/public/index.html), [`bridge/public/style.css`](bridge/public/style.css), [`bridge/public/js/main.js`](bridge/public/js/main.js)): three iterations of hand-rolled CSS/JS dropdown (custom stacking-context, then `position: fixed` + JS `getBoundingClientRect()` positioning) all failed to make the menu reliably visible inside the bridge's nested flex/overflow layout. Bootstrap 5 (CSS + JS bundle including Popper) was already loaded for other UI, so the firmware split-button is now a standard `btn-group` + `dropdown-toggle dropdown-toggle-split` + `<ul class="dropdown-menu dropdown-menu-end">` component. Bootstrap handles open/close, outside-click, ESC, focus, and viewport-aware positioning automatically. Our code only populates the `<li>` items (grouped by category) and wires each one to `downloadFirmwareForBoard()`. The auto-detected board is highlighted with `.active` (✓ teal) on the `show.bs.dropdown` event. Removed the now-dead `.split-btn`, custom `.dropdown-menu`, and `positionMenu()` logic.

## [2.1.16] - 2026-05-25

### Fixed

- **Firmware dropdown invisible** ([`bridge/public/style.css`](bridge/public/style.css)): the split-button menu _was_ opening but was being painted behind the terminal area. `.header` had no `position`/`z-index`, while `#main-content` (its later flex sibling) declared `position: relative`, which made the terminal's stacking context paint on top of anything that overflowed the header. Giving `.header` `position: relative; z-index: 10` puts the whole header above `#main-content`, so the dropdown (and any future floating UI in the toolbar) drops down visibly over the terminal.

## [2.1.15] - 2026-05-25

### Fixed

- **Firmware dropdown was non-functional in 2.1.14** ([`bridge/public/js/main.js`](bridge/public/js/main.js)): the named imports `downloadFirmwareForBoard` and `getAllBoards` were missing from `main.js`, causing `ReferenceError: getAllBoards is not defined` the moment the user clicked the new chevron. The import block now correctly pulls both symbols from `./tools/firmware.js`.

## [2.1.14] - 2026-05-25

### Added

- **Firmware split-button** ([`bridge/public/index.html`](bridge/public/index.html), [`bridge/public/style.css`](bridge/public/style.css), [`bridge/public/js/main.js`](bridge/public/js/main.js), [`bridge/public/js/tools/firmware.js`](bridge/public/js/tools/firmware.js)): the `⬇️ Firmware` button in the System group is now a split-control. The main button still downloads the firmware for the auto-detected board; a new `▾` chevron beside it opens a grouped dropdown of every supported board (Raspberry Pi Pico / Generic RP2 / ESP32 / ESP8266) so the user can override when auto-detect picks wrong (typical case: a **Pico H running Pico W firmware** reports itself as "Pico W" because there's no way to tell from the banner that the CYW43 chip is physically absent). The currently-detected board is highlighted (✓ teal) in the menu so the difference between "what auto-detect saw" and "what you actually own" is obvious. Added `pico2_w` (Raspberry Pi Pico 2 W) to the board catalogue. New exported helper `getAllBoards()` in `firmware.js` returns the catalogue for menu construction.

## [2.1.13] - 2026-05-25

### Fixed

- **Terminal last-line clipping** ([`bridge/public/style.css`](bridge/public/style.css), [`bridge/public/js/terminal/setup.js`](bridge/public/js/terminal/setup.js)): the bottom row of xterm output (often the live `>>>` prompt or an upload progress line) was rendering partially behind the input bar. Increased `#terminal-container` bottom padding from 12px → 28px (more than one full cell height) and switched `scheduleFit()` from `fitAddon.fit()` to `proposeDimensions()` + manual `term.resize(cols, rows - 1)` to reserve a guaranteed safety row, eliminating sub-pixel rounding overlap.
- **Misleading upload-verification messages** ([`bridge/public/js/tools/picoSync.js`](bridge/public/js/tools/picoSync.js)): a slow `__VERIFY_DONE__` reply was being reported as `"failed verification”` and triggering a full re-upload of every file. The verify wait window was also far too tight (5 ms/file capped at 2 s). Now: (1) per-file slack raised to 40 ms with an 8 s cap; (2) if the device's reply doesn't arrive in time, the verify command itself is re-issued up to 4 times with progressively longer waits before any conclusion; (3) only real size mismatches now produce “re-uploading” output, and the message reads `“had wrong size on device”` instead of the generic “failed”; (4) if the device truly won't reply, a soft warning is shown (`“Upload likely succeeded — run 📁 List to confirm”`) rather than pretending every file is bad.

## [2.1.11] - 2026-05-25

### Added

- **Layer 4 — marker-based upload completion** ([`serial/rawRepl.js`](bridge/public/js/serial/rawRepl.js)): new `sendRawCommandUntilMarker(code, marker, maxWaitMs)` resolves the moment the device prints a unique sentinel, instead of blindly sleeping for the worst-case wait budget. Falls back to ~3x the payload-aware estimate as a hard timeout so a stuck device can never deadlock the UI. Helpers: `newMarker(tag)` (unique-per-call token) and `store.peekCapture()` (non-destructive buffer read).
- Single-file uploads (`writeSingleFile`) and both batch-upload sites in `uploadLib` / `uploadProject` now use the marker path. Net effect: a small file returns in roughly the round-trip time of the device's `print`, not the worst-case estimate — typical end-to-end overhead drops from ~4 s to ~150 ms per write.

## [2.1.10] - 2026-05-25

### Changed

- **Upload speed**: cut `DEVICE_BUDGET_PER_BYTE_MS` from `0.6` → `0.1` (a 32 KB file now waits ~3.7 s instead of ~23.8 s after send). Raised TX chunking from 128 bytes / 5 ms gap to 256 bytes / 2 ms gap (~110 KB/s host-side). Net result: small-file uploads feel instant; large files are 4–6× faster.
- **List Files timestamp filter** now hides any mtime older than `currentYear - 1`. Stock RP2 firmware ships without `LFS_MTIME` support, so `os.utime()` is a silent no-op and the mtime in `os.stat()` is whatever was stored when the file was first created on that filesystem (frequently months or years stale). The previous “drop if year ≤ 2000” rule wasn’t enough — stale 2021 dates were leaking through.

## [2.1.9] - 2026-05-25

### Added

- **Cache-busting middleware** ([`bridge/src/middleware/cacheBust.js`](bridge/src/middleware/cacheBust.js)) rewrites HTML asset URLs and relative ES module imports to include `?v=<BUILD_TOKEN>`. Token is generated at bridge server startup (`Date.now()`), so every extension/VS Code reload invalidates every cached browser-side module. Eliminates the stale-module class of bug that masked the 2.1.7 → 2.1.8 fixes.
- **Dynamic version banner** — the terminal welcome line now reads the version from a server-injected `<meta name="bridge-version">` instead of a hardcoded literal that drifted out of sync.
- **`GET /api/version`** endpoint returning `{ version, buildToken, startedAt }`.
- **ESLint coverage for bridge browser JS** (`bridge/public/js/**`) with `no-undef` and `no-unused-vars` set to `error`. Caught the entire class of bug that shipped in 2.1.7 (`bufferIfPaused` used without import) at lint time. Wired into `npm run lint` (also exposed as `npm run lint:bridge`).

### Fixed

- **Missing `sendRawCommandAndCapture` import** in [`tools/picoSync.js`](bridge/public/js/tools/picoSync.js) — the upload verification path (`verifyBatch`) referenced it without importing, so any verify call would throw `ReferenceError` at runtime. Caught by the new bridge lint.
- Removed several dead variables / unused imports flagged by the new lint (`lineEndingSelect`, `maxLen`, `detectionCallback`, unused `store` import in `firmware.js`, stale `eslint-disable` in `socket/index.js`).

## [2.1.8] - 2026-05-25

### Fixed

- **`ReferenceError: bufferIfPaused is not defined`** in the bridge browser terminal: `js/terminal/output.js` called `bufferIfPaused()` without importing it from `./controls.js`. Every `termWrite()` invocation (socket connect, serial reads, file ops, firmware download) was throwing into the console and breaking output. Added the missing named import.

## [2.1.7] - 2026-05-25

### Fixed

- **Slow first-install activation** - Extension no longer appears to hang in a "loading" state when first installed. Root causes addressed:
  - Removed `ms-python.python` from `extensionDependencies` (moved to `extensionPack`). VS Code was blocking our `activate()` until the Python extension finished its own slow first-run interpreter discovery; we don't actually need Python ext _active_ at activation time — only installed, which `extensionPack` still guarantees.
  - First-run welcome dialog is now fire-and-forget so VS Code doesn't keep reporting the extension as "loading" until the user clicks a button.
  - Workspace config write (Pylance `extraPaths`), `launch.json` provisioning, and `setContext` calls are now fire-and-forget instead of awaited inside `activate()`. Activation now returns in milliseconds instead of seconds.

## [2.1.6] - 2026-05-25

### Added

- **Terminal UX** - New "Jump to bottom" pill and "Pause output" toggle in the bridge browser terminal. xterm.js scrollback bumped to 10,000 lines, output coalesced via `requestAnimationFrame`, optional WebGL renderer for smoother long-output performance.
- **File listings show timestamps** - `List Files` now prints `path  Nb, YYYY-MM-DD HH:MM` using `os.utime`. Silently falls back to size-only when the device firmware lacks `utime`, and suppresses obviously-unset epoch dates (year 2000) since bare-metal boards have no RTC.
- **Upload verification + auto-retry** - Every `Upload Lib` / `Upload Project` is now followed by a Python-side `os.stat()` size check against the expected payload. Failed files are retried up to 2 times via single-file writes; surviving failures are reported with a clear `✗ path  expected Nb, got Mb` line.
- **Capture buffer for raw REPL** - New `sendRawCommandAndCapture()` helper + capture buffer in the state store lets internal tooling read device responses without leaking raw REPL chatter into the user terminal.

### Fixed

- **Terminal clipping** - Last line of output no longer hides behind the input bar. Flexbox `min-height: 0` fix on `#main-content`, `100dvh` body grid with `overflow:hidden`, FitAddon driven by a `ResizeObserver` on the terminal container _and_ surrounding chrome (header / input bar / toolbars), explicit padding on the terminal container, and `z-index` + box-shadow on the input bar.
- **Silent upload failures** - Large `main.py` payloads could time out before the device finished writing, leaving the entry-point file truncated or unwritten with no error reported. Two-pronged fix:
  - **Layer 1 — Payload-aware waits**: `computeWaitMs(codeBytes, payloadBytes)` derived from realistic `TX_BYTES_PER_SEC` + per-byte device budget + a 500ms floor. All raw-REPL upload paths now use it instead of a hard-coded wait.
  - **Layer 2 — Critical-files-last ordering**: `boot.py` and `main.py` are split out of batch uploads and written individually, last; remaining batched files are sorted largest-first so the slow ones get the lion's share of the wait budget.
  - **Layer 3 — Verify + auto-retry** (see Added).

### Test Infrastructure

- **Headless test runner** - `runTest.ts` now installs the declared `extensionDependencies` into the sandbox extensions dir (with a Codespaces symlink fallback for when the CLI sees the extension in `~/.vscode-remote/extensions/` and refuses to copy it). The activation test is tolerant of dependency activation stalling in headless environments and falls back to verifying command registration as a liveness proof.

## [2.1.4] - 2026-03-04

### Fixed

- **Marketplace images** - Converted absolute GitHub URLs to relative paths and added `--baseContentUrl` / `--baseImagesUrl` flags so demo GIFs and the CHANGELOG badge render correctly on the VS Code Marketplace
- **PWM events** - Emulator now emits granular `pwm_init`, `pwm_freq`, `pwm_duty`, and `pwm_deinit` events alongside the existing `pwm_update` event, fixing 12 integration-test failures

### Improved

- **JSDoc coverage** - Added missing docstrings across `webviewProvider.ts`, `bridgeServer.ts`, `statusView.ts`, `workspaceFiles.ts`, and the `PanelMessage` interface in `index.ts`

## [2.1.3] - 2026-03-02

### Added

- **Demo GIFs** - Moved `emulator.gif`, `terminal.gif`, and `upload.gif` into the extension package under `media/`
- **Demos section** - Added `## 🎬 Demos` section to README showcasing the emulator, terminal, and upload workflows
- **README internal links** - Feature bullets for MicroPython Emulator, REPL Terminal, and File Management now link directly to their demo subsections

## [2.1.0] - 2026-03-02

### Fixed

- **Logging** - `open_log_file()` no longer silently drops all errors after the first; now appends entries until `MAX_LOG_BYTES`, then rotates
- **launch.json parsing** - JSONC comment stripping now uses a state-aware parser that won't corrupt URLs or paths inside string values
- **IRQ safety** - Stop pin interrupt handler uses `micropython.schedule()` instead of raising exceptions directly in IRQ context (unsafe on real hardware)
- **ticks_diff wraparound** - `utime.ticks_diff()` and `ticks_add()` now implement correct 30-bit modular arithmetic matching real MicroPython behavior
- **Server retry limit** - Bridge server EADDRINUSE recovery now caps at 3 retries instead of recursing infinitely
- **Pin.toggle() double event** - `toggle()` reads internal state directly instead of calling `value()`, eliminating a spurious read event
- **machine.freq()** - Now stores and returns the set frequency instead of always returning 125MHz

### Changed

- **handler.py decomposition** - Extracted `_reconcile_location()` and `_format_timestamp()` from the monolithic `handle_exception()` function
- **Flash lazy allocation** - `rp2.Flash` defers its 2MB bytearray allocation until first use
- **Exception handler simplification** - Consolidated 8 identical `except` clauses into a mapping-based lookup
- **Config validation** - `run()` now validates `FILE_NAME`, `STOP_PIN_NUMBER`, and `CONTEXT_RADIUS` at startup with clear error messages
- **extension.ts cleanup** - Extracted `DEFAULT_DEBUG_CONFIG` constant (was copy-pasted 3 times); replaced 6 inline `require()` calls with top-level imports
- **utime.py formatting** - Converted from tabs to 4-space indentation to match project convention
- **neopixel events** - Emit `pin._id` (numeric) instead of `str(pin)` (repr string) for consistency with all other peripheral events
- **context.py precedence** - `line_no` now prefers exception args over traceback (matching `filename` precedence)
- **network.py type hints** - Added `Optional` annotations to all parameters with `= None` defaults

### Added

- **Test suite** - Created `test/test.py` with 36 tests covering all `lib/launcher` modules
- **Mock module tests** - Added 7 new mock validation tests (uhashlib, uio, ujson, uos, ure, usocket, uzlib), bringing total to 31
- **Assertion quality** - Strengthened ~25 weak assertions across both test files with exact value checks and error messages

## [2.0.1] - 2025-12-16

### Fixed

- **Port Cleanup** - Bridge server now kills processes on ports 3000 and 3001 before starting
- **Port Forwarding** - Extension automatically registers port forwarding with VS Code/Codespaces via `vscode.env.asExternalUri()`
- Removed devcontainer.json port forwarding settings (now handled by extension)

### Changed

- Improved server startup reliability with enhanced port conflict resolution
- Added pre-startup port cleanup to prevent stale process conflicts

## [2.0.0] - 2025-12-14

### Added

- **MicroPython Emulator** - Test code without hardware using mock modules
- **Pylance Integration** - Auto-configured IntelliSense for MicroPython imports
- **Debug Python File** command for stepping through emulator code with debugpy
- New API commands for external tool integration:
  - `picoBridge.getMockRunnerPath` - Get emulator runner path
  - `picoBridge.getMockPath` - Get mock modules path
  - `picoBridge.getSelectedBoard` - Get current emulator board type
- Sample scripts feature with board-specific demos (Pico, Pico W, ESP32)
- Comprehensive JSDoc documentation throughout codebase

### Changed

- Refactored URI resolution into shared utility module (`src/utils/uri.ts`)
- Improved logging: verbose debug messages now use `logger.debug()` level
- Enhanced error handling with consistent patterns across all modules
- All view providers now properly implement `vscode.Disposable`
- Updated activity bar title to "Pi Pico to Codespaces Bridge"

### Fixed

- Removed duplicate `isUri()` and `resolveUri()` functions
- Fixed sample scripts path to work correctly when extension is packaged
- Removed unused singleton pattern from Logger class
- Cleaned up misleading TODO comments and outdated code comments

### Technical

- Full TypeScript strict mode compliance
- ESLint passes with zero warnings
- All interfaces documented with property-level JSDoc

## [1.0.3] - 2025-12-10

### Changed

- Renamed extension display name to "Pi Pico to Codespaces Bridge"
- Updated web client favicon and header branding to match extension icon

## [1.0.2] - 2025-12-10

### Changed

- Allow workspace file listing when project markers are absent
- Added browser UI refresh control for manual workspace re-scan
- Improved filesystem scanning by ignoring `node_modules`
- Standardised project detection on `.micropico` marker

### Fixed

- File picker now surfaces loose `.py` files instead of returning empty list

## [1.0.1] - 2025-12-09

### Changed

- Rebuilt VSIX package with updated assets
- Documentation and packaging improvements

## [1.0.0] - 2025-12-08

### Added

- Initial stable release
- Bridge server management (start/stop)
- External browser integration for Web Serial API
- Status bar indicator with server state
- Activity bar panel with connection status
- Workspace files tree view for MicroPython projects
- Device interaction commands:
  - Run file on Pico
  - Upload file/project
  - List device files
  - Open REPL
  - Soft/Hard reset
  - Stop running code
- Configuration options:
  - Server port (default: 3000)
  - Auto-start on activation
  - Open browser on server start
  - Project exclude folders
- Keyboard shortcuts for common actions
- Getting started walkthrough

### Technical Notes

- Uses `vscode.env.openExternal()` for browser (required for Web Serial API)
- Uses `vscode.env.asExternalUri()` for Codespaces port forwarding
- Bridge server runs as Node.js child process
