# Changelog

All notable changes to the Pico Bridge extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
