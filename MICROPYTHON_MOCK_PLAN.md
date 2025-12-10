# MicroPython Hardware Mock - Implementation Plan

## Overview

Create a full MicroPython hardware emulator that runs inside VS Code, allowing developers to test their code without physical hardware. The mock will simulate RPi Pico and ESP32 boards with visual feedback via a webview panel.

**Key Principle**: MicroPython scripts should run like normal Python in VS Code - no import errors, no linting warnings, click Play and it works.

---

## Goals

| Goal                        | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| **Full Emulation**          | Simulate MicroPython as close to real hardware as possible                |
| **Zero Linting Errors**     | `import machine`, `import utime` work without red squiggles               |
| **Multi-board**             | Support Raspberry Pi Pico (RP2040) and ESP32                              |
| **Visual Feedback**         | Show a virtual board with LED states, pin activity in a VS Code webview   |
| **Interactive I2C**         | User can enter sensor return values via UI (e.g., accelerometer X/Y/Z)    |
| **Zero Upload Impact**      | Mock lives in hidden folder (`.mock/`) - invisible to Pico Bridge uploads |
| **Click Play to Run**       | VS Code's standard Play button triggers the emulator                      |
| **Bridge Menu Integration** | "Open Emulator" command in Pico Bridge sidebar menu                       |

---

## Linting & Import Resolution

To eliminate import errors and linting warnings for MicroPython modules:

### Strategy: Type Stubs + Path Configuration

#### 1. Type Stub Files (`.pyi`)

Create comprehensive type stubs for Pylance/Pyright:

```
.mock/
├── typings/                    # Type stubs for static analysis
│   ├── machine.pyi             # Full type hints for machine module
│   ├── utime.pyi               # Time functions with signatures
│   ├── network.pyi             # WLAN, interfaces
│   ├── neopixel.pyi            # NeoPixel class
│   ├── rp2.pyi                 # RP2040-specific
│   ├── esp.pyi                 # ESP-specific
│   ├── esp32.pyi               # ESP32-specific
│   └── ... (all MicroPython modules)
```

Example `machine.pyi`:

```python
from typing import Optional, Callable, Any

class Pin:
    IN: int
    OUT: int
    PULL_UP: int
    PULL_DOWN: int
    IRQ_RISING: int
    IRQ_FALLING: int

    def __init__(self, id: int | str, mode: int = ..., pull: Optional[int] = ..., value: Optional[int] = ...) -> None: ...
    def value(self, val: Optional[int] = ...) -> Optional[int]: ...
    def on(self) -> None: ...
    def off(self) -> None: ...
    def toggle(self) -> None: ...
    def irq(self, handler: Optional[Callable[[Pin], None]] = ..., trigger: int = ...) -> None: ...

class PWM:
    def __init__(self, pin: Pin, freq: int = ..., duty_u16: int = ...) -> None: ...
    def freq(self, value: Optional[int] = ...) -> Optional[int]: ...
    def duty_u16(self, value: Optional[int] = ...) -> Optional[int]: ...
    def deinit(self) -> None: ...

class I2C:
    def __init__(self, id: int, scl: Optional[Pin] = ..., sda: Optional[Pin] = ..., freq: int = ...) -> None: ...
    def scan(self) -> list[int]: ...
    def writeto(self, addr: int, buf: bytes) -> int: ...
    def readfrom(self, addr: int, nbytes: int) -> bytes: ...
    def writeto_mem(self, addr: int, memaddr: int, buf: bytes) -> None: ...
    def readfrom_mem(self, addr: int, memaddr: int, nbytes: int) -> bytes: ...

# ... ADC, SPI, UART, Timer, WDT, RTC
```

#### 2. Pyrightconfig Configuration

Create `pyrightconfig.json` in workspace root:

```json
{
  "include": ["**/*.py"],
  "exclude": [".mock/micropython/**", "node_modules"],
  "stubPath": ".mock/typings",
  "extraPaths": [".mock/micropython"],
  "reportMissingImports": false,
  "reportMissingModuleSource": false,
  "pythonVersion": "3.11",
  "typeCheckingMode": "basic"
}
```

