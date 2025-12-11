"""
UART Loopback Test - Tests the emulator's UART loopback feature
"""
from machine import UART, Pin

# Enable global loopback mode (TX data goes to RX buffer)
UART.enable_loopback(True)

# Create UART instance
uart = UART(0, baudrate=115200, tx=Pin(0), rx=Pin(1))

# Test basic write/read
print("=== UART Loopback Test ===")
print()

# Test 1: Simple string
test_data = b"Hello MicroPython!"
uart.write(test_data)
received = uart.read()
print(f"Sent:     {test_data}")
print(f"Received: {received}")
print(f"Match:    {test_data == received}")
print()

# Test 2: Binary data
binary_data = bytes([0x00, 0x55, 0xAA, 0xFF])
uart.write(binary_data)
received = uart.read()
print(f"Binary sent:     {binary_data.hex()}")
print(f"Binary received: {received.hex() if received else 'None'}")
print(f"Match:           {binary_data == received}")
print()

# Test 3: Multiple writes before read
uart.write(b"Part1-")
uart.write(b"Part2-")
uart.write(b"Part3")
received = uart.read()
print(f"Multi-write received: {received}")
print()

# Test 4: Check any() for bytes available
uart.write(b"test")
print(f"Bytes available: {uart.any()}")
uart.read()  # Clear buffer
print(f"After read: {uart.any()}")
print()

print("=== UART Test Complete ===")
