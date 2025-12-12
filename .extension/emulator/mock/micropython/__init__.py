"""MicroPython compatibility layer for emulator.

This package provides mock implementations of MicroPython modules
for running MicroPython code in a standard Python environment.

Available modules:
- machine: GPIO, PWM, ADC, I2C, SPI, Timer, UART
- utime/time: Time functions
- network: WiFi/LAN connectivity
- neopixel: NeoPixel LED control
- rp2: RP2040-specific (PIO, StateMachine)
- gc: Garbage collection
- micropython: MicroPython-specific functions
- uctypes: Low-level C-style type access
- ubinascii: Binary/ASCII conversions
- ujson: JSON encoding/decoding
- ure: Regular expressions
- uzlib: Zlib decompression
- usocket: Socket networking
- uselect: I/O polling
- ustruct: Binary structure packing
- uhashlib: Cryptographic hashing
- ucollections: Collection types
- uio: I/O streams
- uos: Operating system interface
"""

__version__ = "1.1.0"