#### 3. VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "python.analysis.extraPaths": [".mock/micropython", ".mock/typings"],
  "python.analysis.stubPath": ".mock/typings",
  "python.analysis.diagnosticSeverityOverrides": {
    "reportMissingModuleSource": "none"
  }
}
```

**Result**: User writes `import machine` → No red squiggles, full IntelliSense!

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VS Code                                     │
│                                                                          │
│  ┌────────────────┐     ┌─────────────────┐     ┌────────────────────┐  │
│  │  User Code     │     │  Pico Bridge    │     │  Emulator Webview  │  │
│  │  (main.py)     │     │  Extension      │     │  (Board + Console) │  │
│  └───────┬────────┘     └────────┬────────┘     └─────────▲──────────┘  │
│          │                       │                        │              │
│          │ Click Play            │ "Open Emulator"        │ WebSocket   │
│          ▼                       ▼                        │              │
│  ┌────────────────┐     ┌─────────────────┐     ┌────────┴───────────┐  │
│  │  Python Debug  │────▶│  Mock Runner    │────▶│  State Manager     │  │
│  │  Adapter       │     │  (.mock/)       │     │  (pins, I2C, etc)  │  │
│  └────────────────┘     └─────────────────┘     └────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  .mock/micropython/  (runtime modules)                            │   │
│  │  .mock/typings/      (static analysis stubs)                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## VS Code Integration

### Play Button Integration

When user clicks the Play button (▶) in VS Code's top-right corner:

1. **Launch Configuration** detects `.py` file and uses mock runner
2. **Emulator webview** automatically opens (if not already open)
3. **Script executes** with mock MicroPython modules
4. **Pin activity** streams to webview in real-time

#### `.vscode/launch.json` Addition

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "MicroPython (Emulator)",
      "type": "debugpy",
      "request": "launch",
      "program": "${workspaceFolder}/.mock/runner.py",
      "args": ["${file}"],
      "console": "integratedTerminal",
      "env": {
        "MICROPYTHON_MOCK": "1",
        "MOCK_BOARD": "pico"
      },
      "preLaunchTask": "picoBridge.openEmulator"
    }
  ]
}
```

### Bridge Menu Integration

Add "Open Emulator" to the Pico Bridge sidebar menu:

```typescript
// package.json contribution
{
  "commands": [
    {
      "command": "picoBridge.openEmulator",
      "title": "Open Emulator",
      "icon": "$(circuit-board)"
    }
  ],
  "menus": {
    "view/title": [
      {
        "command": "picoBridge.openEmulator",
        "when": "view == picoBridgeFiles",
        "group": "navigation"
      }
    ]
  }
}
```

---

## Emulator Webview

### Menu Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MicroPython Emulator                                    [≡ Menu]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Menu Items:                                                            │
│  ┌─────────────────────┐                                                │
│  │ 📋 View             │                                                │
│  │   ├─ Emulator       │  ← Default view (board + console)              │
│  │   └─ Pinout Diagram │  ← Full pinout reference image                 │
│  │ 🔧 Board            │                                                │
│  │   ├─ Raspberry Pi Pico                                               │
│  │   └─ ESP32 DevKit                                                    │
│  │ 📡 I2C Devices      │                                                │
│  │   └─ Configure...   │  ← Opens device configuration panel            │
│  └─────────────────────┘                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Emulator View (Default)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MicroPython Emulator - Raspberry Pi Pico              [≡] [Pico ▼]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     BOARD SCHEMATIC                              │   │
│  │                                                                  │   │
│  │   [LED]     ┌──────────────────────────────────┐                │   │
│  │    ●        │      Raspberry Pi Pico           │                │   │
│  │   GP25      │                                  │                │   │
│  │             │  GP0  ●──┤├──●  VBUS             │                │   │
│  │             │  GP1  ●──┤├──●  VSYS             │                │   │
│  │             │  GND  ●──┤├──●  GND              │                │   │
│  │             │  GP2  ●──┤├──●  3V3_EN           │                │   │
│  │             │  GP3  ●──┤├──●  3V3              │                │   │
│  │             │  ...                              │                │   │
│  │             │  GP28 ●──┤├──●  ADC_VREF         │                │   │
│  │             │                                  │                │   │
│  │             └──────────────────────────────────┘                │   │
│  │                                                                  │   │
│  │  Pin Legend:  ● HIGH (green)  ○ LOW (dim)  ◐ PWM  ⚡ Activity   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ I2C Devices                 │  │ Console Output                  │  │
│  │                             │  │                                 │  │
│  │ 0x68: MPU6050 [Configure]   │  │ > [Mock] Running: main.py       │  │
│  │   X: [====|====] 0.5g       │  │ > [Mock] Board: Raspberry Pi    │  │
│  │   Y: [====|====] -0.2g      │  │ > ─────────────────────────     │  │
│  │   Z: [====|====] 1.0g       │  │ > LED on                        │  │
│  │                             │  │ > Accel: X=0.5 Y=-0.2 Z=1.0     │  │
│  │ 0x76: BME280 [Configure]    │  │ > Temperature: 22.5°C           │  │
│  │   Temp:  [========] 22.5°C  │  │ >                               │  │
│  │   Humid: [======] 45%       │  │                                 │  │
│  │   Press: [========] 1013hPa │  │                                 │  │
│  │                             │  │                                 │  │
│  │ [+ Add Device]              │  │                                 │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ NeoPixels (GP16, 8 LEDs)                                         │   │
│  │ ● ● ● ● ● ● ● ●                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pinout Diagram View

