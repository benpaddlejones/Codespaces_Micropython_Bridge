"""
Raspberry Pi Pico 2 W Demo
==========================
Tests emulator features specific to the Pico 2 W (RP2350).
Select "Raspberry Pi Pico 2 W" in the board dropdown before running.

Run via VS Code: Right-click -> "Run in MicroPython Emulator"
"""

import utime
from machine import Pin, PWM, ADC, I2C


def announce(title: str) -> None:
    """Print demo section header."""
    print("\n" + "=" * 50)
    print(f"  {title}")
    print("=" * 50)
    utime.sleep_ms(300)


# =============================================================================
# Pico 2 W LED
# =============================================================================

def demo_led_blink():
    """Blink the onboard LED."""
    announce("Pico 2 W LED Blink")
    
    print("  Pico 2 W uses 'LED' identifier")
    print("  Based on RP2350 chip with improved performance")
    print("  Watch it blink 5 times...")
    
    led = Pin("LED", Pin.OUT)
    
    for i in range(5):
        print(f"    Blink {i+1}/5")
        led.on()
        utime.sleep_ms(300)
        led.off()
        utime.sleep_ms(300)
    
    print("  Done!")


# =============================================================================
# Pico 2 W WiFi
# =============================================================================

def demo_wifi():
    """Test WiFi functionality."""
    announce("Pico 2 W WiFi")
    
    print("  Pico 2 W has improved WiFi!")
    
    import network
    
    wlan = network.WLAN(network.STA_IF)
    
    print("\n  Activating WiFi...")
    wlan.active(True)
    utime.sleep_ms(300)
    
    print("  Scanning for networks...")
    networks = wlan.scan()
    
    print(f"\n  Found {len(networks)} network(s):")
    for net in networks[:5]:
        ssid = net[0].decode() if isinstance(net[0], bytes) else net[0]
        print(f"    📶 {ssid}")
        utime.sleep_ms(150)
    
    print("\n  Connecting to 'TestNetwork'...")
    wlan.connect("TestNetwork", "password123")
    
    if wlan.isconnected():
        config = wlan.ifconfig()
        print(f"  Connected! IP: {config[0]}")
    
    print("\n  Done!")


# =============================================================================
# Pico 2 W GPIO
# =============================================================================

def demo_gpio():
    """Test GPIO pins."""
    announce("Pico 2 W GPIO Pins")
    
    print("  RP2350 has enhanced GPIO features")
    print("  Testing GP2-GP8...")
    
    pins = [Pin(i, Pin.OUT) for i in range(2, 9)]
    
    for i, pin in enumerate(pins):
        print(f"    GP{i+2} ON")
        pin.on()
        utime.sleep_ms(150)
    
    utime.sleep_ms(300)
    
    for i, pin in enumerate(reversed(pins)):
        print(f"    GP{8-i} OFF")
        pin.off()
        utime.sleep_ms(150)
    
    print("  Done!")


# =============================================================================
# Pico 2 W Digital Input - Read pin states
# =============================================================================

def demo_digital_read():
    """Read digital input pins with various pull configurations."""
    announce("Pico 2 W Digital Input (GP10-GP15)")
    
    print("  Testing all digital input modes:")
    print("  - Pin.IN: Floating input (no pull resistor)")
    print("  - Pin.PULL_UP: Input with internal pull-up")
    print("  - Pin.PULL_DOWN: Input with internal pull-down")
    print()
    
    # Create pins with different configurations
    input_pins = [
        ("GP10 (IN)", Pin(10, Pin.IN)),
        ("GP11 (PULL_UP)", Pin(11, Pin.IN, Pin.PULL_UP)),
        ("GP12 (PULL_DOWN)", Pin(12, Pin.IN, Pin.PULL_DOWN)),
        ("GP13 (IN)", Pin(13, Pin.IN)),
        ("GP14 (PULL_UP)", Pin(14, Pin.IN, Pin.PULL_UP)),
        ("GP15 (PULL_DOWN)", Pin(15, Pin.IN, Pin.PULL_DOWN)),
    ]
    
    # Read each pin multiple times to show flash animation
    for cycle in range(3):
        print(f"  Read cycle {cycle + 1}/3:")
        for name, pin in input_pins:
            value = pin.value()
            state = "HIGH" if value else "LOW"
            print(f"    {name}: {state}")
            utime.sleep_ms(150)
        utime.sleep_ms(500)
    
    print("\n  Done!")


# =============================================================================
# Pico 2 W PWM
# =============================================================================

def demo_pwm():
    """Test PWM functionality."""
    announce("Pico 2 W PWM")
    
    print("  Testing PWM on LED pin...")
    
    pwm = PWM(Pin("LED"))
    pwm.freq(1000)
    
    print("  Fading up...")
    for duty in range(0, 65535, 8192):
        pwm.duty_u16(duty)
        utime.sleep_ms(100)
    
    print("  Fading down...")
    for duty in range(65535, 0, -8192):
        pwm.duty_u16(duty)
        utime.sleep_ms(100)
    
    pwm.deinit()
    print("  Done!")


# =============================================================================
# Pico 2 W I2C
# =============================================================================

def demo_i2c():
    """Scan the I2C bus."""
    announce("Pico 2 W I2C Bus")
    
    print("  I2C0: SDA=GP0, SCL=GP1")
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    print("  Scanning...")
    devices = i2c.scan()
    
    if devices:
        print(f"\n  Found {len(devices)} device(s):")
        for addr in devices:
            print(f"    0x{addr:02X}")
    else:
        print("  No devices found")
    
    print("\n  Done!")


# =============================================================================
# Pico 2 W ADC
# =============================================================================

def demo_adc():
    """Read ADC values."""
    announce("Pico 2 W ADC")
    
    print("  RP2350 has improved ADC accuracy")
    
    channels = [
        ("GP26", ADC(26)),
        ("GP27", ADC(27)),
        ("GP28", ADC(28)),
        ("Temp", ADC(4)),
    ]
    
    for _ in range(3):
        print()
        for name, adc in channels:
            raw = adc.read_u16()
            voltage = raw * 3.3 / 65535
            print(f"    {name}: {voltage:.2f}V")
        utime.sleep_ms(500)
    
    print("\n  Done!")


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  🍓 RASPBERRY PI PICO 2 W DEMO")
    print("=" * 50)
    print("\n  Make sure 'Raspberry Pi Pico 2 W' is selected!")
    utime.sleep_ms(2000)
    
    demos = [
        demo_led_blink,
        demo_wifi,
        demo_gpio,
        demo_digital_read,
        demo_pwm,
        demo_i2c,
        demo_adc,
    ]
    
    for demo in demos:
        try:
            demo()
            utime.sleep_ms(1000)
        except Exception as e:
            print(f"  Error: {e}")
    
    print("\n" + "=" * 50)
    print("  🎉 PICO 2 W DEMO COMPLETE!")
    print("=" * 50)
