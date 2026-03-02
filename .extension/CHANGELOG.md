# Changelog

All notable changes to the Pi Pico to Codespaces Bridge extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
