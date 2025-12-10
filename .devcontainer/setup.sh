#!/bin/bash
# =============================================================================
# Pico Bridge Extension DevContainer Setup Script
# Runs once when the container is first created (postCreateCommand)
# =============================================================================

set -euo pipefail

echo "=================================================="
echo "Setting up Pico Bridge Extension development environment..."
echo "=================================================="

echo "Updating package lists..."
sudo apt-get update -qq

echo "Installing system tooling (librsvg2-bin for icon workflows)..."
sudo apt-get install -y --no-install-recommends \
    librsvg2-bin

echo "Installing VS Code tooling (vsce)..."
npm install -g @vscode/vsce >/tmp/vsce-install.log 2>&1 || cat /tmp/vsce-install.log

if [ -d "extension" ]; then
    echo "Installing VS Code extension dependencies..."
    pushd extension >/dev/null
    npm install --silent || npm install
    popd >/dev/null
fi

echo "=================================================="
echo "Pico Bridge Extension environment setup complete!"
echo "=================================================="
