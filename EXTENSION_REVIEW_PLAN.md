# VS Code Extension Review Plan

> **Status:** Plan only — no review or code changes have been performed yet.
> **Goal:** Identify improvements to **functionality**, **stability**, **MicroPython connectivity/controls**, and **security** (including at minimum CSRF protection, even though the bridge runs locally inside a Codespace).
> **Scope root:** `.extension/`

---

## How this review will work

The extension has two cooperating halves:

| Layer                     | Location             | Responsibility                                                                                |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| VS Code host (TypeScript) | `.extension/src/`    | Activation, commands, lifecycle of the bridge child process, emulator, status UI              |
| Node bridge server (JS)   | `.extension/bridge/` | Express + Socket.io server, PTY/socat serial bridge, REST API, resilience modules, browser UI |

Each phase below states **(a) the documentation to read first**, **(b) the files to inspect**, and **(c) what we are looking for**. Phases are ordered so that findings in early phases inform later ones. No code is changed during the review; findings are recorded, then a remediation plan is proposed separately.

---

## Phase 0 — Baseline & Reproducibility

**Docs to review first:**

- `.extension/README.md`, root `README.md`, `.extension/CHANGELOG.md`
- `.extension/package.json` (scripts, `contributes`, `activationEvents`, engines)
- `.extension/bridge/package.json` (dependencies, scripts)
- VS Code Extension API: https://code.visualstudio.com/api (Activation Events, Extension Anatomy)

**Inspect:**

- Build/run tasks in `.extension/.vscode/tasks.json` and `.extension/webpack.config.js`
- Existing tests: `.extension/bridge/test/*.mjs`, `.extension/src/test/`

**Looking for:**

- Confirm how to build, run, lint, and test (establish a green baseline).
- Map dependency versions and flag anything outdated/unmaintained.
- Verify activation events are scoped (avoid activating on every workspace unnecessarily).

---

## Phase 1 — Extension Host Lifecycle & Activation

**Docs to review first:**

- VS Code API: Activation Events, `ExtensionContext`, disposables/subscriptions — https://code.visualstudio.com/api/references/activation-events
- VS Code API: Commands — https://code.visualstudio.com/api/extension-guides/command

**Inspect:**

- `src/extension.ts` (`activate`/`deactivate`)
- `src/commands/index.ts`
- `src/utils/logger.ts`, `src/utils/config.ts`, `src/utils/projectUtils.ts`, `src/utils/uri.ts`

**Looking for:**

- All disposables registered to `context.subscriptions` (no leaks on deactivate).
- `deactivate()` reliably tears down the bridge child process.
- Command handlers guard against "server not started" / "no active editor" states.
- Consistent error surfacing (user-facing messages vs. silent logs).

---

## Phase 2 — Bridge Server Process Management (Stability)

**Docs to review first:**

- Node.js `child_process` (spawn, signals, stdio) — https://nodejs.org/api/child_process.html
- Node.js process signals & graceful shutdown — https://nodejs.org/api/process.html

**Inspect:**

- `src/server/bridgeServer.ts` (`killProcessesOnPorts`, `start`, health polling, external-browser open)
- `src/server/index.ts`
- `.extension/bridge/start-resilient.sh`, `.extension/bridge/ecosystem.config.js`

**Looking for:**

- Use of `lsof`/`kill -9` — validate it can't kill unrelated processes; prefer targeted, reversible handling.
- Race conditions between port-kill, spawn, and health check.
- Orphaned child processes if VS Code crashes or the window reloads.
- Startup failure handling and clear user feedback (port in use, node missing).

---

## Phase 3 — MicroPython Connectivity: PTY / socat / Serial Bridge

**Docs to review first:**

- mpremote docs — https://docs.micropython.org/en/latest/reference/mpremote.html
- MicroPython raw REPL / paste mode — https://docs.micropython.org/en/latest/reference/repl.html
- `socat` man page (PTY linking) — https://linux.die.net/man/1/socat
- Web Serial API — https://developer.mozilla.org/docs/Web/API/Web_Serial_API
- node Socket.IO server/client — https://socket.io/docs/v4/

**Inspect:**

- `bridge/src/pty/socat.js` (PTY pair creation, `/dev/pts/X` parsing, cleanup, timeout, crash handling)
- `bridge/src/pty/index.js` (`initialize`, `write`, `onData`, `getStatus`, `shutdown`)
- `bridge/server.js` Socket.io `serial-data` bidirectional bridge (lines ~181–260) and PTY recovery (`initializePtyWithRecovery`, ~260–400)
- Browser side: `bridge/public/js/serial/connection.js`, `rawRepl.js`, `index.js`, `bridge/public/js/socket/index.js`

