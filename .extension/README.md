# Pi Pico to Codespaces Bridge

[![Version](https://img.shields.io/badge/Version-2.0.0-green)](CHANGELOG.md)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=pico-bridge.pico-bridge)
[![MicroPython](https://img.shields.io/badge/MicroPython-1.20%2B-00b2a9?logo=python&logoColor=white)](https://micropython.org/)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-Pico%20Ready-c51a4a?logo=raspberrypi&logoColor=white)](https://www.raspberrypi.com/documentation/microcontrollers/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?logo=github)](https://github.com/benpaddlejones/Codespaces_Micropython_Bridge)
[![GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Cloud%20IDE-24292e?logo=github)](https://github.com/features/codespaces)

Code entirely in the cloud and push updates to your Pi Pico in real time. This bridge lets you build MicroPython projects for **RP2040**, **RP2035**, **Teensy**, **ESP32** and **BBC:MicroBit** boards (including Raspberry Pi Pico, Pi Pico 2 and Pico W) from **GitHub Codespaces** or any VS Code environment with Web Serial API support, then upload instantly to your hardware. Features a **built-in MicroPython emulator** for testing without hardware and full **debugpy integration** for breakpoints, stepping, and variable inspection.

## 🚀 Features

### Core Features

- **Cloud-to-Device Bridge**: Connect your local microcontroller to cloud-based development environments
- **Web Serial Integration**: Uses the browser's Web Serial API for device communication
- **REPL Terminal**: Interactive Python shell for real-time debugging
- **File Management**: Upload, download, and manage files on your device
- **Code Execution**: Run Python scripts directly on your microcontroller
- **Project Sync**: Synchronize entire project folders to the device
- **Data Plotter**: Visualize sensor data in real-time

### v2.0.0 New Features

- **🎮 MicroPython Emulator**: Test code without hardware using simulated hardware APIs
- **🐛 Debugpy Integration**: Full VS Code debugging with breakpoints and variable inspection
- **📝 Pylance IntelliSense**: Auto-configured type stubs for MicroPython modules
- **📦 Sample Scripts**: Board-specific demo scripts for Pico, Pico W, and ESP32
- **🔧 API Commands**: External tool integration for custom workflows

## 📋 Requirements

### Browser Support

This extension requires a browser with **Web Serial API** support:

- ✅ Google Chrome (recommended)
- ✅ Microsoft Edge
- ✅ Opera
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

### Emulator Requirements (v2.0.0+)

To use the MicroPython emulator and debugger:

- **Python 3.8+** installed and available in PATH
- **debugpy** package for debugging (`pip install debugpy`)
- The extension will prompt to configure Python if needed

### Device Support

- Raspberry Pi Pico / Pi Pico 2 / Pico W (with MicroPython firmware)
- ESP32 boards (with MicroPython firmware)
- Teensy (with MicroPython firmware)
- BBC:Micro (download \*.bin)
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

| Setting                                | Description                     | Default   |
| -------------------------------------- | ------------------------------- | --------- |
| `picoBridge.server.port`               | Server port number              | `3000`    |
| `picoBridge.server.autoStart`          | Auto-start server on activation | `false`   |
| `picoBridge.server.openBrowserOnStart` | Open browser when server starts | `true`    |
| `picoBridge.emulator.pythonExecutable` | Python executable for emulator  | `python3` |
| `picoBridge.project.excludeFolders`    | Folders to exclude from upload  | See below |
| `picoBridge.serial.baudRate`           | Serial communication baud rate  | `115200`  |

**Default exclude folders**: `examples`, `.git`, `__pycache__`, `node_modules`

## ⌨️ Keyboard Shortcuts

| Command          | Shortcut       |
| ---------------- | -------------- |
| Start Server     | `Ctrl+Shift+P` |
| Run Current File | `Ctrl+Shift+R` |
| Open REPL        | `Ctrl+Shift+T` |

## 📁 Commands

| Command                        | Description                       |
| ------------------------------ | --------------------------------- |
| `Pico Bridge: Start Server`    | Start the bridge server           |
| `Pico Bridge: Stop Server`     | Stop the bridge server            |
| `Pico Bridge: Open in Browser` | Open the bridge interface         |
| `Pico Bridge: Run File`        | Run the current Python file       |
| `Pico Bridge: Upload File`     | Upload the current file to device |
| `Pico Bridge: Upload Project`  | Sync entire project folder        |
| `Pico Bridge: List Files`      | List files on the device          |
| `Pico Bridge: Open REPL`       | Open the Python REPL              |
| `Pico Bridge: Soft Reset`      | Soft reset the device             |
| `Pico Bridge: Hard Reset`      | Hard reset the device             |
| `Pico Bridge: Stop Code`       | Stop running code                 |
| `Pico Bridge: Show Logs`       | Show extension logs               |

## 🏗️ Architecture

### VS Code Extension Components

- **Commands & Views** - UI panels, menus, and command palette integration
- **Project Manager** - Tracks active project via `.micropico` marker files
- **Emulator Manager** - Spawns Python process with mock MicroPython modules
- **Bridge Server** - Express.js server for browser communication

### Two Development Paths

**EMULATOR PATH** (No hardware needed)

1. Extension runs `runner.py` with your script
2. Mock modules simulate `machine`, `utime`, `network`, `neopixel`, `rp2`, `gc`
3. Emulator webview shows pin states, PWM, ADC values
4. debugpy enables VS Code debugging (breakpoints, stepping, variables)

**HARDWARE PATH** (Real device)

1. Bridge server starts on port 3000
2. Browser UI opens (Chrome/Edge required for Web Serial API)
3. Connect to Pico/ESP32 via USB
4. REPL terminal, file sync, and data plotter available

### Why External Browser?

The Web Serial API is not available in VS Code webviews. The bridge interface must run in Chrome or Edge to access serial ports.

### Path Comparison

| Path         | Use Case                    | Requirements                        |
| ------------ | --------------------------- | ----------------------------------- |
| **Emulator** | Test logic without hardware | Python 3.8+, debugpy                |
| **Hardware** | Deploy to real device       | Chrome/Edge browser, USB connection |

## 🎮 MicroPython Emulator (No Hardware Required!)

Test and debug your MicroPython code **without physical hardware**! The built-in emulator simulates MicroPython's hardware APIs, allowing you to develop and test your code entirely in VS Code.

### Why Use the Emulator?

- **No Hardware Needed**: Test code without a Pico or ESP32
- **Instant Feedback**: Run scripts immediately, no upload time
- **Debugging Support**: Use VS Code's debugger with breakpoints
- **Visual State**: See pin states, PWM values, and sensor readings
- **Safe Experimentation**: Test code without risking your hardware

### Running Scripts in the Emulator

There are three ways to run MicroPython scripts:

#### 1. Inline Buttons (Recommended)

In the **Project Files** tree view (Pico Bridge sidebar):

- **▷ Play Button**: Run script in emulator
- **🐛 Debug Button**: Run with VS Code debugger attached

Simply click the button next to any `.py` file!

#### 2. Command Palette

```
Ctrl+Shift+P → "Run in MicroPython Emulator"
```

#### 3. Launch Configuration

Use the **"MicroPython (Emulator)"** launch configuration from the Run and Debug panel.

### Emulated Hardware Modules

The emulator supports these MicroPython modules:

| Module           | Classes/Functions                                                     |
| ---------------- | --------------------------------------------------------------------- |
| `machine`        | `Pin`, `PWM`, `ADC`, `I2C`, `SPI`, `Timer`, `UART`, `WDT`, `RTC`      |
| `utime` / `time` | `sleep`, `sleep_ms`, `sleep_us`, `ticks_ms`, `ticks_us`, `ticks_diff` |
| `neopixel`       | `NeoPixel` (with full color support)                                  |
| `network`        | `WLAN` (station/AP mode simulation)                                   |
| `rp2`            | `PIO`, `StateMachine`, `asm_pio` decorator                            |
| `gc`             | `collect`, `mem_free`, `mem_alloc`                                    |
| `uos` / `os`     | File system operations                                                |
| `uio` / `io`     | I/O stream operations                                                 |
| `sys`            | `print_exception`, system info                                        |

### Hardware Visualization

Click **"Show Board"** in the Pico Bridge panel to open the hardware visualizer:

- See **pin states** in real-time (HIGH/LOW)
- Monitor **PWM duty cycles**
- View **ADC readings**
- Track **I2C/SPI** transactions

### Example: Blink Test

```python
from machine import Pin
import utime

led = Pin(25, Pin.OUT)  # Built-in LED on Pico

while True:
    led.value(1)
    print("LED ON")
    utime.sleep(1)

    led.value(0)
    print("LED OFF")
    utime.sleep(1)
```

Run this in the emulator - you'll see:

- Console output showing LED state
- Pin 25 state changes in the visualizer
- No hardware required!

### Advanced Features

#### UART Loopback Testing

Test UART code without external hardware:

```python
from machine import UART

# Enable loopback mode (TX connects to RX)
UART.enable_loopback(True)

uart = UART(0, baudrate=115200)
uart.write(b"Hello")
print(uart.read())  # Returns b"Hello"
```

#### Timer Callbacks

```python
from machine import Timer

def tick(t):
    print("Timer tick!")

timer = Timer(-1)
timer.init(period=1000, callback=tick)
```

#### PWM Control

```python
from machine import Pin, PWM

pwm = PWM(Pin(25))
pwm.freq(1000)
pwm.duty_u16(32768)  # 50% duty cycle
```

### Debugging MicroPython Code

1. Set breakpoints in your Python file
2. Click the **🐛 Debug** button (or use launch config)
3. VS Code debugger attaches automatically
4. Step through code, inspect variables, watch expressions

### Type Checking and IntelliSense

The extension includes type stubs for all MicroPython modules. You'll get:

- **Autocomplete** for `machine.Pin`, `UART`, etc.
- **Type checking** via Pylance
- **Documentation** on hover

### Emulator Limitations

The emulator is great for logic testing, but has some limitations:

- **Timing**: Not cycle-accurate (uses Python's `time.sleep`)
- **PIO**: Basic simulation only, not bit-accurate
- **Network**: Simulated responses, no real connections
- **Interrupts**: Simulated, may not match exact hardware timing

For production code, always test on real hardware!

---

## 🐛 Debugpy Integration

The extension provides full VS Code debugging support for MicroPython code running in the emulator. This allows you to set breakpoints, step through code, inspect variables, and use all standard debugging features.

### Quick Start: Debug a Script

1. **Open a Python file** in your workspace
2. **Set breakpoints** by clicking in the gutter (left of line numbers)
3. **Start debugging** using one of these methods:
   - Click the **🐛 Debug** button next to the file in Project Files view
   - Right-click the file → "Debug Python File"
   - Press `F5` with the MicroPython launch config selected

### Launch Configuration

The extension automatically provides a debug configuration. You can also add it manually to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "MicroPython (Emulator)",
      "type": "python",
      "request": "launch",
      "program": "${command:picoBridge.getMockRunnerPath}",
      "args": ["${file}"],
      "console": "integratedTerminal",
      "justMyCode": false,
      "cwd": "${fileDirname}",
      "env": {
        "MICROPYTHON_MOCK": "1"
      }
    }
  ]
}
```

### Debugging Features

| Feature               | Support | Notes                                  |
| --------------------- | ------- | -------------------------------------- |
| Breakpoints           | ✅ Full | Line, conditional, and logpoints       |
| Step Over/Into/Out    | ✅ Full | Standard F10/F11/Shift+F11             |
| Variable Inspection   | ✅ Full | Locals, globals, and watch expressions |
| Call Stack            | ✅ Full | Navigate through function calls        |
| Debug Console         | ✅ Full | Evaluate expressions at breakpoint     |
| Exception Breakpoints | ✅ Full | Break on raised/uncaught exceptions    |

### Debugging Example

```python
from machine import Pin, PWM
import utime

def setup_led(pin_num):
    """Set up an LED with PWM control."""
    pin = Pin(pin_num, Pin.OUT)  # Set breakpoint here
    pwm = PWM(pin)
    pwm.freq(1000)
    return pwm

def fade_led(pwm, steps=100):
    """Fade LED in and out."""
    for duty in range(0, 65535, 65535 // steps):
        pwm.duty_u16(duty)  # Inspect 'duty' value here
        utime.sleep_ms(10)

    for duty in range(65535, 0, -65535 // steps):
        pwm.duty_u16(duty)
        utime.sleep_ms(10)

# Main program
led_pwm = setup_led(25)
while True:
    fade_led(led_pwm)
```

### Debugging Tips

1. **Use `justMyCode: false`** to step into MicroPython mock modules
2. **Set `MICROPYTHON_MOCK=1`** environment variable for proper module loading
3. **Check the Debug Console** to evaluate MicroPython expressions
4. **Use conditional breakpoints** for loop debugging (right-click breakpoint → Edit)

### Troubleshooting Debugpy

#### Debugger doesn't start

- Ensure the Python extension is installed and activated
- Check that `python3` is available in your PATH
- Try setting `picoBridge.emulator.pythonExecutable` to full Python path

#### Breakpoints not hit

- Verify the file is saved before starting debug
- Check you're using the emulator launch config, not regular Python
- Ensure `justMyCode` is set to `false` in launch config

#### Import errors during debug

- The emulator sets up paths automatically; don't modify `PYTHONPATH` manually
- If issues persist, check the Debug Console for specific error messages

---

## 🖥️ Emulator Architecture

The MicroPython emulator is a Python-based simulation layer that mimics MicroPython's hardware APIs, allowing you to test code without physical hardware.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
├─────────────────────────────────────────────────────────────┤
│  EmulatorManager                                             │
│  ├── Spawns Python process with runner.py                   │
│  ├── Captures stdout for events (__EMU__ prefix)            │
│  └── Sends state updates to EmulatorWebview                 │
├─────────────────────────────────────────────────────────────┤
│  runner.py (Mock Runner)                                     │
│  ├── Injects mock modules into sys.modules                  │
│  ├── Executes user script with mocked imports               │
│  └── Emits hardware state as JSON events                    │
├─────────────────────────────────────────────────────────────┤
│  Mock Modules (micropython/)                                 │
│  ├── machine.py  → Pin, PWM, ADC, I2C, SPI, Timer, etc.    │
│  ├── utime.py    → sleep, ticks_ms, ticks_diff             │
│  ├── network.py  → WLAN simulation                          │
│  ├── neopixel.py → NeoPixel LED strip simulation           │
│  └── ...         → gc, uos, uio, rp2, etc.                  │
├─────────────────────────────────────────────────────────────┤
│  EmulatorWebview (Visual Display)                            │
│  ├── Board SVG with pin visualization                       │
│  ├── Real-time state updates                                 │
│  └── Interactive controls (play/pause/stop)                  │
└─────────────────────────────────────────────────────────────┘
```

### Supported Modules Reference

#### `machine` Module

| Class   | Methods                                               | Notes                |
| ------- | ----------------------------------------------------- | -------------------- |
| `Pin`   | `value()`, `on()`, `off()`, `toggle()`, `irq()`       | Full GPIO simulation |
| `PWM`   | `freq()`, `duty_u16()`, `duty_ns()`, `deinit()`       | Duty cycle tracking  |
| `ADC`   | `read_u16()`, `read_uv()`                             | Configurable values  |
| `I2C`   | `scan()`, `readfrom()`, `writeto()`, `readfrom_mem()` | Device simulation    |
| `SPI`   | `read()`, `write()`, `readinto()`                     | Loopback support     |
| `UART`  | `read()`, `write()`, `any()`, `readline()`            | Loopback mode        |
| `Timer` | `init()`, `deinit()`                                  | Callback execution   |
| `WDT`   | `feed()`                                              | Watchdog simulation  |
| `RTC`   | `datetime()`                                          | Real-time clock      |

#### `utime` / `time` Module

| Function             | Description            |
| -------------------- | ---------------------- |
| `sleep(s)`           | Sleep for seconds      |
| `sleep_ms(ms)`       | Sleep for milliseconds |
| `sleep_us(us)`       | Sleep for microseconds |
| `ticks_ms()`         | Millisecond counter    |
| `ticks_us()`         | Microsecond counter    |
| `ticks_diff(t1, t2)` | Time difference        |
| `time()`             | Unix timestamp         |
| `localtime()`        | Local time tuple       |

#### `network` Module

| Class  | Methods                                                          | Notes          |
| ------ | ---------------------------------------------------------------- | -------------- |
| `WLAN` | `active()`, `connect()`, `isconnected()`, `ifconfig()`, `scan()` | Simulated WiFi |

#### `neopixel` Module

| Class      | Methods                                               | Notes            |
| ---------- | ----------------------------------------------------- | ---------------- |
| `NeoPixel` | `__setitem__()`, `__getitem__()`, `write()`, `fill()` | RGB/RGBW support |

#### `rp2` Module (RP2040-specific)

| Class          | Methods                                | Notes                |
| -------------- | -------------------------------------- | -------------------- |
| `PIO`          | `state_machine()`, `remove_program()`  | Basic PIO simulation |
| `StateMachine` | `init()`, `active()`, `put()`, `get()` | Limited simulation   |
| `asm_pio`      | Decorator for PIO assembly             | Parsing only         |

#### Other Modules

| Module        | Purpose                                                       |
| ------------- | ------------------------------------------------------------- |
| `gc`          | Garbage collection (`collect()`, `mem_free()`, `mem_alloc()`) |
| `uos` / `os`  | File system operations                                        |
| `uio` / `io`  | I/O streams                                                   |
| `sys`         | System info, `print_exception()`                              |
| `ubinascii`   | Binary/ASCII conversions                                      |
| `ujson`       | JSON encoding/decoding                                        |
| `ure`         | Regular expressions                                           |
| `ustruct`     | Struct packing/unpacking                                      |
| `uhashlib`    | Hashing (SHA256, etc.)                                        |
| `micropython` | `mem_info()`, `stack_use()`                                   |

### Board Support

The emulator supports multiple board types with appropriate pinouts:

| Board             | Pins         | Special Features      |
| ----------------- | ------------ | --------------------- |
| Raspberry Pi Pico | GP0-GP28     | Built-in LED on GP25  |
| Pico W            | GP0-GP28     | CYW43 WiFi simulation |
| Pico 2 / 2W       | GP0-GP28     | RP2350 features       |
| ESP32             | GPIO0-GPIO39 | ADC1, ADC2, Touch     |

### Event Protocol

The emulator communicates hardware state changes via stdout using a JSON protocol:

```
__EMU__{"type": "pin_change", "pin": 25, "value": 1}
__EMU__{"type": "pwm_change", "pin": 25, "freq": 1000, "duty": 32768}
__EMU__{"type": "i2c_write", "addr": 60, "data": [0, 1, 2]}
__EMU__{"type": "neopixel", "pin": 0, "pixels": [[255, 0, 0], [0, 255, 0]]}
```

### Writing Emulator-Compatible Code

For best compatibility between emulator and real hardware:

```python
# ✅ Good: Use standard MicroPython patterns
from machine import Pin
import utime

led = Pin(25, Pin.OUT)
led.toggle()
utime.sleep_ms(100)

# ✅ Good: Check for emulator if needed
import os
if os.getenv('MICROPYTHON_MOCK'):
    print("Running in emulator")

# ❌ Avoid: Hardware-specific timing loops
while True:  # This will consume 100% CPU in emulator
    pass

# ✅ Better: Use sleep for timing
while True:
    do_something()
    utime.sleep_ms(10)  # Allows emulator to process events
```

### API Commands for External Tools

The extension provides commands for external tool integration:

| Command                        | Returns              | Use Case              |
| ------------------------------ | -------------------- | --------------------- |
| `picoBridge.getMockRunnerPath` | Path to `runner.py`  | Custom launch configs |
| `picoBridge.getMockPath`       | Path to mock modules | PYTHONPATH setup      |
| `picoBridge.getSelectedBoard`  | Current board type   | Board-specific logic  |

Example usage in a task or script:

```bash
# Get runner path via VS Code command
RUNNER=$(code --command picoBridge.getMockRunnerPath)
python3 "$RUNNER" my_script.py
```

---

## 🐛 Troubleshooting

### Emulator Issues

#### "No module named 'machine'"

Your script is running with regular Python instead of the emulator. Use:

- The inline **▷ Play** button in Project Files, OR
- Run → "MicroPython (Emulator)" launch config

#### Import errors for MicroPython modules

Make sure the emulator is properly initialized. The extension automatically sets up the Python path when using the emulator commands.

### Server Issues

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
