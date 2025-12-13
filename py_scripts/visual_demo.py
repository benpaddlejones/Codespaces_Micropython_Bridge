"""
Visual Emulator Demo
====================
This script demonstrates emulator features with VISIBLE delays.
Run via VS Code: Right-click -> "Run in MicroPython Emulator"

Each demo pauses so you can see the changes in the webview panel.
"""

import utime

# Delay between demos (milliseconds)
DEMO_PAUSE_MS = 2000  # 2 seconds between demos
STEP_DELAY_MS = 200   # 200ms between steps within a demo


def announce(title: str) -> None:
    """Print demo section header."""
    print("\n" + "=" * 50)
    print(f"  DEMO: {title}")
    print("=" * 50)
    utime.sleep_ms(500)


def pause(msg: str = "") -> None:
    """Pause for visual observation."""
    if msg:
        print(f"  >> {msg}")
    utime.sleep_ms(STEP_DELAY_MS)


def demo_pause() -> None:
    """Longer pause between demos."""
    print("\n  [Pausing for observation...]")
    utime.sleep_ms(DEMO_PAUSE_MS)


# =============================================================================
# DEMO 1: LED Blink - Watch Pin 25 toggle on/off
# =============================================================================

def demo_led_blink():
    """Watch the onboard LED blink on and off."""
    announce("LED Blink (Pin 25)")
    
    print("  EXPECT: Onboard LED will blink 5 times")
    print("          (~5 seconds total)")
    
    from machine import Pin
    led = Pin(25, Pin.OUT)
    
    print("\n  Watch Pin 25 toggle HIGH/LOW in the board view...")
    
    for i in range(5):
        pause(f"LED ON  (cycle {i+1}/5)")
        led.on()
        utime.sleep_ms(500)
        
        pause(f"LED OFF (cycle {i+1}/5)")
        led.off()
        utime.sleep_ms(500)
    
    print("  ✓ LED blink complete")
    demo_pause()


# =============================================================================
# DEMO 2: PWM Fade - Watch duty cycle change gradually
# =============================================================================

def demo_pwm_fade():
    """Watch the PWM duty cycle smoothly fade up and down."""
    announce("PWM LED Fade (Pin 25)")
    
    print("  EXPECT: Pin 25 shows ORANGE (PWM mode)")
    print("          Duty cycle fades up then down")
    print("          (~6 seconds total)")
    
    from machine import Pin, PWM
    
    pwm = PWM(Pin(25))
    pwm.freq(1000)
    
    print("\n  Watch the PWM duty value increase then decrease...")
    
    # Fade up (visible steps)
    print("\n  Fading UP...")
    for duty in range(0, 65535, 8192):
        pwm.duty_u16(duty)
        percent = (duty / 65535) * 100
        print(f"    Duty: {duty:5d} ({percent:5.1f}%)")
        utime.sleep_ms(300)
    
    pwm.duty_u16(65535)
    print(f"    Duty: 65535 (100.0%)")
    utime.sleep_ms(500)
    
    # Fade down
    print("\n  Fading DOWN...")
    for duty in range(65535, 0, -8192):
        pwm.duty_u16(duty)
        percent = (duty / 65535) * 100
        print(f"    Duty: {duty:5d} ({percent:5.1f}%)")
        utime.sleep_ms(300)
    
    pwm.duty_u16(0)
    print(f"    Duty:     0 (  0.0%)")
    
    pwm.deinit()
    print("\n  ✓ PWM fade complete")
    demo_pause()


# =============================================================================
# DEMO 3: Multiple Pins - Watch several pins toggle
# =============================================================================

def demo_multiple_pins():
    """Watch multiple GPIO pins toggle in sequence."""
    announce("Multiple GPIO Pins")
    
    print("  EXPECT: Pins GP2-GP8 light up GREEN one by one")
    print("          then turn off in reverse order")
    print("          (~4 seconds total)")
    
    from machine import Pin
    
    pins = [Pin(i, Pin.OUT) for i in [2, 3, 4, 5, 6, 7, 8]]
    
    print(f"\n  Created {len(pins)} output pins (GP2-GP8)")
    print("  Watch them light up in sequence...")
    
    # Light up one by one
    for i, pin in enumerate(pins):
        pause(f"Pin GP{i+2} ON")
        pin.on()
        utime.sleep_ms(200)
    
    utime.sleep_ms(500)
    
    # Turn off one by one
    for i, pin in enumerate(reversed(pins)):
        pause(f"Pin GP{8-i} OFF")
        pin.off()
        utime.sleep_ms(200)
    
    print("\n  ✓ Multiple pins demo complete")
    demo_pause()


# =============================================================================
# DEMO 4: NeoPixel Rainbow - Watch colors animate
# =============================================================================

