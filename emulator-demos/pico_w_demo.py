"""
Raspberry Pi Pico W Demo
========================
Tests emulator features specific to the Pico W with WiFi.
Select "Raspberry Pi Pico W" in the board dropdown before running.

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
# Pico W LED - Uses "LED" identifier (not GP25 like regular Pico)
# =============================================================================

def demo_led_blink():
    """Blink the onboard LED."""
    announce("Pico W LED Blink")
    
    print("  Pico W uses 'LED' identifier for onboard LED")
    print("  (It's connected via the wireless chip)")
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
# Pico W WiFi - Network features
# =============================================================================

def demo_wifi():
    """Test WiFi functionality."""
    announce("Pico W WiFi")
    
    print("  The Pico W has built-in WiFi!")
    
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
    utime.sleep_ms(300)
    wlan.connect("TestNetwork", "password123")
    
    if wlan.isconnected():
        config = wlan.ifconfig()
        print(f"  Connected! IP: {config[0]}")
    
    print("\n  Done!")


# =============================================================================
# Pico W GPIO - Same as regular Pico
# =============================================================================

def demo_gpio():
    """Test GPIO pins."""
    announce("Pico W GPIO Pins")
    
    print("  GPIO works the same as regular Pico")
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
# Pico W I2C
# =============================================================================

def demo_i2c():
    """Scan the I2C bus."""
    announce("Pico W I2C Bus")
    
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
# Pico W ADC
# =============================================================================

def demo_adc():
    """Read ADC values."""
    announce("Pico W ADC")
    
    print("  Reading ADC channels...")
    
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
    print("  📶 RASPBERRY PI PICO W DEMO")
    print("=" * 50)
    print("\n  Make sure 'Raspberry Pi Pico W' is selected!")
    utime.sleep_ms(2000)
    
    demos = [
        demo_led_blink,
        demo_wifi,
        demo_gpio,
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
    print("  🎉 PICO W DEMO COMPLETE!")
    print("=" * 50)
