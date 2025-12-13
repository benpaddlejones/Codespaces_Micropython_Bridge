# MicroPython Hardware Mock - Implementation Plan

## Overview

Create a full MicroPython hardware emulator that runs inside VS Code, allowing developers to test their code without physical hardware. The mock will simulate RPi Pico and ESP32 boards with visual feedback via a webview panel.

**Key Principle**: MicroPython scripts should run like normal Python in VS Code - no import errors, no linting warnings, click Play and it works.

**Design Philosophy**: Start simple, make more complex when simple is working.

---

## 📋 TODO List (Active Sprint)

### Priority Tasks

| #   | Task                            | Status         | Phase  | Notes                                                                          |
| --- | ------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------ |
| 1   | **Pico 2 W Board SVG**          | ✅ Complete    | 4      | Created `board-pico2w.svg` and `board-pico-w.svg`; dropdown updated            |
| 2   | **I2C Power-On Response Mock**  | ✅ Complete    | 4      | Auto-respond mode, `register_device()`, improved `scan()`                      |
| 3   | **Emulator UI Modernization**   | ✅ Complete    | 5      | Complete CSS rewrite with CSS variables, card layout, modern shadows           |
| 4   | **Full MicroPython Mock Audit** | ✅ Complete    | 5      | Added 11 new modules: micropython, uctypes, ubinascii, ujson, ure, uzlib, etc. |
| 5   | **WebSocket Server**            | ⏸️ Deferred    | 1      | Stdout communication works well; WebSocket optional future enhancement         |
| 6   | **Official Pinout Diagrams**    | ✅ Complete    | 3      | `pico-pinout.svg` and `esp32-pinout.svg` in `media/pinouts/`                   |
| 7   | **View Pinout Menu Option**     | ✅ Complete    | 3      | 📌 Pinout button in header; modal with SVG display                             |
| 8   | **Test Pin Activity Real-time** | ✅ Complete    | 3      | Verified pin updates in webview during script execution                        |
| 9   | **Auto-configure Pylance**      | ✅ Complete    | 4      | Added `pylanceConfig.ts`; auto-configures `extraPaths` on activation           |
| 10  | **ESP32 Board Schematic SVG**   | ✅ Complete    | 4      | ESP32 DevKit SVG exists (`board-esp32.svg`)                                    |
| 11  | **Full Workflow Test**          | ✅ Complete    | 4      | Tested blink script via runner.py; emulator working                            |
| 12  | **Error Handling & Messages**   | ✅ Complete    | 5      | Enhanced runner.py with ImportError/SyntaxError hints; improved TS error UI    |
| 13  | **Performance Optimization**    | ✅ Complete    | 5      | Pin throttling, sleep_us optimization; 18% throughput gain                     |
| 14  | **Test Community Examples**     | ✅ Complete    | 5      | 20 community patterns tested; all passing                                      |
| 15  | **I2C Device Presets**          | 🔲 Not Started | Future | MPU6050, BME280, etc. with pre-filled hex patterns                             |
| 16  | **SSD1306 Display Rendering**   | 🔲 Not Started | Future | Show SSD1306 framebuffer contents as image                                     |
| 17  | **Record/Replay Interactions**  | 🔲 Not Started | Future | Record hardware interactions for regression testing                            |
| 18  | **Multi-board Simulation**      | 🔲 Not Started | Future | Run multiple virtual boards simultaneously                                     |

### Task Details

#### 1. Pico 2 W Board SVG ✅

- [x] Research Pico 2 W pinout differences from Pico W
- [x] Create `board-pico2w.svg` with accurate pin layout (RP2350 chip, WiFi module)
- [x] Add "Pico 2 W" option to board dropdown
- [x] Update webview provider to handle new board type
- [x] Also created missing `board-pico-w.svg` (Pico W)

#### 2. I2C Power-On Response Mock ✅

- [x] Modify `I2C.readfrom()` to always return non-zero on first byte (device present)
- [x] Implement `I2C.scan()` to return configured mock addresses
- [x] Add `I2C.register_device(addr)` method to simulate connected devices
- [x] Handle common patterns: `while not i2c.scan()`, `while device.read() == 0`
- [x] Added `set_i2c_auto_respond()` and common device addresses (0x68, 0x3C, 0x76, 0x27)