When user selects "View → Pinout Diagram":

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Pinout Reference - Raspberry Pi Pico                  [≡] [← Back]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │           [Full Official Raspberry Pi Pico Pinout SVG]          │   │
│  │                                                                  │   │
│  │                    (Accurate reference diagram)                  │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

The pinout diagrams will be stored in the extension:

```
.extension/
└── media/
    └── pinouts/
        ├── pico-pinout.svg      # Official Raspberry Pi Pico pinout
        └── esp32-pinout.svg     # ESP32 DevKit pinout
```

---

## I2C Device Simulation

### The Problem

When user code does `i2c.readfrom_mem(0x68, 0x3B, 14)` (read accelerometer data), the emulator needs to return realistic bytes. But we can't know what values the user expects.

### Solution: Interactive Device Configuration

#### Flow:

1. **Auto-detect**: When script calls `i2c.scan()` or accesses an address, emulator checks if device is known
2. **Prompt user**: If address matches known device (MPU6050 at 0x68), show configuration UI
3. **User enters values**: Sliders/inputs for human-readable values (X=0.5g, Y=-0.2g, Z=1.0g)
4. **Emulator converts**: Values → raw bytes in correct format for that device
5. **Fallback**: Unknown devices return `0x00` bytes (configurable)

#### I2C Device Configuration Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configure I2C Device                                          [×]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Address: 0x68                                                          │
│  Detected: MPU6050 (Accelerometer/Gyroscope)                           │
│                                                                         │
│  ─── Accelerometer (±2g range) ───────────────────────────────────────  │
│                                                                         │
│  X-Axis:  [-2g] ════════════●════════════ [+2g]     Value: 0.50 g     │
│  Y-Axis:  [-2g] ════════●════════════════ [+2g]     Value: -0.20 g    │
│  Z-Axis:  [-2g] ════════════════════●════ [+2g]     Value: 1.00 g     │
│                                                                         │
│  ─── Gyroscope (±250°/s range) ───────────────────────────────────────  │
│                                                                         │
│  X-Axis:  [-250] ══════════●══════════════ [+250]   Value: 0.0 °/s    │
│  Y-Axis:  [-250] ══════════●══════════════ [+250]   Value: 0.0 °/s    │
│  Z-Axis:  [-250] ══════════●══════════════ [+250]   Value: 0.0 °/s    │
│                                                                         │
│  ─── Temperature ─────────────────────────────────────────────────────  │
│                                                                         │
│  Temp:    [-40°C] ═════════════●══════════ [+85°C]  Value: 25.0 °C    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Raw bytes preview (register 0x3B, 14 bytes):                     │   │
│  │ 0x10 0x00 0xFC 0xCD 0x40 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ... │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Apply]  [Reset to Defaults]  [Enable Random Noise ☑]                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Conversion Logic (MPU6050 Example)

