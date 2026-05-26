"""
Basic blink program - Debugpy Friendly Version

This script demonstrates:
- The classic while True pattern used in microcontrollers
- Toggling the LED state
- Using variables you can watch in the debugger

TIP: Set a breakpoint on the 'pin.toggle()' line to step through each blink!
     Change MAX_BLINKS to 0 for infinite loop (real microcontroller behavior)
"""

from machine import Pin
from utime import sleep

# Initialize the onboard LED
pin = Pin("LED", Pin.OUT)

# Track state for debugging - watch these variables!
blink_count = 0
led_state = False
MAX_BLINKS = 10  # Set to 0 for infinite loop (microcontroller style)

print(f"Starting blink demo" + (f" - will blink {MAX_BLINKS} times" if MAX_BLINKS else " - infinite loop (Ctrl+C to stop)"))

# Classic microcontroller pattern: while True
while True:
    blink_count += 1
    
    pin.toggle()  # <-- Good place for a breakpoint!
    led_state = bool(pin.value())
    
    status = "ON" if led_state else "OFF"
    print(f"Blink {blink_count}: LED is {status}")
    
    sleep(0.5)  # Half second delay
    
    # Break after MAX_BLINKS if set (0 = infinite)
    if MAX_BLINKS and blink_count >= MAX_BLINKS:
        break

# Cleanup - turn LED off
pin.off()
print("Demo complete! LED turned off.")