#### 3. Emulator UI Modernization ✅

- [x] Update webview CSS to match bridge styling (fonts, colors, spacing)
- [x] Add card-based layout with subtle shadows
- [x] Improve pin state indicators (larger, clearer)
- [x] Add dark/light theme support (CSS variables)
- [x] Modernize console output styling
- [x] Add toolbar with clear actions
- [x] Custom scrollbars, gradient headers, emoji icons

#### 4. Full MicroPython Mock Audit ✅

- [x] Audit `micropython/` folder for incomplete implementations
- [x] Check all pass-through modules (uio→io, uos→os, etc.)
- [x] Verify stub files match runtime implementations
- [x] Add missing modules: `uctypes`, `ubinascii`, `ujson`, `ure`, `uzlib`
- [x] Document any MicroPython-specific behaviors not covered
- [x] Added: micropython.py, usocket.py, uselect.py, ustruct.py, uhashlib.py, ucollections.py

#### 5. WebSocket Server ⏸️ Deferred

- [ ] Create `emulator/mock/websocket_server.py`
- [ ] Push pin state changes to webview in real-time
- [ ] Replace current stdout-based communication
- **Note**: Current stdout with `__EMU__` prefix works reliably; WebSocket adds complexity for minimal gain

#### 6-7. Pinout Diagrams & Menu ✅

- [x] Downloaded official Pico pinout SVG
- [x] Created ESP32 pinout diagram with color-coded pins and legend
- [x] Add to `media/pinouts/` folder
- [x] Create "View Pinout" button in webview toolbar (📌 Pinout)
- [x] Modal overlay with board-specific pinout display
- [x] Write integration tests for real-time pin visualization

#### 8. Test Pin Activity Real-time ✅

- [x] Verified pin updates stream to webview during script execution
- [x] LED state changes visible in board SVG

#### 9. Auto-configure Pylance ✅

- [x] Created `pylanceConfig.ts` with `configurePylanceForMock()` function
- [x] Auto-adds `emulator/mock/typings` and `emulator/mock/micropython` to `extraPaths`
- [x] Called on extension activation in `extension.ts`
- [x] Includes `removePylanceConfig()` for cleanup

#### 10. ESP32 Board Schematic SVG ✅

- [x] ESP32 DevKit SVG exists (`board-esp32.svg`)
- [x] Board dropdown includes ESP32 option

#### 11. Full Workflow Test ✅

- [x] Tested blink script (`py_scripts/v01.py`) via `runner.py`
- [x] Pin updates emit correctly with `__EMU__` prefix
- [x] Emulator outputs visible in terminal

#### 12. Error Handling & Messages ✅

- [x] Enhanced `runner.py` with specific error handlers for ImportError, SyntaxError, FileNotFoundError
- [x] Added helpful "hint" field to error events
- [x] Updated webview JS to display hints with 💡 emoji
- [x] Improved TypeScript error handling with actionable buttons (Show Logs, Open Settings)

#### 13. Performance Optimization ✅

- [x] Created `py_scripts/performance_profile.py` - comprehensive profiling benchmark (57,000+ operations)
- [x] Identified bottlenecks: gc.collect (0.95ms), sleep_us (0.08ms), pin toggle (0.022ms)
- [x] Optimized `utime.sleep_us()` - skip actual sleep for delays < 100µs (800x faster)
- [x] Optimized `state.update_pin()` - throttle webview emissions to 1ms intervals (13x faster pin toggle)
- [x] Overall throughput improved 18%: 58,700 → 69,500 ops/sec
- [x] Key results:
  - Pin toggle: 575,382 ops/sec
  - sleep_us(1): 7,385,906 ops/sec
  - PWM duty: 229,268 ops/sec

#### 14. Test Community Examples ✅

