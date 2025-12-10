# Pico Bridge - MicroPython Development for Codespaces

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=pico-bridge.pico-bridge)

Develop MicroPython applications for **Raspberry Pi Pico** and **ESP32** devices directly from **GitHub Codespaces** or any VS Code environment with Web Serial API support.

## 🚀 Features

- **Cloud-to-Device Bridge**: Connect your local microcontroller to cloud-based development environments
- **Web Serial Integration**: Uses the browser's Web Serial API for device communication
- **REPL Terminal**: Interactive Python shell for real-time debugging
- **File Management**: Upload, download, and manage files on your device
- **Code Execution**: Run Python scripts directly on your microcontroller
- **Project Sync**: Synchronize entire project folders to the device
- **Data Plotter**: Visualize sensor data in real-time

## 📋 Requirements

### Browser Support
This extension requires a browser with **Web Serial API** support:
- ✅ Google Chrome (recommended)
- ✅ Microsoft Edge
- ✅ Opera
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

### Device Support
- Raspberry Pi Pico / Pico W (with MicroPython firmware)
- ESP32 boards (with MicroPython firmware)
- Any MicroPython-compatible device with USB serial

## 🔧 Installation

1. Install this extension from the VS Code Marketplace
2. Open a workspace with MicroPython project files
3. Click the Pico Bridge icon in the Activity Bar
4. Start the bridge server

## 🎯 Quick Start

### 1. Start the Server
```
Ctrl+Shift+P → "Pico Bridge: Start Server"
```
Or click the "Start Server" button in the Pico Bridge panel.

### 2. Open in Browser
The bridge interface will open in your default browser. This is required because Web Serial API only works in a browser context, not in VS Code webviews.

### 3. Connect Your Device
1. Click "Connect" in the browser interface
2. Select your Pico/ESP32 from the serial port list
3. You're now connected!

### 4. Run Code
- Use the terminal for REPL interaction
- Click "Run" to execute the current file
- Use "Sync" to upload your entire project

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `picoBridge.server.port` | Server port number | `3000` |
| `picoBridge.autoStart` | Auto-start server on activation | `false` |
| `picoBridge.openBrowserOnStart` | Open browser when server starts | `true` |
| `picoBridge.projectPath` | Path to MicroPython project folder | `project` |

## ⌨️ Keyboard Shortcuts

| Command | Shortcut |
|---------|----------|
| Start Server | `Ctrl+Shift+P` |
| Run Current File | `Ctrl+Shift+R` |
| Open REPL | `Ctrl+Shift+T` |

## 📁 Commands

| Command | Description |
|---------|-------------|
| `Pico Bridge: Start Server` | Start the bridge server |
| `Pico Bridge: Stop Server` | Stop the bridge server |
| `Pico Bridge: Open in Browser` | Open the bridge interface |
| `Pico Bridge: Run File` | Run the current Python file |
| `Pico Bridge: Upload File` | Upload the current file to device |
| `Pico Bridge: Upload Project` | Sync entire project folder |
| `Pico Bridge: List Files` | List files on the device |
| `Pico Bridge: Open REPL` | Open the Python REPL |
| `Pico Bridge: Soft Reset` | Soft reset the device |
| `Pico Bridge: Hard Reset` | Hard reset the device |
| `Pico Bridge: Stop Code` | Stop running code |
| `Pico Bridge: Show Logs` | Show extension logs |

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  GitHub Codespaces  │     │  Local Browser   │     │  Pico/ESP32 │
│  (VS Code)          │◄───►│  (Web Serial)    │◄───►│  (USB)      │
│                     │ WS  │                  │ USB │             │
└─────────────────────┘     └──────────────────┘     └─────────────┘
         │                          │
         │ Extension                │ Bridge UI
         │ - Server mgmt           │ - Serial connection
         │ - Commands              │ - REPL terminal
         │ - Status bar            │ - File manager
         └──────────────────────────┘
```

**Why External Browser?**
The Web Serial API is not available in VS Code webviews. The bridge interface must run in an external browser (Chrome/Edge) to access serial ports.

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Try a different port in settings
- Check the output panel for errors

### Browser won't connect to device
- Make sure you're using Chrome or Edge
- Check that no other application is using the serial port
- Try unplugging and reconnecting the device

### Files not syncing
- Ensure the device is connected in the browser
- Check that the project folder exists
- Verify file permissions

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

## 📚 Resources

- [MicroPython Documentation](https://docs.micropython.org/)
- [Raspberry Pi Pico Documentation](https://www.raspberrypi.com/documentation/microcontrollers/raspberry-pi-pico.html)
- [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
