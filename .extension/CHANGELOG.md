# Changelog

All notable changes to the Pi Pico to Codespaces Bridge extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