- [x] Created `py_scripts/community_examples.py` with 20 real-world patterns
- [x] Tests cover: LED blink, button debounce, PWM fade, temperature sensor, I2C OLED,
      MPU6050 accelerometer, NeoPixel rainbow, WiFi connect, timer periodic, UART,
      SPI SD card, RTC, watchdog, PIO state machine, multi-ADC, IRQ handler,
      const optimization, binary data, collections, full environmental monitor project
- [x] All 20 community examples pass emulator validation

---

## Current Status (December 13, 2025)

| Area                  | Status                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| **Extension Release** | Version 1.1.0 packaged; Phase 5 complete                                      |
| **Emulator Code**     | Phase 5 COMPLETE (Pylance, errors, performance, community examples validated) |
| **Plan Alignment**    | 14 of 18 TODO items complete; 1 deferred; 4 remaining (future enhancements)   |

### Latest Progress (December 13, 2025)

- **Phase 1 Complete** ✓ - Mock runtime, runner, LED webview, launch config
- **Phase 2 Complete** ✓ - Stub files, ADC/I2C/SPI/Timer classes, webview panels
- **Phase 3 Complete** ✓ - Board SVGs, pin viz, NeoPixels, board dropdown
- **Phase 4 Complete** ✓:
  - Created Pico 2 W board schematic SVG (`board-pico2w.svg`)
  - Created missing Pico W board schematic SVG (`board-pico-w.svg`)
  - Implemented I2C auto-respond mode to prevent infinite loops
  - Added `I2C.register_device()` for mock device simulation
  - **Auto-configure Pylance** - Created `pylanceConfig.ts` that auto-adds type stubs to `extraPaths`
- **Phase 5 In Progress** ✓:
  - **Error Handling** - Enhanced `runner.py` with ImportError/SyntaxError hints
  - **Workflow Test** - Verified emulator runs blink script successfully
  - **Pin Activity** - Confirmed pin updates stream to webview in real-time
  - Common I2C addresses auto-respond (0x68, 0x3C, 0x76, 0x27)
  - Complete UI modernization with CSS variables and card-based layout
  - Added 11 new MicroPython mock modules
  - Created official pinout diagrams (`pico-pinout.svg`, `esp32-pinout.svg`)
  - Added 📌 Pinout button with modal overlay in webview header
  - Modal displays board-specific pinout with close button and overlay click
  - WebviewProvider updated to serve pinout SVGs via `request_pinout` message
- **Phase 5 Nearly Complete**: Pylance auto-config ✓, error handling ✓, workflow test ✓

### Summary Stats

| Metric                  | Count |
| ----------------------- | ----- |
| TODO items complete     | 12    |
| TODO items deferred     | 1     |
| TODO items remaining    | 5     |
| Board SVGs created      | 4     |
| MicroPython mocks added | 11    |
| Pinout diagrams         | 2     |
| New TS modules          | 1     |

---

## Packaging & Deployment

### Emulator Lives Separate from Bridge

The emulator is **completely isolated** from the bridge server to avoid any conflicts. They live in separate folders within the extension and share no code paths.

```
extension/                        # VS Code Extension Root
├── bridge/                       # Bridge server (EXISTING - DO NOT MODIFY)
│   ├── server.js
│   ├── public/
│   └── src/
│
├── emulator/                     # MicroPython emulator (NEW - ISOLATED)
│   ├── mock/                     # Python runtime mocks
│   │   ├── micropython/          # Runtime mock modules
│   │   ├── typings/              # Type stubs for Pylance
│   │   └── runner.py             # Entry point
│   ├── webview/                  # Emulator UI (separate from bridge)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── js/
│   └── boards/                   # Board definitions
│
├── media/
│   ├── pinouts/                  # Official pinout diagrams
│   └── icons/
│
└── src/                          # Extension TypeScript code
    ├── commands/
    ├── server/                   # Bridge server management
    ├── emulator/                 # Emulator management
    │   ├── index.ts              # EmulatorManager class, re-exports
    │   ├── webviewProvider.ts    # Webview panel management
    │   └── pylanceConfig.ts      # Auto-configure Pylance paths
    └── views/
```

### Why Separate from Bridge?