**Looking for (best-practice connectivity & controls):**

- Robustness of `/dev/pts/X` parsing (regex brittleness, locale, buffering).
- Backpressure/flow control on the serial↔socket data path (large pastes, binary data, framing).
- Reconnection semantics: device unplug, socat crash, browser tab close, multiple clients.
- Correct handling of raw REPL / Ctrl-C / Ctrl-D control sequences and soft/hard reset commands.
- Single-writer guarantees (avoid two clients writing to one PTY).
- Resource cleanup of symlinks and PTYs on every exit path.

---

## Phase 4 — REST API Surface & File Operations

**Docs to review first:**

- Express routing & error handling — https://expressjs.com/en/guide/routing.html , https://expressjs.com/en/guide/error-handling.html
- Node.js `fs`/path traversal guidance — https://nodejs.org/api/path.html
- OWASP Path Traversal — https://owasp.org/www-community/attacks/Path_Traversal

**Inspect:**

- `bridge/src/api/index.js`, `files.js`, `health.js`, `system.js`, `firmware.js`, `esptool.js`
- `bridge/src/services/fileService.js`, `fileWatcher.js`, `syncService.js`
- `bridge/firmware_downloads/` handling and any download URLs

**Looking for:**

- Path traversal / arbitrary file read-write in file endpoints (validate & confine to workspace).
- Input validation on all route params/bodies.
- Command injection risk in `esptool`/`system`/firmware shell-outs.
- Consistent async error handling via `safeRoute`.

---

## Phase 5 — Security Review (explicitly includes CSRF)

**Docs to review first:**

- OWASP Top 10 — https://owasp.org/www-project-top-ten/
- OWASP CSRF Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Express security best practices — https://expressjs.com/en/advanced/best-practice-security.html
- Helmet — https://helmetjs.github.io/
- Socket.IO security / handshake auth & CORS — https://socket.io/docs/v4/handshake/ , https://socket.io/docs/v4/server-options/#cors
- DNS-rebinding protection for local servers (Host/Origin allow-listing)

**Inspect:**

- `bridge/server.js` middleware stack (~90–110) and Socket.io setup (~75–86)
- `bridge/src/middleware/cacheBust.js`
- `bridge/config/index.js`

**Looking for (current state confirmed: no CSRF/auth/CORS/helmet present):**

- **CSRF:** the server exposes state-changing endpoints (file write, upload, firmware flash, reset) over a browser-reachable origin with no token — add at minimum a CSRF token or same-origin enforcement. Even locally, a malicious web page in the same browser can POST to `localhost`/forwarded Codespace port.
- **Origin/Host allow-listing:** protect against DNS-rebinding for the local/forwarded port.
- **CORS / Socket.io origin restriction:** lock to the bridge's own origin.
- **Security headers:** evaluate Helmet (CSP for the served UI, `X-Content-Type-Options`, etc.).
- **Codespace port forwarding exposure:** confirm whether the port is private vs. public and document the risk.
- **No secrets in logs**; safe handling of any tokens/build tokens already generated.

> Deliverable for this phase: a concrete, minimal CSRF design (e.g., per-session token endpoint + token check middleware, or `Origin`/`Sec-Fetch-Site` validation) sized to a local-first tool.

---

## Phase 6 — Resilience & Health Subsystem

**Docs to review first:**

- Node uncaughtException / unhandledRejection guidance — https://nodejs.org/api/process.html#event-uncaughtexception
- Circuit breaker / self-healing patterns (general)

**Inspect:**

- `bridge/src/resilience/errorHandler.js`, `healthMonitor.js`, `processGuard.js`, `portManager.js`, `index.js`
- `/api/resilience*` diagnostic endpoints in `server.js`

**Looking for:**

- Heal hooks don't mask real faults or create restart loops.
- Diagnostic endpoints don't leak sensitive environment info (ties to Phase 5).
- Memory/PTY heal thresholds are sound; logging is bounded (no unbounded error arrays).

---

## Phase 7 — Browser UI Client

**Docs to review first:**

- Web Serial API (permissions, reconnection) — https://developer.mozilla.org/docs/Web/API/Web_Serial_API
- Content Security Policy — https://developer.mozilla.org/docs/Web/HTTP/CSP

**Inspect:**

- `bridge/public/index.html`, `style.css`
- `bridge/public/js/` — `main.js`, `terminal/`, `plotter/`, `state/`, `ui/`, `tools/`, `serial/`, `socket/`

**Looking for:**

- XSS sinks (innerHTML with device data — terminal/plotter output must be escaped).
- Reconnect/clear-state UX on disconnect.
- CSRF token wiring on the client once added (Phase 5).

---