```python
class MPU6050Device:
    """MPU6050 I2C device simulator"""

    # Register addresses
    ACCEL_XOUT_H = 0x3B
    GYRO_XOUT_H = 0x43
    TEMP_OUT_H = 0x41
    WHO_AM_I = 0x75

    def __init__(self, addr=0x68):
        self.addr = addr
        # User-configurable values (set via webview)
        self.accel = {'x': 0.0, 'y': 0.0, 'z': 1.0}  # g units
        self.gyro = {'x': 0.0, 'y': 0.0, 'z': 0.0}   # °/s
        self.temp = 25.0  # °C
        self.noise_enabled = True

    def read_mem(self, memaddr, nbytes):
        if memaddr == self.WHO_AM_I:
            return bytes([0x68])  # Device ID

        if memaddr == self.ACCEL_XOUT_H:
            # Convert g values to raw 16-bit signed integers
            # Scale: ±2g = ±32768, so 1g = 16384
            ax = self._g_to_raw(self.accel['x'])
            ay = self._g_to_raw(self.accel['y'])
            az = self._g_to_raw(self.accel['z'])

            # Temperature: raw = (temp_c + 36.53) / 0.00294
            temp_raw = int((self.temp + 36.53) / 0.00294)

            # Gyro: ±250°/s = ±32768, so 1°/s = 131
            gx = self._dps_to_raw(self.gyro['x'])
            gy = self._dps_to_raw(self.gyro['y'])
            gz = self._dps_to_raw(self.gyro['z'])

            # Pack as big-endian 16-bit values
            data = struct.pack('>hhhhhhh', ax, ay, az, temp_raw, gx, gy, gz)
            return data[:nbytes]

        # Unknown register - return zeros
        return bytes(nbytes)

    def _g_to_raw(self, g_value):
        raw = int(g_value * 16384)  # ±2g scale
        if self.noise_enabled:
            raw += random.randint(-50, 50)  # Small noise
        return max(-32768, min(32767, raw))

    def _dps_to_raw(self, dps_value):
        raw = int(dps_value * 131)  # ±250°/s scale
        if self.noise_enabled:
            raw += random.randint(-10, 10)
        return max(-32768, min(32767, raw))
```

#### Supported Devices (Initial Set)

| Address   | Device  | User Inputs                                  | Output                            |
| --------- | ------- | -------------------------------------------- | --------------------------------- |
| 0x68      | MPU6050 | Accel X/Y/Z (g), Gyro X/Y/Z (°/s), Temp (°C) | 14-byte sensor data               |
| 0x76/0x77 | BME280  | Temp (°C), Humidity (%), Pressure (hPa)      | Calibrated raw bytes              |
| 0x3C/0x3D | SSD1306 | N/A (display)                                | ACKs writes, captures framebuffer |
| 0x23      | BH1750  | Light level (lux)                            | 16-bit light value                |
| 0x27/0x20 | PCF8574 | 8 GPIO states                                | Byte reflecting state             |
| 0x48      | ADS1115 | 4 analog voltages                            | 16-bit ADC readings               |
| Unknown   | Generic | Hex byte pattern                             | Repeated pattern                  |

#### Fallback for Unknown Devices

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Unknown I2C Device                                            [×]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Address: 0x42 (Unknown device)                                         │
│                                                                         │
│  The emulator doesn't recognize this I2C address.                       │
│  Configure how it should respond to read requests:                      │
│                                                                         │
│  Response Mode:                                                         │
│    ○ Return zeros (0x00 0x00 0x00 ...)                                 │
│    ● Return pattern: [0xFF] repeated                                    │
│    ○ Return custom hex: [________________]                              │
│    ○ Return random bytes                                                │
│                                                                         │
│  [Apply]                                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pin Activity Visualization

### Visual Indicators

| State              | Indicator         | Description                         |
| ------------------ | ----------------- | ----------------------------------- |
| **HIGH**           | 🟢 Solid green    | Pin output is 1                     |
| **LOW**            | ⚫ Dim/off        | Pin output is 0                     |
| **PWM**            | 🟡 Pulsing yellow | PWM active, brightness = duty cycle |
| **Read Activity**  | ⚡ Blue flash     | Pin was read (INPUT mode)           |
| **Write Activity** | ⚡ Orange flash   | Pin value changed                   |
| **Input Mode**     | 📥 Arrow in       | Pin configured as INPUT             |
| **Output Mode**    | 📤 Arrow out      | Pin configured as OUTPUT            |