| Concern     | Bridge                                  | Emulator                    |
| ----------- | --------------------------------------- | --------------------------- |
| **Purpose** | Connect to real hardware via Web Serial | Simulate hardware in Python |
| **Runtime** | Node.js + Express + Socket.IO           | Python + WebSocket          |
| **UI**      | Browser-based (port 3000)               | VS Code Webview panel       |
| **State**   | Real device state                       | Simulated state             |

**No shared code** = No conflicts. They can be developed, tested, and debugged independently.

### How It Works at Runtime

1. **Extension activates** → Registers "MicroPython (Emulator)" launch configuration
2. **User clicks Play** → Extension resolves paths to `extension/emulator/mock/` folder
3. **Pylance configuration** → Extension auto-configures `python.analysis.extraPaths` pointing to `emulator/mock/typings/`
4. **Script runs** → Python executes with `emulator/mock/micropython/` prepended to `sys.path`
5. **Webview opens** → Emulator panel (separate from bridge) shows board state

### Path Resolution

The extension dynamically resolves the emulator folder path:

```typescript
// In extension activation
const extensionPath = context.extensionPath;
const emulatorPath = path.join(extensionPath, "emulator");
const mockPath = path.join(emulatorPath, "mock");
const typingsPath = path.join(mockPath, "typings");
const micropythonPath = path.join(mockPath, "micropython");

// Auto-configure Pylance (does NOT affect bridge)
const config = vscode.workspace.getConfiguration("python.analysis");
await config.update(
  "extraPaths",
  [micropythonPath, typingsPath],
  vscode.ConfigurationTarget.Workspace
);
```

### Why Not Copy to Workspace?

| Approach                   | Pros                                                  | Cons                                                          |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| **Bundle in extension** ✅ | Zero setup, always up-to-date, no workspace pollution | Paths must be resolved dynamically                            |
| Copy to workspace `.mock/` | Simple path references                                | User must manage files, version conflicts, clutters workspace |

**Decision**: Bundle everything in the extension under `emulator/` folder, completely separate from `bridge/`.

---

## Goals

| Goal                        | Description                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| **Full Emulation**          | Simulate MicroPython as close to real hardware as possible              |
| **Zero Linting Errors**     | `import machine`, `import utime` work without red squiggles             |
| **Multi-board**             | Support Raspberry Pi Pico (RP2040) and ESP32                            |
| **Visual Feedback**         | Show a virtual board with LED states, pin activity in a VS Code webview |
| **Simple I2C**              | Basic I2C input/output hex boxes (start simple, enhance later)          |
| **Zero Setup**              | Works immediately after extension install - no manual file copying      |
| **Zero Upload Impact**      | Emulator is in extension folder - never uploaded to Pico                |
| **Click Play to Run**       | VS Code's standard Play button triggers the emulator                    |
| **Bridge Menu Integration** | "Open Emulator" command in Pico Bridge sidebar menu                     |
| **Isolated from Bridge**    | Emulator folder completely separate from bridge - no code conflicts     |

---

## Linting & Import Resolution

To eliminate import errors and linting warnings for MicroPython modules:

### Strategy: Type Stubs + Auto-Configuration

The extension **automatically configures** Pylance/Pyright on activation - users don't need to edit any config files.

#### 1. Type Stub Files (`.pyi`) - Bundled in Extension