def demo_neopixel():
    """Watch NeoPixel strip display rainbow colors."""
    announce("NeoPixel Rainbow (8 LEDs on Pin 16)")
    
    print("  EXPECT: NeoPixel strip appears below board")
    print("          8 LEDs cycle through rainbow colors")
    print("          (~4 seconds total)")
    
    from neopixel import NeoPixel
    from machine import Pin
    
    NUM_LEDS = 8
    np = NeoPixel(Pin(16), NUM_LEDS)
    
    def wheel(pos):
        """Generate rainbow colors."""
        if pos < 85:
            return (pos * 3, 255 - pos * 3, 0)
        elif pos < 170:
            pos -= 85
            return (255 - pos * 3, 0, pos * 3)
        else:
            pos -= 170
            return (0, pos * 3, 255 - pos * 3)
    
    print("\n  Watch the NeoPixel panel show rainbow animation...")
    
    # Rainbow cycles with visible steps
    for cycle in range(8):
        print(f"\n  Rainbow cycle {cycle + 1}/8")
        for i in range(NUM_LEDS):
            pixel_index = (i * 256 // NUM_LEDS + cycle * 32) % 256
            color = wheel(pixel_index)
            np[i] = color
        
        # Print pixel colors
        colors = [f"#{np[i][0]:02x}{np[i][1]:02x}{np[i][2]:02x}" for i in range(NUM_LEDS)]
        print(f"    Colors: {' '.join(colors)}")
        
        np.write()
        utime.sleep_ms(400)
    
    # Clear with visible fade
    print("\n  Clearing strip...")
    np.fill((0, 0, 0))
    np.write()
    
    print("\n  ✓ NeoPixel demo complete")
    demo_pause()


# =============================================================================
# DEMO 5: I2C Scan - Watch device discovery
# =============================================================================

def demo_i2c():
    """Watch I2C bus scan for devices."""
    announce("I2C Bus Scan")
    
    print("  EXPECT: I2C Monitor panel shows scan results")
    print("          Discovered devices listed by address")
    print("          (~3 seconds total)")
    
    from machine import Pin, I2C
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    print("\n  Scanning I2C bus for devices...")
    utime.sleep_ms(500)
    
    devices = i2c.scan()
    
    print(f"\n  Found {len(devices)} device(s):")
    for addr in devices:
        device_name = {
            0x68: "MPU6050 (Accelerometer)",
            0x3C: "SSD1306 (OLED Display)",
            0x76: "BME280 (Temp/Humidity)",
            0x27: "LCD I2C Adapter",
        }.get(addr, "Unknown")
        print(f"    0x{addr:02X} - {device_name}")
        utime.sleep_ms(300)
    
    print("\n  ✓ I2C scan complete")
    demo_pause()


# =============================================================================
# DEMO 6: ADC Readings - Watch analog values
# =============================================================================

def demo_adc():
    """Watch ADC readings from multiple channels."""
    announce("ADC Readings (4 channels)")
    
    print("  EXPECT: Console shows voltage readings")
    print("          with bar graphs for 4 ADC channels")
    print("          (~4 seconds total)")
    
    from machine import ADC
    
    channels = [
        ("GP26 (ADC0)", ADC(26)),
        ("GP27 (ADC1)", ADC(27)),
        ("GP28 (ADC2)", ADC(28)),
        ("Temp Sensor", ADC(4)),
    ]
    
    print("\n  Reading analog values...")
    
    for _ in range(3):
        print()
        for name, adc in channels:
            raw = adc.read_u16()
            voltage = raw * 3.3 / 65535
            bar = "█" * int(voltage / 3.3 * 20)
            print(f"    {name}: {voltage:.2f}V [{bar:<20}]")
            utime.sleep_ms(200)
        utime.sleep_ms(500)
    
    print("\n  ✓ ADC reading complete")
    demo_pause()


# =============================================================================
# DEMO 7: Timer Callbacks - Watch periodic events
# =============================================================================

def demo_timer():
    """Watch timer fire periodic callbacks."""
    announce("Timer Periodic Callback")
    
    print("  EXPECT: Onboard LED toggles automatically")
    print("          every 500ms via timer callback")
    print("          (~3 seconds, 6 toggles)")
    
    from machine import Timer, Pin
    
    led = Pin(25, Pin.OUT)
    counter = [0]
    
    def tick(t):
        counter[0] += 1
        led.toggle()
        print(f"    Timer tick #{counter[0]} - LED toggled")
    
    timer = Timer()
    
    print("\n  Starting timer with 500ms period...")
    print("  Watch Pin 25 toggle automatically:\n")
    
    timer.init(mode=Timer.PERIODIC, period=500, callback=tick)
    
    # Let it run for a few seconds
    utime.sleep_ms(3000)
    
    timer.deinit()
    led.off()
    
    print(f"\n  Timer fired {counter[0]} times")
    print("  ✓ Timer demo complete")
    demo_pause()


# =============================================================================
# DEMO 8: WiFi Connection - Watch network events
# =============================================================================

def demo_wifi():
    """Watch WiFi connection sequence."""
    announce("WiFi Connection (Simulated)")
    
    print("  EXPECT: Console shows WiFi network scan")
    print("          and simulated connection sequence")
    print("          (~4 seconds total)")
    
    import network
    
    wlan = network.WLAN(network.STA_IF)
    
    print("\n  Activating WiFi interface...")
    utime.sleep_ms(500)
    wlan.active(True)
    
    print("  Scanning for networks...")
    utime.sleep_ms(500)
    networks = wlan.scan()
    
    print(f"\n  Found {len(networks)} network(s):")
    for net in networks[:5]:  # Show up to 5
        ssid = net[0].decode() if isinstance(net[0], bytes) else net[0]
        print(f"    📶 {ssid}")
        utime.sleep_ms(200)
    
    print("\n  Connecting to 'TestNetwork'...")
    utime.sleep_ms(500)
    wlan.connect("TestNetwork", "password123")
    
    if wlan.isconnected():
        ip = wlan.ifconfig()[0]
        print(f"  ✓ Connected! IP: {ip}")
    else:
        print("  ✓ Connection simulated")
    
    print("\n  ✓ WiFi demo complete")
    demo_pause()


# =============================================================================
# DEMO 9: RTC Clock - Watch time updates
# =============================================================================

def demo_rtc():
    """Watch RTC time being set and read."""
    announce("Real-Time Clock")
    
    print("  EXPECT: Console shows time updating")
    print("          every second from the RTC clock")
    print("          (~6 seconds total)")
    
    from machine import RTC
    
    rtc = RTC()
    
    print("\n  Setting RTC to 2025-12-25 12:00:00...")
    utime.sleep_ms(500)
    rtc.datetime((2025, 12, 25, 3, 12, 0, 0, 0))
    
    print("\n  Reading time every second:\n")
    
    for _ in range(5):
        dt = rtc.datetime()
        time_str = f"{dt[0]}-{dt[1]:02d}-{dt[2]:02d} {dt[4]:02d}:{dt[5]:02d}:{dt[6]:02d}"
        print(f"    🕐 {time_str}")
        utime.sleep_ms(1000)
    
    print("\n  ✓ RTC demo complete")
    demo_pause()


# =============================================================================
# DEMO 10: Complete Project - Environmental Monitor
# =============================================================================

def demo_environmental_monitor():
    """Watch a complete environmental monitoring project."""
    announce("Environmental Monitor Project")
    
    print("  EXPECT: LED blinks with each sensor reading")
    print("          Console shows temp, time, I2C data")
    print("          (~6 seconds, 5 samples)")
    
    from machine import Pin, I2C, ADC, RTC
    
    print("\n  Initializing hardware...")
    
    led = Pin(25, Pin.OUT)
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    temp_sensor = ADC(4)
    rtc = RTC()
    
    rtc.datetime((2025, 12, 13, 5, 14, 30, 0, 0))
    
    print("  ✓ LED, I2C, ADC, RTC initialized")
    utime.sleep_ms(500)
    
    print("\n  Collecting sensor data...\n")
    
    for sample in range(5):
        # Blink LED
        led.on()
        
        # Read sensors
        raw = temp_sensor.read_u16()
        voltage = raw * 3.3 / 65535
        temp = 27 - (voltage - 0.706) / 0.001721
        
        devices = i2c.scan()
        dt = rtc.datetime()
        
        timestamp = f"{dt[4]:02d}:{dt[5]:02d}:{dt[6]:02d}"
        
        print(f"    Sample {sample + 1}/5:")
        print(f"      Time: {timestamp}")
        print(f"      Temp: {temp:.1f}°C")
        print(f"      I2C Devices: {len(devices)}")
        print()
        
        led.off()
        utime.sleep_ms(1000)
    
    print("  ✓ Environmental monitor demo complete")


# =============================================================================
# MAIN - Run all demos
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  🎮 VISUAL EMULATOR DEMO")
    print("  Watch the emulator panel for real-time updates!")
    print("=" * 50)
    
    print("\n  Starting in 3 seconds...")
    utime.sleep_ms(3000)
    
    demos = [
        ("LED Blink", demo_led_blink),
        ("PWM Fade", demo_pwm_fade),
        ("Multiple Pins", demo_multiple_pins),
        ("NeoPixel Rainbow", demo_neopixel),
        ("I2C Scan", demo_i2c),
        ("ADC Readings", demo_adc),
        ("Timer", demo_timer),
        ("WiFi", demo_wifi),
        ("RTC Clock", demo_rtc),
        ("Environmental Monitor", demo_environmental_monitor),
    ]
    
    for i, (name, demo_fn) in enumerate(demos, 1):
        print(f"\n\n{'#'*50}")
        print(f"  DEMO {i}/{len(demos)}: {name}")
        print(f"{'#'*50}")
        
        try:
            demo_fn()
        except Exception as e:
            print(f"  ❌ Error: {e}")
        
        if i < len(demos):
            print(f"\n  Next: {demos[i][0]}")
            utime.sleep_ms(1000)
    
    print("\n\n" + "=" * 50)
    print("  🎉 ALL DEMOS COMPLETE!")
    print("=" * 50)