### Activity Log

Below the board schematic, show recent pin activity:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Pin Activity Log                                          [Clear]     │
├─────────────────────────────────────────────────────────────────────────┤
│  00:00.000  GP25  OUT   HIGH    # LED on                               │
│  00:00.500  GP25  OUT   LOW     # LED off                              │
│  00:01.000  GP25  OUT   HIGH    # LED on                               │
│  00:01.002  GP16  PWM   50%     # NeoPixel data pin                    │
│  00:01.003  I2C0  READ  0x68    # MPU6050 accelerometer                │
│  00:01.004  GP2   IN    HIGH    # Button read                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Board Schematics

### Design Principles

1. **Accuracy**: Match official pinout exactly
2. **Simplicity**: Clean SVG that's easy to animate
3. **Interactivity**: Each pin is a clickable/hoverable element
4. **Source**: Based on official documentation diagrams

### Raspberry Pi Pico Schematic

Will create a simplified but accurate SVG based on the official pinout:

```svg
<!-- Simplified structure -->
<svg viewBox="0 0 400 600">
  <!-- Board outline -->
  <rect class="board" x="50" y="50" width="300" height="500" rx="10"/>

  <!-- USB connector -->
  <rect class="usb" x="150" y="30" width="100" height="40"/>

  <!-- Bootsel button -->
  <circle class="button" cx="200" cy="120" r="15"/>

  <!-- LED (GP25) -->
  <circle class="led" id="led-gp25" cx="280" cy="120" r="8"/>

  <!-- Left pin row -->
  <g class="pins-left">
    <circle class="pin" id="pin-gp0" cx="70" cy="150" r="6"/>
    <text x="85" y="155">GP0</text>
    <!-- ... 20 pins -->
  </g>

  <!-- Right pin row -->
  <g class="pins-right">
    <circle class="pin" id="pin-vbus" cx="330" cy="150" r="6"/>
    <text x="290" y="155">VBUS</text>
    <!-- ... 20 pins -->
  </g>

  <!-- Debug pins (bottom) -->
  <g class="pins-debug">
    <!-- 3 debug pins -->
  </g>
</svg>
```

### ESP32 DevKit Schematic

Similar approach for ESP32-WROOM-32 DevKit:

- 38 pins (19 per side)
- Boot and EN buttons
- Power LED and user LED
- USB-UART chip area

---

## Folder Structure (Updated)

```
.mock/                          # Hidden from Pico Bridge uploads
├── __init__.py
├── runner.py                   # Main entry point - executes user code
├── config.py                   # Board selection, pin mappings
├── state.py                    # Global emulator state (pins, I2C, etc)
├── websocket_server.py         # Pushes state to webview
│
├── typings/                    # Type stubs for Pylance (static analysis)
│   ├── machine.pyi
│   ├── utime.pyi
│   ├── time.pyi
│   ├── network.pyi
│   ├── neopixel.pyi
│   ├── rp2.pyi
│   ├── esp.pyi
│   ├── esp32.pyi
│   ├── dht.pyi
│   ├── onewire.pyi
│   ├── framebuf.pyi
│   ├── bluetooth.pyi
│   ├── _thread.pyi
│   └── micropython.pyi
│
├── micropython/                # Runtime mock modules
│   ├── __init__.py
│   ├── machine.py
│   ├── utime.py
│   ├── time.py
│   └── ... (same as typings, but with implementations)
│
├── boards/                     # Board definitions
│   ├── __init__.py
│   ├── base.py
│   ├── rpi_pico.py
│   └── esp32.py
│
├── devices/                    # I2C/SPI device simulators
│   ├── __init__.py
│   ├── registry.py
│   ├── i2c/
│   │   ├── __init__.py
│   │   ├── mpu6050.py
│   │   ├── bme280.py
│   │   ├── ssd1306.py
│   │   ├── bh1750.py
│   │   ├── pcf8574.py
│   │   ├── ads1115.py
│   │   └── generic.py
│   └── spi/
│       ├── __init__.py
│       └── generic.py
│
└── webview/                    # VS Code webview assets
    ├── index.html
    ├── style.css
    └── js/
        ├── main.js
        ├── menu.js
        ├── websocket.js
        ├── boards/
        │   ├── pico.js
        │   └── esp32.js
        ├── components/
        │   ├── pin.js
        │   ├── led.js
        │   ├── console.js
        │   ├── i2c-config.js
        │   └── activity-log.js
        └── pinout-viewer.js

.extension/
└── media/
    └── pinouts/
        ├── pico-pinout.svg     # Official Pico pinout (reference)
        └── esp32-pinout.svg    # Official ESP32 pinout (reference)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MicroPython Mock Runner")
    parser.add_argument("script", help="Path to MicroPython script to run")
    parser.add_argument("--board", default="pico", choices=["pico", "esp32"],
                        help="Board to emulate")
    args = parser.parse_args()

    os.environ.setdefault('MOCK_BOARD', args.board)
    run_script(args.script)
```