```
.extension/mock/typings/        # Type stubs (packaged in extension)
├── machine.pyi                 # Full type hints for machine module
├── utime.pyi                   # Time functions with signatures
├── network.pyi                 # WLAN, interfaces
├── neopixel.pyi                # NeoPixel class
├── rp2.pyi                     # RP2040-specific
├── esp.pyi                     # ESP-specific
├── esp32.pyi                   # ESP32-specific
└── ... (all MicroPython modules)
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

#### 2. Auto-Configuration on Extension Activation

The extension automatically configures Pylance when activated:

```typescript
// In extension.ts activate()
async function configurePylanceForMock(context: vscode.ExtensionContext) {
  const mockPath = path.join(context.extensionPath, "mock");
  const typingsPath = path.join(mockPath, "typings");
  const micropythonPath = path.join(mockPath, "micropython");

  const config = vscode.workspace.getConfiguration("python.analysis");

  // Add extension paths to Pylance analysis
  const extraPaths = config.get<string[]>("extraPaths") || [];
  const newPaths = [micropythonPath, typingsPath];

  for (const p of newPaths) {
    if (!extraPaths.includes(p)) {
      extraPaths.push(p);
    }
  }

  await config.update(
    "extraPaths",
    extraPaths,
    vscode.ConfigurationTarget.Workspace
  );
  await config.update(
    "stubPath",
    typingsPath,
    vscode.ConfigurationTarget.Workspace
  );
}
```

**Result**: User installs extension → writes `import machine` → **No red squiggles, full IntelliSense!**

No manual configuration required.

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

#### `.vscode/launch.json` - Auto-Generated by Extension

The extension creates/updates this launch configuration automatically:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "MicroPython (Emulator)",
      "type": "debugpy",
      "request": "launch",
      "program": "${command:picoBridge.getMockRunnerPath}",
      "args": ["${file}"],
      "console": "integratedTerminal",
      "env": {
        "MICROPYTHON_MOCK": "1",
        "MOCK_BOARD": "${command:picoBridge.getSelectedBoard}",
        "MOCK_PATH": "${command:picoBridge.getMockPath}"
      }
    }
  ]
}
```

The `${command:...}` variables are resolved by the extension to point to the bundled mock folder.

### Bridge Menu Integration

Add "Open Emulator" to the Pico Bridge sidebar menu:

```typescript
// package.json contribution
{
  "commands": [
    {
      "command": "picoBridge.openEmulator",
      "title": "Open MicroPython Emulator",
      "icon": "$(circuit-board)"
    }
  ],
  "menus": {
    "view/title": [
      {
        "command": "picoBridge.openEmulator",
        "when": "view == picoBridge.status",
        "group": "navigation"
      }
    ],
    "viewsWelcome": [
      {
        "view": "picoBridge.status",
        "contents": "...[$(circuit-board) Open Emulator](command:picoBridge.openEmulator)..."
      }
    ]
  }
}
```

Both welcome states (server running or idle) now surface the emulator CTA so users can launch the mock even before wiring up hardware.

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
│  │ 📡 I2C              │                                                │
│  │   └─ Open Monitor   │  ← Simple hex input/output panel               │
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
│  │ I2C Monitor                 │  │ Console Output                  │  │
│  │                             │  │                                 │  │
│  │ Output (writes):            │  │ > [Mock] Running: main.py       │  │
│  │ 0x68 reg:0x3B → 0x00        │  │ > [Mock] Board: Raspberry Pi    │  │
│  │                             │  │ > ─────────────────────────     │  │
│  │ Input (reads return):       │  │ > LED on                        │  │
│  │ [0x00            ]          │  │ > I2C read: 0x00                │  │
│  │                             │  │ > Temperature: 0                │  │
│  │                             │  │ >                               │  │
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

## I2C Device Simulation (Simplified)

### Design Philosophy: Start Simple

Instead of complex device simulators with sliders and value conversion, we start with a **minimal, generic I2C interface** that works for any device.

### Simple I2C UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  I2C Bus Monitor                                               [×]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  I2C Output (last write from script):                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Address: 0x68  Register: 0x3B  Data: 0x00 0x00                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  I2C Input (value returned to script on read):                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [0x00]                                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  (Enter hex bytes separated by spaces, e.g., "0x00 0x01 0xFF")         │
│                                                                         │
│  Default: 0x00 (all reads return 0x00 bytes if not specified)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **Script writes to I2C** → Output box shows address, register, and data written
2. **Script reads from I2C** → Returns bytes from Input box (defaults to `0x00`)
3. **User can modify input** → Type hex bytes to simulate sensor responses

### Python Implementation

