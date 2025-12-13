"""
Raspberry Pi Pico Demo
======================
Tests emulator features specific to the Raspberry Pi Pico.
Select "Raspberry Pi Pico" in the board dropdown before running.

Run via VS Code: Right-click -> "Run in MicroPython Emulator"
"""

import utime
from machine import Pin, PWM, ADC, I2C, Timer, RTC, UART


def announce(title: str) -> None:
    """Print demo section header."""
    print("\n" + "=" * 50)
    print(f"  {title}")
    print("=" * 50)
    utime.sleep_ms(300)


# =============================================================================
# Pico LED Blink - GP25 is the onboard LED
# =============================================================================

def demo_led_blink():
    """Blink the onboard LED on GP25."""
    announce("Pico LED Blink (GP25)")
    
    print("  The Pico has an onboard LED on GP25")
    print("  Watch it blink 5 times...")
    
    led = Pin(25, Pin.OUT)
    
    for i in range(5):
        print(f"    Blink {i+1}/5")
        led.on()
        utime.sleep_ms(300)
        led.off()
        utime.sleep_ms(300)
    
    print("  Done!")


# =============================================================================
# Pico PWM - Fade the LED
# =============================================================================

def demo_pwm():
    """PWM fade on the onboard LED."""
    announce("Pico PWM Fade (GP25)")
    
    print("  Fading LED brightness using PWM...")
    
    pwm = PWM(Pin(25))
    pwm.freq(1000)
    
    # Fade up
    print("  Fading up...")
    for duty in range(0, 65535, 8192):
        pwm.duty_u16(duty)
        utime.sleep_ms(100)
    
    # Fade down
    print("  Fading down...")
    for duty in range(65535, 0, -8192):
        pwm.duty_u16(duty)
        utime.sleep_ms(100)
    
    pwm.deinit()
    print("  Done!")


# =============================================================================
# Pico GPIO - Multiple pins
# =============================================================================

def demo_gpio():
    """Test multiple GPIO pins."""
    announce("Pico GPIO Pins (GP2-GP8)")
    
    print("  Toggling pins GP2 through GP8...")
    
    pins = [Pin(i, Pin.OUT) for i in range(2, 9)]
    
    # Light up sequentially
    for i, pin in enumerate(pins):
        print(f"    GP{i+2} ON")
        pin.on()
        utime.sleep_ms(150)
    
    utime.sleep_ms(300)
    
    # Turn off in reverse
    for i, pin in enumerate(reversed(pins)):
        print(f"    GP{8-i} OFF")
        pin.off()
        utime.sleep_ms(150)
    
    print("  Done!")


# =============================================================================
# Pico ADC - Read analog values
# =============================================================================

def demo_adc():
    """Read from ADC channels."""
    announce("Pico ADC Channels")
    
    print("  Pico has 3 ADC pins (GP26-28) + internal temp sensor")
    
    channels = [
        ("GP26 (ADC0)", ADC(26)),
        ("GP27 (ADC1)", ADC(27)),
        ("GP28 (ADC2)", ADC(28)),
        ("Internal Temp", ADC(4)),
    ]
    
    for _ in range(3):
        print()
        for name, adc in channels:
            raw = adc.read_u16()
            voltage = raw * 3.3 / 65535
            print(f"    {name}: {voltage:.2f}V")
            utime.sleep_ms(100)
        utime.sleep_ms(400)
    
    print("\n  Done!")


# =============================================================================
# Pico I2C - Bus scan
# =============================================================================

def demo_i2c():
    """Scan the I2C bus."""
    announce("Pico I2C Bus (I2C0)")
    
    print("  Default I2C0 pins: SDA=GP0, SCL=GP1")
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    print("  Scanning for devices...")
    utime.sleep_ms(300)
    
    devices = i2c.scan()
    
    if devices:
        print(f"\n  Found {len(devices)} device(s):")
        for addr in devices:
            print(f"    0x{addr:02X}")
    else:
        print("  No devices found")
    
    print("\n  Done!")


# =============================================================================
# Pico UART - Serial communication
# =============================================================================

def demo_uart():
    """Test UART serial communication."""
    announce("Pico UART (UART0)")
    
    print("  UART0 pins: TX=GP0, RX=GP1")
    print("  Loopback mode enabled (TX echoes to RX)")
    
    uart = UART(0, baudrate=115200, tx=Pin(0), rx=Pin(1))
    
    # Write some test data
    print("\n  Sending test messages...")
    
    for i in range(5):
        msg = f"Hello {i+1}\n"
        uart.write(msg.encode())
        print(f"    TX: {msg.strip()}")
        utime.sleep_ms(200)
    
    # Read back (loopback mode)
    print("\n  Reading loopback data...")
    data = uart.read()
    if data:
        print(f"    RX: {data.decode().strip()}")
    
    print("\n  Done!")


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  🍓 RASPBERRY PI PICO DEMO")
    print("=" * 50)
    print("\n  Make sure 'Raspberry Pi Pico' is selected!")
    utime.sleep_ms(2000)
    
    demos = [
        demo_led_blink,
        demo_pwm,
        demo_gpio,
        demo_adc,
        demo_i2c,
        demo_uart,
    ]
    
    for demo in demos:
        try:
            demo()
            utime.sleep_ms(1000)
        except Exception as e:
            print(f"  Error: {e}")
    
    print("\n" + "=" * 50)
    print("  🎉 PICO DEMO COMPLETE!")
    print("=" * 50)