### VS Code Extension Command

Add a command to the extension that:

1. Opens the board visualization webview
2. Starts the WebSocket server
3. Runs the current file with the mock runner

```typescript
// In extension commands
vscode.commands.registerCommand("picoBridge.runWithMock", async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !editor.document.fileName.endsWith(".py")) {
    vscode.window.showErrorMessage("Open a Python file to run with mock");
    return;
  }

  // Open webview panel
  const panel = vscode.window.createWebviewPanel(
    "micropythonMock",
    "MicroPython Mock",
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getMockWebviewContent();

  // Run the script
  const terminal = vscode.window.createTerminal("MicroPython Mock");
  terminal.show();
  terminal.sendText(`python "${mockRunnerPath}" "${editor.document.fileName}"`);
});
```

---

## Webview Visualization

### Features

1. **Board SVG** - Visual representation of Pico/ESP32 with labeled pins
2. **Pin States** - Real-time HIGH/LOW indicators with color coding
3. **PWM Visualization** - Brightness/pulse animation for PWM pins
4. **LED Strip** - NeoPixel visualization as colored circles
5. **Console Output** - Captured print() statements
6. **Sensor Controls** - Sliders to adjust simulated sensor values
7. **I2C/SPI Monitor** - Log of bus transactions

### Webview Layout

