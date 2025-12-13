# MicroPython Mock Module System

This directory contains the mock implementation of MicroPython modules for the hardware emulator. It allows MicroPython code to run in a standard Python environment while simulating hardware interactions.

## Directory Structure

```
mock/
├── README.md              # This file
├── AUDIT_REPORT.md        # API completeness audit results
├── __init__.py            # Module initialization
├── runner.py              # Script runner with error handling
├── state.py               # Global emulator state management
├── micropython/           # Mock MicroPython modules
│   ├── __init__.py
│   ├── machine.py         # Core hardware: Pin, PWM, ADC, I2C, SPI, UART, Timer
│   ├── micropython.py     # MicroPython-specific functions
│   ├── utime.py           # Time functions (primary implementation)
│   ├── time.py            # Alias for utime
│   ├── gc.py              # Garbage collection
│   ├── network.py         # WLAN networking
│   ├── neopixel.py        # WS2812 LED control
│   ├── rp2.py             # RP2040-specific: PIO, StateMachine
│   └── u*.py              # Legacy u-prefixed modules (re-exports)
└── typings/               # Type stubs for Pylance IntelliSense
    ├── pyrightconfig.json # Pylance configuration
    ├── machine.pyi
    ├── micropython.pyi
    └── *.pyi              # Type stubs for all modules
```

## Architecture

### Event System

All hardware interactions emit events through `state.emit_event()`:

```python
state.emit_event("event_type", {"key": "value"})
```

Events are JSON-serialized with a `__EMU__` prefix for the VS Code extension to parse:

```
__EMU__{"event": "pin_set", "data": {"id": "25", "value": 1}}
```

### State Management

The `state.py` module provides:

- Pin state tracking (`register_pin`, `set_pin_value`, `get_pin_value`)
- ADC simulation (`set_adc_value`, `get_adc_value`)
- I2C device simulation (`register_i2c_device`, `get_i2c_devices`, `get_i2c_response`)
- Event emission (`emit_event`)

### Type Stubs

The `typings/` directory contains `.pyi` files that provide:

- IntelliSense/autocomplete in VS Code
- Type checking via Pylance
- Documentation for API signatures

## Adding New Methods

When MicroPython adds new methods, follow this process:

### 1. Check Official Documentation

