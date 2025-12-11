"""
PWM LED Fade - Common MicroPython pattern for LED breathing effect
Tests PWM, Pin, and timing functionality
"""
from machine import Pin, PWM
import utime

# Setup PWM on the built-in LED (GPIO 25 on Pico)
led = PWM(Pin(25))
led.freq(1000)

print("=== PWM LED Fade Test ===")
print(f"PWM Frequency: {led.freq()} Hz")
print()

# Fade up and down 3 times
for cycle in range(3):
    print(f"Cycle {cycle + 1}:")
    
    # Fade up
    print("  Fading up...", end="")
    for duty in range(0, 65536, 8192):
        led.duty_u16(duty)
        utime.sleep_ms(50)
    print(f" duty={led.duty_u16()}")
    
    # Fade down
    print("  Fading down...", end="")
    for duty in range(65535, -1, -8192):
        led.duty_u16(duty)
        utime.sleep_ms(50)
    print(f" duty={led.duty_u16()}")

# Cleanup
led.deinit()
print()
print("=== PWM Test Complete ===")
