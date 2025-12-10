# Connect Your Pico

The bridge interface opens in your browser where you can connect your Raspberry Pi Pico or ESP32.

## Prerequisites

- **Chrome or Edge browser** - Web Serial API is required
- **Pico with MicroPython** - Flash MicroPython firmware first
- **USB connection** - Connect your Pico to your computer

## Connecting

1. Click **Connect** in the browser interface
2. A dialog will appear listing available serial ports
3. Select your Pico (usually shows as "Raspberry Pi Pico")
4. Click **Connect**

## Troubleshooting

- **No ports listed?** Make sure your Pico is plugged in
- **Permission denied?** You may need to add your user to the `dialout` group on Linux
- **Wrong browser?** Firefox and Safari don't support Web Serial API