## Phase 8 — Emulator & Mock Integrity (cross-check)

**Docs to review first:**

- MicroPython library docs — https://docs.micropython.org/
- Repo rule: `.github/copilot-instructions.md` Section 4 (mock must mirror real MicroPython; no spot-fix shims)

**Inspect:**

- `.extension/emulator/` (`index.ts`, `webviewProvider.ts`, `pylanceConfig.ts`)
- `.extension/emulator/mock/` and `runner.py`, plus `emulator/mock/AUDIT_REPORT.md`

**Looking for:**

- Mock/typing drift from real APIs (no aliases/shims).
- Validation command per repo rule: `python3 .extension/emulator/mock/runner.py py_scripts/mock_validation_test.py`.

---

## Phase 9 — Functionality Completeness & Feature-Gap Analysis

**Purpose:** Step back from "is the code correct" and ask **"is the feature set complete, fully implemented, and implemented the best way?"** This phase audits intended vs. actual behaviour.

**Docs to review first:**

- Declared capabilities: `.extension/README.md`, `.extension/CHANGELOG.md`, `.extension/package.json` `contributes` (commands, menus, configuration, walkthroughs)
- Walkthrough content: `.extension/media/walkthrough/*.md`
- VS Code UX guidelines — https://code.visualstudio.com/api/ux-guidelines/overview
- mpremote feature set (as the connectivity benchmark) — https://docs.micropython.org/en/latest/reference/mpremote.html

**Method — cross-check the three sources of truth:**

1. **Advertised** — every command/setting/walkthrough promised in README, CHANGELOG, and `package.json`.
2. **Wired** — does each advertised command have a registered handler in `src/commands/index.ts` / `src/extension.ts`, a menu/keybinding, and reachable UI (`src/views/*`)?
3. **Working** — does the handler do the full job, or is it a stub / partial / TODO / "coming soon"?

**Inspect:**

- `src/commands/index.ts`, `src/extension.ts` — every `registerCommand`; flag stubs, `TODO`, `notImplemented`, empty catch blocks, commands that only log.
- `package.json` `contributes.commands` vs. `contributes.menus` / `keybindings` — commands with no menu, palette-only commands, or menus pointing at missing commands.
- `src/views/bridgeToolsView.ts`, `statusView.ts`, `workspaceFiles.ts` — buttons/items that are disabled, hidden, or non-functional.
- Bridge API (`bridge/src/api/*`) and UI (`bridge/public/js/*`) — endpoints with no UI, UI controls with no backend, half-built panels (plotter, terminal, tools).

**Looking for — concrete gap categories:**

- **Missing features:** capabilities expected of a MicroPython tool but absent (e.g., file _download from_ device, directory delete/rename, `mip`/package install, filesystem tree refresh, board auto-detect, baud/port selection, firmware-flash progress, mount/RTC sync).
- **Partially implemented:** commands that exist but cover only the happy path (e.g., upload single file but not whole-folder recursion, run-file but no stop/interrupt, REPL open but no paste-mode for large scripts).
- **Could be implemented better:** features that work but not the best way (e.g., polling where an event/watcher fits, shell-out where a library call is cleaner, blocking UI during long operations, no progress/cancellation, no retry on transient serial errors).
- **Discoverability gaps:** working features users can't find (no menu, no walkthrough step, no status-bar affordance).
- **Consistency gaps:** emulator vs. real-device feature parity; commands behaving differently across Pico / Pico W / Pico 2 W / ESP32.

**Deliverable:** a feature matrix — _Feature → Advertised? / Wired? / Working? / Best-practice? → recommendation (add | complete | improve | document)_.

---

## Phase 10 — Synthesis & Prioritised Findings

**Output of the review (after approval to proceed):**

1. Findings log categorised as **Functionality**, **Feature Completeness**, **Stability**, **Connectivity**, **Security**.
2. Severity + effort matrix (Critical / High / Medium / Low).
3. Minimal, reversible remediation proposals (smallest change that satisfies each fix).
4. Explicit CSRF remediation design and test approach.
5. Regression checklist: extension build/lint/test, bridge tests (`.extension/bridge/test/*.mjs`), and emulator mock validation.

---

## Documentation index (quick reference)

- VS Code Extension API — https://code.visualstudio.com/api
- Node.js child_process / process — https://nodejs.org/api/child_process.html , https://nodejs.org/api/process.html
- Express routing / errors / security — https://expressjs.com/en/guide/routing.html , https://expressjs.com/en/advanced/best-practice-security.html
- Helmet — https://helmetjs.github.io/
- Socket.IO v4 — https://socket.io/docs/v4/
- Web Serial API — https://developer.mozilla.org/docs/Web/API/Web_Serial_API
- mpremote / raw REPL — https://docs.micropython.org/en/latest/reference/mpremote.html
- socat — https://linux.die.net/man/1/socat
- OWASP Top 10 / CSRF / Path Traversal — https://owasp.org/www-project-top-ten/ , https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- MicroPython library docs — https://docs.micropython.org/

