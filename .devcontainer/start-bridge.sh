#!/bin/bash
# =============================================================================
# Pico Bridge Extension Startup Script
# Runs every time the container starts (postStartCommand)
# Keeps the environment lightweight for VS Code extension development.
# =============================================================================

set -euo pipefail

exec >>/tmp/pico-bridge-start.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BRIDGE_DIR="${ROOT_DIR}/bridge"

if [[ ! -d "${BRIDGE_DIR}" ]]; then
    BRIDGE_DIR="${ROOT_DIR}/extension/bridge"
fi

echo "[$(date)] Pico Bridge extension startup script running..."

if [[ "${AUTO_START_PICO_BRIDGE:-false}" == "true" && -d "${BRIDGE_DIR}" ]]; then
    echo "AUTO_START_PICO_BRIDGE=true detected. Launching bridge server once..."
    pushd "${BRIDGE_DIR}" >/dev/null
    npm start >/tmp/pico-bridge.log 2>&1 &
    echo "Bridge server starting in background (npm start)."
    popd >/dev/null
else
    echo "Automatic Pico Bridge startup disabled. Use the VS Code command \"Pico Bridge: Start Server\" when needed."
fi

echo "[$(date)] Startup script complete."