```python
class I2C:
    """Simplified I2C mock - just input/output hex values"""

    def __init__(self, id, scl=None, sda=None, freq=400000):
        self.id = id
        self.freq = freq
        self._input_bytes = bytes([0x00])  # Default response
        self._last_write = None

    def scan(self):
        """Return empty list - user adds addresses as needed"""
        return []

    def writeto(self, addr, buf):
        """Log the write, notify webview"""
        self._last_write = {
            'address': hex(addr),
            'data': ' '.join(f'0x{b:02X}' for b in buf)
        }
        # Send to webview for display
        _notify_webview('i2c_write', self._last_write)
        return len(buf)

    def readfrom(self, addr, nbytes):
        """Return input bytes (padded/truncated to nbytes)"""
        result = (self._input_bytes * ((nbytes // len(self._input_bytes)) + 1))[:nbytes]
        return bytes(result)

    def writeto_mem(self, addr, memaddr, buf):
        """Log write with register address"""
        self._last_write = {
            'address': hex(addr),
            'register': hex(memaddr),
            'data': ' '.join(f'0x{b:02X}' for b in buf)
        }
        _notify_webview('i2c_write', self._last_write)

    def readfrom_mem(self, addr, memaddr, nbytes):
        """Return input bytes for register read"""
        self._last_write = {
            'address': hex(addr),
            'register': hex(memaddr),
            'read_bytes': nbytes
        }
        _notify_webview('i2c_read', self._last_write)
        result = (self._input_bytes * ((nbytes // len(self._input_bytes)) + 1))[:nbytes]
        return bytes(result)

    def set_input(self, hex_string):
        """Called from webview when user updates input box"""
        # Parse "0x00 0x01 0xFF" -> bytes([0, 1, 255])
        self._input_bytes = bytes(int(h, 16) for h in hex_string.split())
```

### Why Start Simple?

| Complex Approach                                | Simple Approach               |
| ----------------------------------------------- | ----------------------------- |
| Device-specific simulators (MPU6050, BME280...) | Generic hex input/output      |
| Value → byte conversion logic                   | User provides raw bytes       |
| Slider UIs for each sensor                      | Single text input             |
| Many files to maintain                          | Minimal code                  |
| Bugs in conversion formulas                     | What you type is what you get |

**Future Enhancement**: Once simple I2C works, we can add device presets that auto-populate common byte patterns (e.g., "MPU6050 WHO_AM_I" → sets input to `0x68`).

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

## Extension Folder Structure

All emulator code is **completely separated** from the bridge server:

```
extension/                          # VS Code Extension Root
├── package.json                    # Extension manifest
│
├── bridge/                         # ═══ BRIDGE SERVER (EXISTING) ═══
│   ├── server.js                   # Express + Socket.IO server
│   ├── package.json
│   ├── public/                     # Bridge web UI (browser-based)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── js/
│   └── src/                        # Bridge backend
│       ├── api/
│       ├── services/
│       └── utils/
│
├── emulator/                       # ═══ EMULATOR (NEW - ISOLATED) ═══
│   ├── mock/                       # Python mock modules
│   │   ├── __init__.py
│   │   ├── runner.py               # Entry point - executes user scripts
│   │   ├── state.py                # Global emulator state (pins)
│   │   ├── config.py               # Board selection, settings *(planned)*
│   │   ├── websocket_server.py     # Pushes state to webview *(planned)*
│   │   │
│   │   ├── typings/                # Type stubs for Pylance
│   │   │   ├── machine.pyi
│   │   │   ├── utime.pyi *(planned)*
│   │   │   ├── time.pyi *(planned)*
│   │   │   ├── network.pyi *(planned)*
│   │   │   ├── neopixel.pyi *(planned)*
│   │   │   ├── rp2.pyi *(planned)*
│   │   │   ├── esp.pyi *(planned)*
│   │   │   ├── esp32.pyi *(planned)*
│   │   │   └── micropython.pyi *(planned)*
│   │   │
│   │   └── micropython/            # Runtime mock modules
│   │       ├── __init__.py
│   │       ├── machine.py          # Pin outputs (implemented)
│   │       ├── utime.py
│   │       ├── time.py
│   │       ├── network.py *(planned)*
│   │       ├── neopixel.py *(planned)*
│   │       ├── rp2.py *(planned)*
│   │       └── esp.py *(planned)*
│   │
│   ├── webview/                    # Emulator UI (VS Code webview)
│   │   ├── index.html
│   │   ├── style.css
│   │   └── js/
│   │       ├── main.js
│   │       ├── websocket.js
│   │       ├── board.js            # Board schematic rendering
│   │       ├── i2c-monitor.js      # Simple hex input/output
│   │       ├── console.js
│   │       └── activity-log.js
│   │
│   └── boards/                     # Board definitions
│       ├── __init__.py
│       ├── base.py
│       ├── rpi_pico.py
│       └── esp32.py
│
├── src/                            # Extension TypeScript code
│   ├── extension.ts
│   ├── commands/
│   │   └── index.ts
│   ├── server/                     # Bridge server management
│   │   ├── index.ts
│   │   └── bridgeServer.ts
│   ├── emulator/                   # Emulator management (NEW)
│   │   ├── index.ts
│   │   ├── webviewProvider.ts      # Webview panel management
│   │   ├── launchConfig.ts         # Auto-generate launch.json
│   │   └── pylanceConfig.ts        # Auto-configure Pylance paths
│   ├── views/
│   └── utils/
│
├── media/
│   ├── pinouts/                    # Official pinout reference diagrams
│   │   ├── pico-pinout.svg
│   │   └── esp32-pinout.svg
│   └── icons/
│
└── dist/                           # Compiled extension (webpack output)
```