---

# Review Findings

> **Status:** Review completed and security/stability fixes applied. Findings are ID'd `Fxx`, tagged with severity **[Critical / High / Medium / Low / Info]** and category.
> Every finding is now resolved into one of three states: **✅ Implemented**, **❌ Invalid / by design (false)**, or **⏳ Outstanding**. See the [Outstanding tasks](#outstanding-tasks) section for the only work that still needs doing.

## Severity summary

| ID  | Severity | Category           | Title                                                                                              |
| --- | -------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| F01 | High     | Security           | No CSRF protection on state-changing endpoints                                                     |
| F02 | High     | Security           | Socket.io has no origin check — any web page can drive the device                                  |
| F03 | High     | Security/Stability | `/api/restart` + `/api/esptool/install` are unauthenticated remote triggers                        |
| F04 | Medium   | Security           | Server binds `0.0.0.0`; no `Origin`/`Host` allow-list (DNS-rebinding)                              |
| F05 | Medium   | Security           | No security headers (Helmet/CSP) on the served UI                                                  |
| F06 | Low      | Security           | socat PTY created world read/write (`mode=666`)                                                    |
| F07 | Low      | Security           | esptool flash-command reflects `port`/`filename` into a shell string                               |
| F08 | High     | Stability          | Server alt-port fallback desyncs the extension (wrong port used)                                   |
| F09 | Medium   | Stability          | `killProcessesOnPorts` hardcodes 3000/3001 and can kill unrelated PIDs                             |
| F10 | High     | Connectivity       | PTY→browser data sent via `.toString()` corrupts binary serial data                                |
| F11 | Medium   | Connectivity       | No single-writer guarantee — multiple tabs write to one PTY                                        |
| F12 | Medium   | Connectivity       | No backpressure on serial↔socket path                                                              |
| F13 | Info     | Functionality      | VS Code device commands open the browser UI (by design, not a defect)                              |
| F14 | Low      | Functionality      | Minor real gaps (`mip` install, device rename/mkdir) — most "gaps" already exist in the browser UI |
| F15 | Low      | Stability          | `allowEIO3: true` enables legacy Engine.IO v3 unnecessarily                                        |
| F16 | Info     | Resilience         | "Never exit on fatal" can mask real faults                                                         |
| F17 | Medium   | Connectivity       | Raw-REPL hand-rolled with blind `sleep()` timing instead of the documented raw-paste/ack handshake |

---

## Implementation status (this pass)

> Validated with: `node --test .extension/bridge/test/` (82 pass), `npm run compile` + `npm run lint` in `.extension` (0 errors), and `python3 .extension/emulator/mock/runner.py py_scripts/mock_validation_test.py` (31 pass).

| ID  | Status                 | Change                                                                                                                                                                                                                                                                                            |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | ✅ Implemented         | New `bridge/src/middleware/security.js` rejects cross-site non-GET requests via `Sec-Fetch-Site` (primary) + `Origin`/`Host` fallback. Header-based ⇒ zero expiry, never stales out a long-open tab.                                                                                              |
| F02 | ✅ Implemented         | `io.use(createSocketOriginGuard())` rejects cross-site socket handshakes using the same check.                                                                                                                                                                                                    |
| F03 | ✅ Implemented         | `/api/restart`, `/api/esptool/install`, `/api/resilience/errors/clear`, `/api/workspace/file` are all non-GET ⇒ now covered by the F01 middleware.                                                                                                                                                |
| F04 | ✅ Implemented         | `config/index.js` now binds `127.0.0.1` by default (`PICO_BRIDGE_HOST` override); origin check adds DNS-rebinding defence.                                                                                                                                                                        |
| F05 | ✅ Implemented         | Security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) added in `security.js`; CSP scoped to self + jsDelivr + inline styles + data/blob + ws/wss.                                                                                                                |
| F06 | ✅ Implemented         | socat PTY/symlink changed to `mode=600` (owner-only).                                                                                                                                                                                                                                             |
| F07 | ✅ Implemented         | `esptool/flash-command` validates `port` (allow-list regex) and `filename` (basename) before reflecting them.                                                                                                                                                                                     |
| F08 | ✅ Implemented         | Server prints `PICO_BRIDGE_PORT=<n>`; the extension parses stdout and adopts the real port for health polling / status / browser open.                                                                                                                                                            |
| F09 | ✅ Implemented         | `killProcessesOnPorts` derives the port from config, verifies the PID's command line contains `server.js`, and uses `SIGTERM`→`SIGKILL`.                                                                                                                                                          |
| F11 | ✅ Implemented         | Single active controller enforced server-side; extra tabs are read-only until the controller disconnects.                                                                                                                                                                                         |
| F15 | ✅ Implemented         | `allowEIO3: true` removed from the Socket.io server options.                                                                                                                                                                                                                                      |
| F10 | ⏳ Outstanding         | Binary-safe forwarding needs a coordinated client+server refactor of the working text-REPL path (remove `TextDecoderStream`, emit/handle binary frames). Genuine latent bug for binary `mpremote cp`/`.mpy` transfers; not browser/Codespaces confusion. Too risky to do without device hardware. |
| F12 | ⏳ Outstanding         | No device-driven flow control on the serial↔socket / REPL path. Best fixed by adopting raw-paste mode (see F17), which provides windowed backpressure natively. Real but low-frequency; needs hardware to validate.                                                                               |
| F13 | ❌ Invalid (by design) | **By design.** Device is local + Web Serial is Chromium/browser-only + extension host is remote in the Codespace ⇒ commands correctly hand off to the browser, which already implements run/upload/stop/reset. No code change needed (optional wording tweak only).                               |
| F14 | ❌ Mostly invalid      | Download (Pull), delete (Wipe + per-row), baud (`#baudRate`), and stop/interrupt all already exist in the browser UI; port selection is the Web Serial prompt by design. Only `mip` install + device rename/mkdir are genuine niche gaps (tracked under Outstanding).                             |
| F16 | ❌ Invalid (by design) | Behaviour kept by design; logging is already bounded via `/api/resilience`.                                                                                                                                                                                                                       |
| F17 | ⏳ Outstanding         | Raw-REPL is reimplemented with blind `sleep()` timing + fixed 256-byte chunking instead of the documented raw-paste/ack handshake. Functional today (propped up by marker + sha256-verify + retry) but not best practice. Protocol rewrite needs device hardware to validate.                     |

