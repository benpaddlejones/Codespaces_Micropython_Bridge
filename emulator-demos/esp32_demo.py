"""
ESP32 DevKit Demo
=================
Tests emulator features specific to the ESP32.
Select "ESP32 DevKit" in the board dropdown before running.

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
# ESP32 LED - GPIO2 is typically the onboard LED
# =============================================================================

def demo_led_blink():
    """Blink the onboard LED on GPIO2."""
    announce("ESP32 LED Blink (GPIO2)")
    
    print("  ESP32 DevKit typically has LED on GPIO2")
    print("  Watch it blink 5 times...")
    
    led = Pin(2, Pin.OUT)
    
    for i in range(5):
        print(f"    Blink {i+1}/5")
        led.on()
        utime.sleep_ms(300)
        led.off()
        utime.sleep_ms(300)
    
    print("  Done!")


# =============================================================================
# ESP32 PWM - Multiple channels available
# =============================================================================

def demo_pwm():
    """PWM on multiple pins."""
    announce("ESP32 PWM")
    
    print("  ESP32 has 16 PWM channels!")
    print("  Testing PWM on GPIO2...")
    
    pwm = PWM(Pin(2))
    pwm.freq(5000)  # ESP32 supports higher frequencies
    
    print("  Fading up...")
    for duty in range(0, 1024, 128):
        pwm.duty(duty)  # ESP32 uses 10-bit duty (0-1023)
        utime.sleep_ms(100)
    
    print("  Fading down...")
    for duty in range(1023, 0, -128):
        pwm.duty(duty)
        utime.sleep_ms(100)
    
    pwm.deinit()
    print("  Done!")


# =============================================================================
# ESP32 GPIO - More pins available
# =============================================================================

def demo_gpio():
    """Test ESP32 GPIO pins."""
    announce("ESP32 GPIO Pins")
    
    print("  ESP32 has many GPIO pins!")
    print("  Testing GPIO 4, 5, 12, 13, 14, 15...")
    
    pin_nums = [4, 5, 12, 13, 14, 15]
    pins = [Pin(i, Pin.OUT) for i in pin_nums]
    
    for i, pin in enumerate(pins):
        print(f"    GPIO{pin_nums[i]} ON")
        pin.on()
        utime.sleep_ms(150)
    
    utime.sleep_ms(300)
    
    for i, pin in enumerate(reversed(pins)):
        idx = len(pins) - 1 - i
        print(f"    GPIO{pin_nums[idx]} OFF")
        pin.off()
        utime.sleep_ms(150)
    
    print("  Done!")


# =============================================================================
# ESP32 WiFi - Built-in WiFi
# =============================================================================

def demo_wifi():
    """Test WiFi functionality."""
    announce("ESP32 WiFi")
    
    print("  ESP32 has built-in WiFi!")
    
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
# ESP32 I2C - Two I2C buses
# =============================================================================

def demo_i2c():
    """Scan both I2C buses."""
    announce("ESP32 I2C Buses")
    
    print("  ESP32 has 2 hardware I2C buses")
    
    # I2C bus 0
    print("\n  I2C0 (SDA=21, SCL=22):")
    i2c0 = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
    devices0 = i2c0.scan()
    
    if devices0:
        for addr in devices0:
            print(f"    0x{addr:02X}")
    else:
        print("    No devices")
    
    # I2C bus 1
    print("\n  I2C1 (SDA=25, SCL=26):")
    i2c1 = I2C(1, scl=Pin(26), sda=Pin(25), freq=400000)
    devices1 = i2c1.scan()
    
    if devices1:
        for addr in devices1:
            print(f"    0x{addr:02X}")
    else:
        print("    No devices")
    
    print("\n  Done!")


# =============================================================================
# ESP32 ADC - Two ADC units
# =============================================================================

def demo_adc():
    """Read ESP32 ADC channels."""
    announce("ESP32 ADC")
    
    print("  ESP32 has ADC1 (GPIO32-39) and ADC2 (GPIO0-15)")
    print("  Note: ADC2 unavailable when WiFi is active")
    
    # ADC1 channels
    channels = [
        ("GPIO32 (ADC1_4)", ADC(Pin(32))),
        ("GPIO33 (ADC1_5)", ADC(Pin(33))),
        ("GPIO34 (ADC1_6)", ADC(Pin(34))),
        ("GPIO35 (ADC1_7)", ADC(Pin(35))),
    ]
    
    for _ in range(3):
        print()
        for name, adc in channels:
            raw = adc.read()  # ESP32 uses 12-bit ADC (0-4095)
            voltage = raw * 3.3 / 4095
            print(f"    {name}: {voltage:.2f}V")
        utime.sleep_ms(500)
    
    print("\n  Done!")


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  ⚡ ESP32 DEVKIT DEMO")
    print("=" * 50)
    print("\n  Make sure 'ESP32 DevKit' is selected!")
    utime.sleep_ms(2000)
    
    demos = [
        demo_led_blink,
        demo_pwm,
        demo_gpio,
        demo_wifi,
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
    print("  🎉 ESP32 DEMO COMPLETE!")
    print("=" * 50)
