# Start the Bridge Server

The Pico Bridge server creates a connection between your GitHub Codespace and your local browser.

## How it Works

1. The server runs in your Codespace
2. A browser window opens on your local machine
3. The browser uses Web Serial API to connect to your Pico
4. Commands and data flow through the bridge

## Starting the Server

Click the **Start Server** button in the Pico Bridge panel, or use:

- Command Palette: `Ctrl+Shift+P` → "Pico Bridge: Start Server"
- Status bar: Click the Pico Bridge indicator

The server will start on port 3000 (configurable in settings).