---

## Outstanding tasks

These are the **only** items that still need doing. Everything else is either ✅ implemented or ❌ invalid/by-design (see table above). None require new dependencies; all touch the live serial/REPL data path, so each needs **physical device hardware to validate** before merging.

| #   | ID   | Priority | Task                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | F17  | High     | **Adopt the MicroPython raw-paste handshake.** Replace blind `sleep()`/chunk timing in `public/js/serial/rawRepl.js` with the documented protocol: wait for `raw REPL; CTRL-B to exit\r\n>`, request raw-paste (`\x05A\x01`), honour the device's windowed flow control, and read the `OK` + dual-`\x04` stdout/stderr frames. Subsumes F12 and lets the marker/verify/retry scaffolding be retired. |
| 2   | F10  | High     | **Binary-safe serial forwarding.** `server.js` must stop using `data.toString()` and the browser read loop must stop using `TextDecoderStream`; forward raw `Buffer`/`Uint8Array` (or consistent base64) both directions so `.mpy`/binary `mpremote cp` survive intact.                                                                                                                              |
| 3   | F12  | Medium   | **Device-driven backpressure.** Folded into F17 for the REPL path; separately, respect `serialPort.write` drain / pause the socket stream when the buffer is full so large pastes can't outrun the device.                                                                                                                                                                                           |
| 4   | F17a | Low      | **Binary-safe file upload.** `picoSync.js` writes via `ubinascii.a2b_base64(...).decode()` into `open(...,'w')` — text-only. Switch to bytes + `'wb'` so non-UTF-8 files upload correctly (same root cause as F10).                                                                                                                                                                                  |
| 5   | F14  | Low      | **Niche feature backlog.** Add `mip`/package install and device-side rename/mkdir to the browser UI. Optional, low value.                                                                                                                                                                                                                                                                            |
| 6   | F13  | Trivial  | **Optional wording.** Reword VS Code command titles (e.g. "Run Current File on Pico") to signal the browser hand-off. Pure UX nicety; not a fix.                                                                                                                                                                                                                                                     |

---

## Security

### F01 — [High] No CSRF protection on state-changing endpoints

**Evidence:** `bridge/server.js` middleware stack is only `cacheBust → express.static → express.json → activity-log`. State-changing routes exist with no token: `POST /api/workspace/file` (writes workspace files, `src/api/files.js`), `POST /api/restart` (`src/api/system.js`), `POST /api/esptool/install`, `POST /api/resilience/errors/clear`. Because the port is reachable from the browser (and forwarded in Codespaces), any other page open in the same browser can issue cross-site POSTs.