```
┌─────────────────────────────────────────────────────────────┐
│  MicroPython Mock - Raspberry Pi Pico          [ESP32 ▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│    ┌─────────────────────────────────────────────┐         │
│    │                                             │         │
│    │           [Board SVG with pins]             │         │
│    │                                             │         │
│    │    GP0 ● ─────────────────────── ● GP28    │         │
│    │    GP1 ○ ─────────────────────── ○ GND     │         │
│    │    ...                                      │         │
│    │                                             │         │
│    └─────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │ Sensors          │  │ Console                      │    │
│  │                  │  │                              │    │
│  │ Temp: [====] 22°C│  │ > LED on                     │    │
│  │ Humid:[===] 45%  │  │ > Reading sensor...          │    │
│  │ Light:[==] 500lx │  │ > Temperature: 22.5°C        │    │
│  │                  │  │                              │    │
│  └──────────────────┘  └──────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ NeoPixels (8 LEDs)                                   │  │
│  │ ● ● ● ● ● ● ● ●                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure & Linting Support (Week 1)

- [ ] Create `.mock/` folder structure
- [ ] Create `typings/` folder with all `.pyi` stub files
- [ ] Configure `pyrightconfig.json` for zero import errors
- [ ] Update `.vscode/settings.json` for Pylance
- [ ] Implement `state.py` - global emulator state management
- [ ] Implement basic `machine.py` - Pin, PWM classes
- [ ] Implement `time.py` / `utime.py`
- [ ] Create `runner.py` - script execution
- [ ] Add VS Code launch configuration for Play button
- [ ] Basic console output

### Phase 2: Extended Machine Module (Week 2)

- [ ] ADC class with noise simulation
- [ ] I2C class with device registry framework
- [ ] SPI class
- [ ] UART class (loopback simulation)
- [ ] Timer class with real threading
- [ ] WDT class (warning on timeout)
- [ ] RTC class

### Phase 3: I2C Device Simulators (Week 3)

- [ ] Device registry with address auto-detection
- [ ] Interactive configuration panel UI
- [ ] MPU6050 (accelerometer/gyroscope) with user input → hex conversion
- [ ] BME280 (temperature/humidity/pressure)
- [ ] SSD1306 OLED (capture display buffer)
- [ ] BH1750 (light sensor)
- [ ] Generic device fallback with configurable response

### Phase 4: Board-Specific Modules (Week 4)

- [ ] `rp2.py` - PIO stubs, StateMachine
- [ ] `esp.py` - ESP-specific functions
- [ ] `esp32.py` - Partition, RMT, ULP stubs
- [ ] `network.py` - WLAN simulation
- [ ] `neopixel.py` - LED strip simulation
- [ ] `bluetooth.py` - BLE stubs

### Phase 5: Webview Emulator (Week 5)

- [ ] WebSocket server for real-time state updates
- [ ] Menu system (View, Board, I2C Devices)
- [ ] Pico board schematic SVG (accurate, animated)
- [ ] ESP32 board schematic SVG
- [ ] Pin state visualization (HIGH/LOW/PWM/Activity)
- [ ] Activity log panel
- [ ] Console output panel
- [ ] NeoPixel strip display

### Phase 6: VS Code Extension Integration (Week 6)

- [ ] "Open Emulator" command in Bridge menu
- [ ] Play button triggers mock runner + opens webview
- [ ] Pinout diagram viewer (menu item)
- [ ] Copy official pinout SVGs to extension media
- [ ] I2C device configuration modal
- [ ] Board selection dropdown
- [ ] Persist device configurations

---

## Testing Strategy

### Unit Tests

- Each mock module has corresponding test file
- Verify API compatibility with real MicroPython
- Test timer accuracy and threading safety
- Test I2C value conversion accuracy

### Integration Tests

- Run actual MicroPython example scripts
- Verify no import errors with fresh workspace
- Test webview ↔ runner communication
- Test library auto-detection from `lib/` folder

### User Acceptance

- Blink LED example (GP25 light toggles in webview)
- Sensor reading example (user adjusts slider, script reads value)
- NeoPixel animation example (colors appear in webview)
- I2C accelerometer example (user sets X/Y/Z, script decodes correctly)

---

## Risks & Mitigations

| Risk                       | Impact   | Mitigation                                        |
| -------------------------- | -------- | ------------------------------------------------- |
| Timing differences         | Medium   | Document limitations, use `sleep()` not busy-wait |
| Missing API coverage       | High     | Start with common modules, add on-demand          |
| Threading issues           | Medium   | Use daemon threads, proper cleanup                |
| WebSocket complexity       | Medium   | Use simple JSON protocol, reconnect on failure    |
| Upload conflicts           | Critical | `.mock/` folder hidden (starts with `.`)          |
| Linting still shows errors | High     | Comprehensive `.pyi` stubs + pyrightconfig        |
| I2C value conversion bugs  | Medium   | Unit tests for each device, show raw hex preview  |

---

## Success Criteria

1. ✅ User writes `import machine` - **no red squiggles**, full IntelliSense
2. ✅ User clicks Play button - emulator runs and webview opens
3. ✅ Pin state changes visible in webview within 100ms
4. ✅ User adjusts accelerometer slider - script reads correct g values
5. ✅ Common libraries (machine, time, neopixel) work without modification
6. ✅ "Open Emulator" appears in Pico Bridge menu
7. ✅ Pinout diagram viewable from webview menu
8. ✅ No files in `.mock/` are uploaded to Pico via bridge
9. ✅ Supports both Pico and ESP32 board emulation

---

## Future Enhancements

- **Record/Replay**: Capture hardware interactions for regression testing
- **Breakpoints**: Pause on pin state changes
- **Logic Analyzer**: Visualize timing of signals
- **Network Simulation**: Fake WiFi with configurable latency/errors
- **File System**: Simulate Pico's flash file system
- **Multi-board**: Run multiple virtual boards simultaneously
- **Display Rendering**: Show SSD1306 framebuffer contents as image
- **Import from Real Device**: Read sensor values from connected Pico, replay in mock

---

## References

- [MicroPython Documentation](https://docs.micropython.org/)
- [MicroPython Source - machine module](https://github.com/micropython/micropython/tree/master/ports/rp2/machine)
- [RP2040 Datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- [ESP32 Technical Reference](https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf)
- [Raspberry Pi Pico Pinout](https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf)
- [ESP32 DevKit Pinout](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html)
