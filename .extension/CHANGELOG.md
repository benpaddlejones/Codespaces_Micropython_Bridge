# Changelog

All notable changes to the Pico Bridge extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-12-10

### Changed

- Renamed the extension to "Pi Pico to Codespaces Bridge" to align with VS Code Marketplace branding
- Updated web client favicon and header branding to match the extension icon

## [1.0.2] - 2025-12-10

### Changed

- Allow workspace file listing when project markers are absent while keeping upload actions gated
- Added browser UI refresh control for manual workspace re-scan
- Improved filesystem scanning performance by ignoring `node_modules`
- Standardised project detection on `.micropico` marker for compatibility with the official Pico VS Code extension

### Fixed

- File picker now surfaces loose `.py` files (for example `test/test.py`) instead of returning an empty list

## [1.0.1] - 2025-12-09

### Changed

- Rebuilt VSIX package with updated assets
- Documentation and packaging touch-ups

## [0.1.0] - 2024-01-XX

### Added

- Initial release
- Bridge server management (start/stop)
- External browser integration for Web Serial API
- Status bar indicator
- Activity bar panel with server status
- Workspace files tree view
- Commands for device interaction:
  - Run file
  - Upload file
  - Upload project
  - List files
  - Open REPL
  - Soft/Hard reset
  - Stop code
- Configuration options:
  - Server port
  - Auto-start
  - Open browser on start
  - Project path
- Keyboard shortcuts
- Getting started walkthrough
- Full documentation

### Technical Notes

- Uses `vscode.env.openExternal()` for browser opening (required for Web Serial API)
- Uses `vscode.env.asExternalUri()` for proper port forwarding in Codespaces
- Server runs as child process spawning existing bridge/server.js