- [MicroPython Library Reference](https://docs.micropython.org/en/latest/library/)
- [RP2040 Specifics](https://docs.micropython.org/en/latest/rp2/quickref.html)

### 2. Implement in Mock Module

```python
# micropython/machine.py

def new_method(self, param: int) -> int:
    """Brief description of what this does.

    Args:
        param: Description of parameter

    Returns:
        Description of return value
    """
    state.emit_event("class_method", {"param": param})
    return simulated_result
```

### 3. Update Type Stubs

```python
# typings/machine.pyi

def new_method(self, param: int) -> int: ...
```

### 4. Update Audit Report

Add/update the entry in `AUDIT_REPORT.md`.

## Module Reference

### machine.py - Hardware Peripherals

| Class       | Methods                                                                                                                                                            | Notes                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| **Pin**     | `__init__`, `value`, `on`, `off`, `toggle`, `irq`, `init`, `mode`, `pull`, `drive`, `low`, `high`                                                                  | GPIO control           |
| **PWM**     | `__init__`, `init`, `freq`, `duty_u16`, `duty_ns`, `deinit`                                                                                                        | Pulse width modulation |
| **ADC**     | `__init__`, `read_u16`, `read`, `read_uv`, `set_simulated_value`                                                                                                   | Analog input           |
| **I2C**     | `__init__`, `scan`, `register_device`, `writeto`, `readfrom`, `writeto_mem`, `readfrom_mem`, `readfrom_mem_into`, `start`, `stop`, `readinto`, `write`, `writevto` | I2C bus                |
| **SoftI2C** | Inherits from I2C                                                                                                                                                  | Software I2C           |
| **SPI**     | `__init__`, `init`, `deinit`, `read`, `readinto`, `write`, `write_readinto`                                                                                        | SPI bus                |
| **SoftSPI** | Inherits from SPI                                                                                                                                                  | Software SPI           |
| **Timer**   | `__init__`, `init`, `deinit`, `value`                                                                                                                              | Hardware timers        |
| **UART**    | `__init__`, `init`, `deinit`, `any`, `read`, `readinto`, `readline`, `write`, `sendbreak`, `txdone`, `flush`                                                       | Serial UART            |
| **WDT**     | `__init__`, `feed`                                                                                                                                                 | Watchdog timer         |
| **RTC**     | `__init__`, `init`, `datetime`, `alarm`, `alarm_left`, `cancel`, `irq`                                                                                             | Real-time clock        |

**Module Functions:** `reset`, `soft_reset`, `freq`, `unique_id`, `idle`, `lightsleep`, `deepsleep`, `disable_irq`, `enable_irq`, `bootloader`, `time_pulse_us`, `bitstream`

**Memory Access:** `mem8`, `mem16`, `mem32` (subscriptable)

### utime.py - Time Functions

| Function                     | Notes                        |
| ---------------------------- | ---------------------------- |
| `sleep(s)`                   | Sleep for seconds            |
| `sleep_ms(ms)`               | Sleep for milliseconds       |
| `sleep_us(us)`               | Sleep for microseconds       |
| `ticks_ms()`                 | Millisecond counter          |
| `ticks_us()`                 | Microsecond counter          |
| `ticks_cpu()`                | CPU ticks counter            |
| `ticks_add(ticks, delta)`    | Add to tick value            |
| `ticks_diff(ticks1, ticks2)` | Difference between ticks     |
| `time()`                     | Unix timestamp (seconds)     |
| `time_ns()`                  | Unix timestamp (nanoseconds) |
| `localtime([secs])`          | Local time tuple             |
| `gmtime([secs])`             | UTC time tuple               |
| `mktime(tuple)`              | Tuple to timestamp           |

### rp2.py - RP2040 Specific

| Item               | Type      | Notes                  |
| ------------------ | --------- | ---------------------- |
| `PIO`              | class     | PIO peripheral control |
| `StateMachine`     | class     | PIO state machine      |
| `asm_pio`          | decorator | PIO assembly programs  |
| `Flash`            | class     | Internal flash access  |
| `DMA`              | class     | DMA controller         |
| `bootsel_button()` | function  | BOOTSEL button state   |

### micropython.py - MicroPython Specific

| Function                              | Notes                    |
| ------------------------------------- | ------------------------ |
| `const(val)`                          | Constant optimization    |
| `native`                              | Native code decorator    |
| `viper`                               | Viper compiler decorator |
| `alloc_emergency_exception_buf(size)` | Emergency buffer         |
| `opt_level([level])`                  | Optimization level       |
| `mem_info([verbose])`                 | Memory info              |
| `qstr_info([verbose])`                | String info              |
| `stack_use()`                         | Stack usage              |
| `heap_lock()`                         | Lock heap                |
| `heap_unlock()`                       | Unlock heap              |
| `kbd_intr(chr)`                       | Keyboard interrupt char  |
| `schedule(func, arg)`                 | Schedule function        |

## Testing Changes

After making changes:

1. **Compile Extension**

   ```bash
   cd .extension && npm run compile
   ```

2. **Run Emulator Demo**

   ```bash
   # Use VS Code command: "Pico Bridge: Run in Emulator"
   # With py_scripts/emulator_demo.py
   ```

3. **Check for Errors**
   ```bash
   cd .extension && npm run lint
   ```

## Common Patterns

### Simulating Hardware State

For hardware that needs to return simulated values:

```python
# Check if webview has set a value
sim_value = state.get_some_value(self._id)
if sim_value is not None:
    return sim_value

# Otherwise return reasonable default
return default_value
```

### Preventing Infinite Loops

Common patterns that cause infinite loops need default responses:

```python
# Bad: while not i2c.scan(): pass
# Solution: scan() returns default devices by default

def scan(self) -> list[int]:
    devices = state.get_i2c_devices(self._id)
    if not devices:
        devices = [0x27, 0x3C, 0x68, 0x76]  # Default devices
    return devices
```

### UART Loopback

UART has loopback enabled by default for testing:

```python
class UART:
    _loopback_enabled = True  # Data written appears in RX buffer
```

## Versioning

Track MicroPython version compatibility in the module docstrings:

```python
"""MicroPython machine module emulator.

Compatible with: MicroPython v1.20+ (RP2040)
Last API audit: December 2025
"""
```

## Resources

- [MicroPython Documentation](https://docs.micropython.org/)
- [MicroPython GitHub](https://github.com/micropython/micropython)
- [RP2040 Datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
