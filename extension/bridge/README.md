# Pico Codespaces Bridge

A **HIGH-AVAILABILITY** browser-based Serial Terminal for Raspberry Pi Pico, built with **Web Serial API** and **xterm.js**.

## 🛡️ High Availability Features

This bridge is designed to **NEVER CRASH** and be **ALWAYS AVAILABLE** for low-skilled users:

- ✅ **Never Crashes**: Catches ALL uncaught exceptions and unhandled rejections
- ✅ **Self-Healing**: Automatic recovery from PTY, serial, and file watcher failures
- ✅ **Auto-Restart**: PM2 process manager with infinite restarts
- ✅ **Port Protection**: Automatically kills stale processes blocking port 3000
- ✅ **Health Monitoring**: Continuous health checks with automatic recovery
- ✅ **Memory Management**: Automatic garbage collection on memory pressure
- ✅ **Graceful Degradation**: Works even if PTY or file watcher fails
- ✅ **Circuit Breakers**: Protects against cascading failures

## Features

- **Web Serial**: Connect directly to Pico boards from Chrome/Edge without backend drivers.
- **Professional Terminal**: Full terminal emulation using xterm.js.
- **Baud Rate Selection**: Choose from 300 to 1,000,000 baud.
- **DTR/RTS Control**: Toggle serial control signals.
- **Timestamps**: Optional timestamp prefix on each line.
- **Log Download**: Save the entire session to a text file.
- **Line Endings**: Choose between no ending, NL, CR, or NL+CR.
- **Bridge to Codespaces**: Creates `/tmp/picoUSB` virtual port for mpremote.

## How it Works

1. **Web Serial (Browser):** Your browser connects to the physical Pico.
2. **Socket.IO (Network):** Data is sent from the browser to the Codespace.
3. **PTY (Codespace):** A virtual serial port (`/tmp/picoUSB`) is created in the Codespace.
4. **Tools (mpremote):** Python tools connect to `/tmp/picoUSB` as if it were a real device.

## Setup & Usage

### 1. Start the Bridge (Recommended: High-Availability Mode)

**Option A: Use the resilient startup script (RECOMMENDED)**

```bash
cd bridge
./start-resilient.sh
```

**Option B: Use PM2 directly**

```bash
cd bridge
npm install
npm run start:pm2
```

**Option C: Simple start (development only)**

```bash
cd bridge
npm start
```

### Managing the Bridge

| Command               | Description                    |
| --------------------- | ------------------------------ |
| `npm run start:pm2`   | Start with PM2 (recommended)   |
| `npm run stop:pm2`    | Stop the bridge                |
| `npm run restart:pm2` | Restart the bridge             |
| `npm run logs`        | View live logs                 |
| `npm run monitor`     | Real-time monitoring dashboard |
| `npm run status`      | Check process status           |
| `npm run health`      | Check server health            |
| `npm run resilience`  | View resilience diagnostics    |

### 2. Connect the Hardware

- VS Code will notify you that a service is running on Port 3000. Click **"Open in Browser"**.
- In the web page, click **"Connect Pico"**.
- Select your Pico from the browser's device list.
- _Note: You must use a browser that supports Web Serial (Chrome, Edge, Opera)._

### 3. Serial Monitor

The web interface provides a full serial monitor:

- **Send Commands**: Type in the input bar and press Enter or click Send.
- **Direct Typing**: Type directly in the terminal (characters sent immediately).
- **Clear Output**: Click "Clear Output" to reset the terminal.
- **Download Log**: Save the entire session as a text file.
- **Timestamps**: Toggle "Show Timestamp" to prefix each line with time.

### 4. Run Code

- Open a Python file (e.g., `project/main.py`).
- Press `Ctrl+Shift+B` (or run the task **"Pico: Run Current File"**).
- The code will execute on your connected Pico!

### 5. Open REPL

- Run the task **"Pico: Open REPL"**.
- You can now type Python commands directly to the Pico.

## UI Controls

| Control        | Description                                  |
| -------------- | -------------------------------------------- |
| Connect Pico   | Open Web Serial port picker                  |
| Disconnect     | Close the serial connection                  |
| Baud Rate      | Select communication speed (default: 115200) |
| DTR / RTS      | Toggle serial control signals                |
| Show Timestamp | Add timestamps to each line of output        |
| Clear Output   | Clear the terminal display                   |
| Download Log   | Save session to a .txt file                  |
| Line Ending    | Select what to append when pressing Send     |
| Input Bar      | Type commands to send to the Pico            |

## Troubleshooting

- **"No Pico connected"**: Ensure the web page is open and status shows "Connected".
- **Web Serial not supported**: Use Chrome, Edge, or Opera browser.
- **Latency**: There may be a slight delay due to the network round-trip.
- **Extension Issues**: The official Pico extension may not auto-detect the device. Use the provided Tasks instead.
- **Port already in use**: The bridge will automatically kill stale processes. If issues persist, run `npm run stop:pm2`.

## Resilience API Endpoints

The bridge exposes diagnostic endpoints for monitoring:

| Endpoint                            | Description                  |
| ----------------------------------- | ---------------------------- |
| `GET /api/health`                   | Server health and PTY status |
| `GET /api/resilience`               | Full resilience diagnostics  |
| `GET /api/resilience/errors`        | Recent error log             |
| `POST /api/resilience/errors/clear` | Clear error log              |
| `GET /api/resilience/health`        | Health check history         |

## Architecture

```
bridge/
├── server.js              # Main server with resilience integration
├── ecosystem.config.js    # PM2 configuration for high availability
├── start-resilient.sh     # Startup script with auto-recovery
├── config/
│   └── index.js           # Centralized configuration
├── src/
│   ├── api/               # REST API routes
│   ├── pty/               # PTY bridge (with self-healing)
│   ├── services/          # File watcher (with auto-restart)
│   ├── resilience/        # High availability modules
│   │   ├── errorHandler.js    # Global error catching
│   │   ├── healthMonitor.js   # Health monitoring & self-healing
│   │   ├── processGuard.js    # Process management
│   │   └── portManager.js     # Port conflict resolution
│   └── utils/             # Logging utilities
└── public/                # Web interface
```

- **`server.js`**: Express + Socket.IO server with full resilience integration
- **`ecosystem.config.js`**: PM2 configuration for unlimited restarts
- **`src/resilience/`**: High availability modules for crash prevention
- **`public/index.html`**: UI layout with toolbars and terminal container
- **`public/js/`**: Modular client-side JavaScript
