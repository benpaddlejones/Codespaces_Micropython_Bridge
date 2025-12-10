#!/bin/bash
#
# Pi Pico Bridge - High Availability Startup Script
# 
# This script ensures the bridge server is ALWAYS running and self-heals.
# It should be used as the primary way to start the bridge.
#
# Features:
# - Kills any existing bridge processes
# - Ensures port 3000 is available
# - Starts with PM2 for process management
# - Infinite restarts on failure
# - Memory monitoring
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  Pi Pico Bridge - High Availability Mode"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check for Node.js
if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi
print_status "Node.js found: $(node --version)"

# Check for npm
if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi
print_status "npm found: $(npm --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_warning "Installing dependencies..."
    npm install
fi
print_status "Dependencies installed"

# Create logs directory
mkdir -p logs
print_status "Logs directory ready"

# Kill any existing processes on port 3000
print_warning "Checking port 3000..."
PIDS=$(lsof -i :3000 -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    print_warning "Killing existing processes on port 3000: $PIDS"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
fi
print_status "Port 3000 is clear"

# Check if PM2 is available
if command_exists pm2 || [ -f "node_modules/.bin/pm2" ]; then
    print_status "PM2 found - using process manager"
    
    # Use local PM2 if global not available
    PM2_CMD="pm2"
    if ! command_exists pm2; then
        PM2_CMD="./node_modules/.bin/pm2"
    fi
    
    # Stop any existing PM2 process
    $PM2_CMD delete pico-bridge 2>/dev/null || true
    
    # Start with PM2
    $PM2_CMD start ecosystem.config.js
    
    echo ""
    print_status "Bridge started with PM2"
    echo ""
    echo "Useful commands:"
    echo "  npm run logs     - View logs"
    echo "  npm run monitor  - Real-time monitoring"
    echo "  npm run status   - Check status"
    echo "  npm run stop:pm2 - Stop the bridge"
    echo ""
    
    # Show status
    $PM2_CMD status
else
    print_warning "PM2 not found - running directly with auto-restart loop"
    echo ""
    
    # Run with a basic restart loop
    while true; do
        echo ""
        print_status "Starting bridge server..."
        node --expose-gc server.js || true
        
        print_warning "Server exited - restarting in 3 seconds..."
        sleep 3
    done
fi
