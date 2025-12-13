# Emulator Demo Scripts

This folder contains board-specific demo scripts for testing the MicroPython emulator.

## How to Run

1. Open any demo file in VS Code
2. Select the matching board from the dropdown in the emulator panel
3. Right-click the file and select "Run in MicroPython Emulator"

## Demo Files

| File             | Board                 | Description                                            |
| ---------------- | --------------------- | ------------------------------------------------------ |
| `pico_demo.py`   | Raspberry Pi Pico     | Tests LED (GP25), PWM, GPIO, ADC, I2C, NeoPixel        |
| `pico_w_demo.py` | Raspberry Pi Pico W   | Tests LED, WiFi, GPIO, I2C, ADC                        |
| `pico2w_demo.py` | Raspberry Pi Pico 2 W | Tests LED, WiFi, GPIO, PWM, I2C, ADC, NeoPixel         |
| `esp32_demo.py`  | ESP32 DevKit          | Tests LED (GPIO2), PWM, GPIO, WiFi, I2C, ADC, NeoPixel |

## Board Differences

### Raspberry Pi Pico

- Onboard LED on GP25
- Uses `Pin(25, Pin.OUT)` for LED

### Raspberry Pi Pico W / Pico 2 W

- Onboard LED connected through wireless chip
- Uses `Pin("LED", Pin.OUT)` for LED
- Built-in WiFi support

### ESP32 DevKit

- Onboard LED typically on GPIO2
- Two I2C hardware buses
- 16 PWM channels
- ADC1 (GPIO32-39) and ADC2 (GPIO0-15)