**Fix (minimal, local-first):** Validate `Origin`/`Sec-Fetch-Site` on every non-GET request (reject when `Origin` is not the bridge's own origin), **or** issue a CSRF token from a `GET /api/csrf` endpoint and require it via a custom header (`X-Pico-CSRF`) checked in a small middleware. A custom header alone also defeats simple form-based CSRF since browsers won't add it cross-origin without a CORS preflight grant.

**Staleness / long-shelf-life requirement (important for this tool's usage):** Students and makers leave the bridge tab open for hours or days. The CSRF mechanism **must not expire mid-session** and break uploads/REPL with a confusing 403. Design it so a stale token never blocks a legitimate user:

- **Preferred — `Origin`/`Sec-Fetch-Site` check (no token, zero expiry):** purely header-based, so there is _nothing to go stale_. A tab open for a week still passes as long as it's same-origin. This is the recommended primary defence for a local-first tool.
- **If a token is also used — make it long-lived and self-healing:**
  - Bind the token to the **server process lifetime** (one secret generated at startup, reused for every request) — _not_ a short sliding TTL. The token only changes when the bridge restarts.
  - Serve it as a **non-`HttpOnly` cookie + readable `GET /api/csrf`** so the client can re-read it any time (double-submit-cookie pattern), rather than caching a value in JS memory that goes stale.
  - On the client, fetch/refresh the token **lazily right before each state-changing request** (and transparently retry once on a 403 after re-fetching), so a server restart while the tab was idle self-heals on the next action instead of erroring.
  - Avoid per-request nonces, rotation, and idle timeouts entirely — they are the usual cause of "CSRF cracked on timeout" failures and add no real security here since the origin check already gates cross-site use.

> Net effect: security comes from origin/same-site enforcement (no expiry), and any token is a stable, process-lifetime value that the client can always re-read — so a long-open window never gets locked out.

### F02 — [High] Socket.io accepts any origin — device control is unauthenticated

**Evidence:** `bridge/server.js` `new Server(server, {...})` sets no `cors.origin` and no handshake auth. The `serial-data` handler writes straight to the PTY (`ptyBridge.write(data)`). Any website can open a socket to the forwarded URL and send bytes to the connected microcontroller.
**Fix:** Set Socket.io `cors: { origin: <bridge origin> }` and/or verify `socket.handshake.headers.origin` in `io.use(...)`; reject mismatched origins. Tie to the same token as F01.

### F03 — [High] Unauthenticated remote side effects (`/api/restart`, `/api/esptool/install`)

**Evidence:** `POST /api/restart` calls `process.exit(0)` after 500 ms; `POST /api/esptool/install` runs `pip3 install esptool`. Both require no body and no auth → trivial cross-site DoS / unexpected package installs.
**Fix:** Gate behind the F01 origin/token check; consider requiring a confirmation token for `restart`.

### F04 — [Medium] Binds all interfaces with no Host/Origin allow-list

**Evidence:** `bridge/config/index.js` `server.host = "0.0.0.0"`. Combined with Codespaces port forwarding, if the port is set to _public_ the bridge is internet-reachable with no auth.
**Fix:** Default `host` to `127.0.0.1` unless forwarding requires otherwise; add Host-header allow-listing to prevent DNS-rebinding; document that the forwarded port must stay **private**.

### F05 — [Medium] No security headers / CSP on served UI

**Evidence:** Static UI is served with only cache headers (`config.staticOptions`). No `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`.
**Fix:** Add Helmet (or hand-rolled headers) with a CSP scoped to self + the Socket.io origin. Verify it doesn't break the existing inline scripts/module imports.

### F06 — [Low] PTY symlink is world read/write

**Evidence:** `bridge/config/index.js` socat args use `mode=666` on both PTYs and the `/tmp/picoUSB` link. On a shared host any local user could read/write the device stream.
**Fix:** Use `mode=600` (owner-only); only relax if a separate UID genuinely needs access.

### F07 — [Low/Info] Flash command reflects untrusted query params into a shell string

**Evidence:** `GET /api/esptool/flash-command/:chip` interpolates `port` and `filename` into returned `esptool.py ...` strings. The server does **not** execute them (good), but the user copy-pastes them into a terminal; metacharacters in `port`/`filename` could inject commands at that point.
**Fix:** Validate `port` against an allow-list pattern (e.g. `/^[\w./-]+$/`) and `filename` to a basename before building the strings.

---

## Stability

### F08 — [High] Alt-port fallback desyncs extension and server

**Evidence:** `bridge/server.js startServer()` may pick `getAvailablePort()` and mutate `config.server.port` when the configured port is blocked. The extension (`src/server/bridgeServer.ts`) only ever uses `this._port` for `waitForServer`, `openInBrowser`, status bar, and port forwarding. If the bridge moves ports, the extension polls/opens the wrong one → "startup timeout" or a dead browser tab.
**Fix:** Have the server report its actual port (stdout token already parsed, or `/api/version`), and have the extension read it back; or make port-fallback opt-in and surface a clear error instead.

### F09 — [Medium] `killProcessesOnPorts` is hardcoded and broad

**Evidence:** `src/server/bridgeServer.ts` always kills PIDs on **3000 and 3001** with `kill -9`, ignoring the configured port, and will kill _any_ process bound there (not just stale bridges).
**Fix:** Derive the port list from config; verify the PID's command line looks like the bridge before killing; prefer `SIGTERM` then `SIGKILL`.

### F15 — [Low] `allowEIO3: true` widens the protocol surface

**Evidence:** `bridge/server.js` Socket.io enables Engine.IO v3 compatibility, unnecessary for a bundled modern client.
**Fix:** Remove unless an old client is actually required.

### F16 — [Info] "Never exit on fatal" can hide real faults

**Evidence:** `errorHandler.initialize({ exitOnFatal: false })` plus broad swallowing keeps the process alive through any error. Good for uptime, but can mask corruption.
**Fix:** Keep, but ensure fatal errors are always logged (bounded) and surfaced via `/api/resilience`; add a heal-loop guard so PTY recovery can't thrash.

---

## MicroPython Connectivity

### F10 — [High] Binary serial data corrupted by `.toString()`

**Evidence:** `bridge/server.js` emits PTY data to the browser as `socket.emit("serial-data", data.toString())` (default UTF-8). Raw REPL transfers, `.mpy`/binary payloads, and any non-UTF-8 bytes will be mangled.
**Fix:** Forward the raw `Buffer` (Socket.io supports binary) or base64-encode both directions consistently; ensure the browser side decodes symmetrically.

### F11 — [Medium] No single-writer guarantee to the PTY

**Evidence:** Every connected socket registers `serial-data → ptyBridge.write` and an `onData` handler. Two open browser tabs both write to the one mpremote PTY and both receive echoes → interleaved/garbled REPL.
**Fix:** Enforce a single active controller (first socket wins, or last-wins with a takeover notice); broadcast read-only output to the rest.

### F12 — [Medium] No backpressure / flow control

**Evidence:** `ptyBridge.write` fires writes with no regard to `serialPort.write` drain; large pastes/uploads can outrun the device.
**Fix:** Respect the `write` callback / `drain` event and pause the socket stream when the buffer is full. On the REPL path this is solved natively by adopting raw-paste mode (F17).

### F17 — [Medium] Raw-REPL hand-rolled with blind timing instead of the documented handshake

**Evidence:** `public/js/serial/rawRepl.js` drives the raw REPL with `sleep()` budgets (`computeWaitMs`, `WAIT_FLOOR_MS`, `DEVICE_BUDGET_PER_BYTE_MS`) and fixed 256-byte chunked writes rather than the protocol's own synchronization. Specifically it:

- sends a single `\x03` (not the canonical `\r\x03\x03`) and does not flush pending input before entering raw mode;
- does **not** wait for the `raw REPL; CTRL-B to exit\r\n>` prompt after `\x01`;
- does **not** read the `OK` acknowledgement after code + `\x04`, nor the two `\x04` markers that delimit stdout/stderr;
- never uses **raw-paste mode** (`\x05A\x01` + device window-size flow control), the modern default in `mpremote`/`pyboard.py`.

The missing protocol feedback is compensated for with marker-based completion (`sendRawCommandUntilMarker`), `uhashlib.sha256` verification, and a retry loop — i.e. the resilience scaffolding exists because the handshake is absent.
**Fix:** Implement the documented raw / raw-paste handshake (ack-driven entry, windowed flow control, framed output). This makes timing deterministic, provides backpressure for free (F12), and removes the need for blind sleeps and most of the verify/retry layer. **Also** switch the upload write path off `ubinascii.a2b_base64(...).decode()` + `open(...,'w')` to bytes + `'wb'` so binary files are not corrupted (shares F10's root cause). Requires device hardware to validate.

---

## Functionality & Completeness

### F13 — [Info] VS Code device commands open the browser UI (by design)

> **Reassessed (after architecture review): this is NOT a defect.** The earlier "High / non-functional stubs" framing was wrong — it conflated a deliberate architectural constraint with missing functionality.

**Why it must work this way:** The microcontroller is plugged into the **user's local machine** over USB. The only API that can reach it is **Web Serial, which is Chromium-only and runs exclusively in a real browser tab** — never in a VS Code webview, and never in the extension host. In a Codespace the extension host runs **remotely in the cloud**, so it has no path to the local USB device _except_ through the browser bridge. Routing `runFile`, `uploadFile`, `softReset`, `hardReset`, `stopCode`, `openREPL`, etc. to `server.openInBrowser()` is therefore the correct behaviour, not a stub.

**The actions are fully implemented — in the browser, where the device lives:**

- Run / Upload / Upload-by-path: `public/js/tools/picoSync.js` (`runFile`, `uploadFile`, `uploadFileByPicoPath`).
- Stop (Ctrl-C `\x03`), Soft reset (`\x04`), Hard reset: `public/js/tools/picoControl.js` (`stopCode`, `softReset`, `hardReset`) wired to the 🛑/🔄/⚡ buttons in `index.html`.
- Wipe device / per-file delete: `deleteAllFiles()` + the Sync panel.

**Only remaining (minor, optional) nicety:** a couple of command _titles_ (e.g. "Run Current File on Pico") could read as "Open in browser to run …" to set expectations. Pure wording; no functional change required. An optional enhancement (not a fix) would be to deep-link intent into the browser (`?action=run&file=…`) so a VS Code click auto-triggers the browser action — but the current hand-off is legitimate.

### F14 — [Low] Most "gaps" already exist in the browser UI; only `mip` + rename/mkdir are genuinely missing

> **Reassessed: largely INVALID.** The original list assumed the VS Code surface should expose device operations directly, but — per F13 — the device-facing surface is the **browser UI by design**. Cross-checking against the actual UI:

| Claimed gap             | Reality                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No download from device | ✅ Exists — Sync panel **Pull** writes device files back to the workspace (`POST /api/workspace/file`).                                                                                             |
| No device file delete   | ✅ Exists — **Wipe** (`deleteAllFiles`) + per-row Delete in the Sync panel.                                                                                                                         |
| No port/baud selection  | ✅ Baud selector (`#baudRate` + `changeBaudRate`) exists; **port** selection is the browser's own Web Serial prompt (by design — the bridge cannot enumerate a device on the user's local machine). |
| No interrupt/stop       | ✅ Exists — 🛑 Stop button (`stopCode`, Ctrl-C). _(The PTY-side baud in `config/index.js` is cosmetic — a PTY has no real baud; the effective baud is set by Web Serial in the browser.)_           |
| No flash progress       | Inherent limitation: esptool flashing requires the device to **disconnect from the bridge** and enter bootloader mode, so the bridge cannot stream progress. Manual by nature.                      |

**Genuinely missing (niche, low value):**

- `mip` / package install flow (could be a browser-side REPL helper).
- Device-side **rename / mkdir** (delete + upload exist; rename/mkdir do not).

**Recommendation:** Treat only `mip` and rename/mkdir as a small optional backlog. Everything else is already shipped or is a hard architectural constraint.

---

## What is already solid (no change needed)

- **Path traversal** is handled well in `syncService.readWorkspaceFile`/`writeWorkspaceFile` (rejects `..`, resolves against root, checks `path.sep` boundary) and in the esptool firmware **delete** route (`path.basename` + prefix check).
- **Disposal hygiene** in the extension host: emitters, status bar, providers, timers, and the child process are all registered to `context.subscriptions` and the process is force-killed in `dispose()`.
- **PTY self-healing**: bounded reconnect attempts, retry with backoff, and graceful degradation to "direct Web Serial" when socat is unavailable.
- **Firmware fetch** has a hard timeout so a stalled `micropython.org` request can't wedge the UI. _(Minor note: it follows redirects to `headers.location` unconditionally — keep an eye on this if the base URL ever becomes user-controlled.)_

---

## Recommended remediation order

Security and stability fixes (F01–F09, F11, F15) are **done**. The remaining work is the [Outstanding tasks](#outstanding-tasks) list, in priority order:

1. **F17** — adopt the raw-paste/ack handshake (deterministic timing + native backpressure; subsumes F12 and retires the verify/retry scaffolding).
2. **F10 + F17a** — binary-safe forwarding and upload (`Buffer`/`'wb'` instead of `.toString()`/`.decode()`).
3. **F12** — any residual socket↔PTY drain handling not covered by F17.
4. **F14 backlog** — `mip` install, device rename/mkdir (optional).
5. **F13** — optional command-title wording.

> **F13 / most of F14 / F16 require no work** — they are correct browser-by-design behaviour (see those findings), not defects.

> Each fix should follow the repo's "minimal, reversible change" rule and be validated with: `.extension` build + lint + test, `bridge/test/*.mjs`, and `python3 .extension/emulator/mock/runner.py py_scripts/mock_validation_test.py`.