### Key Separation Points

| Aspect            | Bridge (`extension/bridge/`) | Emulator (`extension/emulator/`) |
| ----------------- | ---------------------------- | -------------------------------- |
| **Purpose**       | Real hardware connection     | Hardware simulation              |
| **UI Runtime**    | Browser (port 3000)          | VS Code Webview panel            |
| **Backend**       | Node.js + Express            | Python                           |
| **Communication** | Socket.IO                    | WebSocket                        |
| **State**         | Real device                  | Simulated                        |
| **TypeScript**    | `src/server/`                | `src/emulator/`                  |

### What Gets Packaged in VSIX

The `.vscodeignore` ensures only necessary files are included:

```
# Include in VSIX:
bridge/**               # Bridge server (existing)
emulator/**             # Emulator modules (new)
media/**                # Pinouts and icons
dist/**                 # Compiled TypeScript

# Exclude from VSIX:
src/**                  # TypeScript source (compiled to dist/)
node_modules/**         # Dev dependencies
*.ts                    # Source files
```

````

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
````

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

### Phase 1: Minimal Viable Emulator (Week 1)

**Goal**: Get a basic emulator running with LED blink working end-to-end.

- [x] Create `extension/emulator/` folder structure (separate from bridge)
- [x] Create `emulator/mock/typings/machine.pyi` stub (Pin, PWM basics)
- [x] Create `emulator/mock/micropython/machine.py` (Pin class with state tracking)
- [x] Create `emulator/mock/micropython/time.py` / `utime.py` (sleep functions)
- [x] Create `emulator/mock/runner.py` - script execution entry point
- [x] Create `emulator/mock/state.py` - global pin state management
- [ ] Create `emulator/mock/websocket_server.py` - push state to webview _(deferred: Phase 1 uses stdout bridge into VS Code)_
- [x] Create minimal `emulator/webview/index.html` with single LED indicator
- [x] Create `src/emulator/webviewProvider.ts` - VS Code webview panel
- [x] Add VS Code launch configuration for Play button _(Dec 11, 2025)_
- [x] **Test**: LED blink script toggles LED in webview _(Dec 11, 2025 - CLI verified)_

### Phase 2: Core Infrastructure (Week 2)

- [x] Complete all `.pyi` stub files for Pylance _(Dec 11, 2025)_
- [x] Configure `pyrightconfig.json` for zero import errors _(Dec 11, 2025)_
- [x] Implement ADC class _(Dec 11, 2025)_
- [x] Implement basic I2C class (simple hex input/output - NO device simulators) _(Dec 11, 2025)_
- [x] Implement SPI class (stub) _(Dec 11, 2025)_
- [x] Implement Timer class _(Dec 11, 2025)_
- [x] Add I2C Monitor panel to webview (input/output hex boxes) _(Dec 11, 2025)_
- [x] Add Console output panel to webview _(Dec 11, 2025)_
- [x] **Test**: All imports resolve without red squiggles _(Dec 11, 2025)_

**Phase 2 Complete!** ✓

### Phase 3: Board Visualization (Week 3)

- [x] Create Pico board schematic SVG _(Dec 11, 2025)_
- [x] Implement pin state visualization (HIGH/LOW/PWM) _(Dec 11, 2025)_
- [x] Add activity log panel _(Dec 11, 2025)_
- [x] Add NeoPixel strip visualization _(Dec 11, 2025)_
- [x] Implement `neopixel.py` module _(Dec 11, 2025)_
- [x] Add board selection dropdown (Pico vs ESP32) _(Dec 11, 2025)_
- [ ] Copy official pinout diagrams to `media/pinouts/`
- [ ] Add "View Pinout" menu option
- [ ] **Test**: Pin activity visible in real-time

### Phase 4: VS Code Integration (Week 4)

- [x] Add "Open Emulator" command to Pico Bridge menu _(Dec 11, 2025)_
- [ ] Auto-configure Pylance on extension activation
- [x] Auto-generate launch.json configuration _(Dec 11, 2025)_
- [x] Implement `rp2.py` module (PIO stubs) _(Dec 11, 2025)_
- [x] Implement `network.py` module (stubs) _(Dec 11, 2025)_
- [ ] Add ESP32 board schematic SVG
- [ ] **Test**: Full workflow from empty project to running emulator

### Phase 5: Polish & Future Prep (Week 5)

- [ ] Error handling and user-friendly messages
- [ ] Documentation and README for emulator
- [ ] Add UART loopback simulation
- [ ] Add RTC class
- [ ] Performance optimization
- [ ] **Test**: Run community MicroPython examples

### Future Phases (After Simple Works)

- [ ] I2C device presets (MPU6050, BME280, etc. with pre-filled hex patterns)
- [ ] SSD1306 display framebuffer rendering
- [ ] Record/replay hardware interactions
- [ ] Multi-board simulation

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

### Phase 1 Success (Minimal Viable)

1. ✅ LED blink script runs in emulator
2. ✅ LED state visible in webview (on/off)
3. ✅ Emulator is in `extension/emulator/` - completely separate from `extension/bridge/`

### Full Success

1. ✅ User writes `import machine` - **no red squiggles**, full IntelliSense
2. ✅ User clicks Play button - emulator runs and webview opens
3. ✅ Pin state changes visible in webview within 100ms
4. ✅ Simple I2C: user types hex in input box, script reads those bytes
5. ✅ Common libraries (machine, time, neopixel) work without modification
6. ✅ "Open Emulator" appears in Pico Bridge menu
7. ✅ Pinout diagram viewable from webview menu
8. ✅ No files in `emulator/` are uploaded to Pico via bridge
9. ✅ Supports both Pico and ESP32 board emulation
10. ✅ Bridge and emulator can run simultaneously without conflicts

---

## Future Enhancements

Once the simple emulator is working well:

- **I2C Device Presets**: Pre-configured byte patterns for common sensors (MPU6050 WHO_AM_I = 0x68, etc.)
- **Sensor Simulators**: Slider UIs for accelerometer, temperature, etc. with value→byte conversion
- **Display Rendering**: Show SSD1306 framebuffer contents as image
- **Record/Replay**: Capture hardware interactions for regression testing
- **Breakpoints**: Pause on pin state changes
- **Logic Analyzer**: Visualize timing of signals
- **Network Simulation**: Fake WiFi with configurable latency/errors
- **File System**: Simulate Pico's flash file system
- **Multi-board**: Run multiple virtual boards simultaneously
- **Import from Real Device**: Read sensor values from connected Pico, replay in mock

---

## References

- [MicroPython Documentation](https://docs.micropython.org/)
- [MicroPython Source - machine module](https://github.com/micropython/micropython/tree/master/ports/rp2/machine)
- [RP2040 Datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- [ESP32 Technical Reference](https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf)
- [Raspberry Pi Pico Pinout](https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf)
- [ESP32 DevKit Pinout](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html)
