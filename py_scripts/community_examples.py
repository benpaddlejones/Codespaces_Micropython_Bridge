"""
Community MicroPython Examples Test Suite
==========================================
This test file simulates real-world MicroPython patterns commonly found
in tutorials, GitHub projects, and community examples.

These examples validate that the emulator works with typical user code.

Run: python3 .extension/emulator/mock/runner.py py_scripts/community_examples.py
"""

import sys

# Test tracking
_passed = 0
_failed = 0
_errors = []


def run_example(name: str, example_fn):
    """Run a single example and track results."""
    global _passed, _failed
    print(f"\n{'='*60}")
    print(f"EXAMPLE: {name}")
    print(f"{'='*60}")
    try:
        example_fn()
        print(f"✅ PASSED: {name}")
        _passed += 1
    except Exception as e:
        print(f"❌ FAILED: {name}")
        print(f"   Error: {e}")
        _failed += 1
        _errors.append((name, str(e)))


# =============================================================================
# EXAMPLE 1: Classic LED Blink (Every Pico Tutorial)
# =============================================================================

def example_led_blink():
    """Classic LED blink - the "Hello World" of MicroPython."""
    from machine import Pin
    import utime
    
    led = Pin(25, Pin.OUT)
    
    for i in range(5):
        led.on()
        utime.sleep_ms(100)
        led.off()
        utime.sleep_ms(100)
    
    print("LED blinked 5 times")


# =============================================================================
# EXAMPLE 2: Button Input with Debounce
# =============================================================================

def example_button_debounce():
    """Button input with software debounce - common pattern."""
    from machine import Pin
    import utime
    
    button = Pin(14, Pin.IN, Pin.PULL_UP)
    led = Pin(25, Pin.OUT)
    
    last_press = 0
    debounce_ms = 200
    
    # Simulate a few button reads
    for _ in range(10):
        state = button.value()
        current_time = utime.ticks_ms()
        
        if state == 0:  # Button pressed (active low)
            if utime.ticks_diff(current_time, last_press) > debounce_ms:
                led.toggle()
                last_press = current_time
    
    print("Button debounce test complete")


# =============================================================================
# EXAMPLE 3: PWM LED Fade (Breathing LED)
# =============================================================================

def example_pwm_fade():
    """PWM breathing LED effect - popular demo."""
    from machine import Pin, PWM
    import utime
    
    led_pwm = PWM(Pin(25))
    led_pwm.freq(1000)
    
    # Fade up
    for duty in range(0, 65535, 6553):
        led_pwm.duty_u16(duty)
        utime.sleep_ms(10)
    
    # Fade down
    for duty in range(65535, 0, -6553):
        led_pwm.duty_u16(duty)
        utime.sleep_ms(10)
    
    led_pwm.deinit()
    print("PWM fade complete")


# =============================================================================
# EXAMPLE 4: Temperature Sensor (ADC Reading)
# =============================================================================

def example_temperature_sensor():
    """Internal temperature sensor reading - common Pico example."""
    from machine import ADC
    
    # RP2040 internal temp sensor on ADC4
    sensor_temp = ADC(4)
    
    readings = []
    for _ in range(10):
        reading = sensor_temp.read_u16()
        readings.append(reading)
    
    avg_reading = sum(readings) / len(readings)
    
    # Convert to temperature (RP2040 formula)
    conversion_factor = 3.3 / 65535
    voltage = avg_reading * conversion_factor
    temperature = 27 - (voltage - 0.706) / 0.001721
    
    print(f"Temperature: {temperature:.1f}°C (simulated)")


# =============================================================================
# EXAMPLE 5: I2C OLED Display (SSD1306 Pattern)
# =============================================================================

def example_i2c_oled():
    """I2C OLED display pattern - SSD1306 initialization sequence."""
    from machine import Pin, I2C
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    # Check for display
    devices = i2c.scan()
    print(f"I2C devices found: {[hex(d) for d in devices]}")
    
    OLED_ADDR = 0x3C
    
    # Typical SSD1306 init commands
    init_cmds = [
        0xAE,  # Display off
        0xD5, 0x80,  # Set display clock
        0xA8, 0x3F,  # Set multiplex ratio
        0xD3, 0x00,  # Set display offset
        0x40,  # Set start line
        0x8D, 0x14,  # Charge pump
        0x20, 0x00,  # Memory mode
        0xA1,  # Segment remap
        0xC8,  # COM output scan
        0xDA, 0x12,  # COM pins
        0x81, 0xCF,  # Contrast
        0xD9, 0xF1,  # Pre-charge
        0xDB, 0x40,  # VCOMH
        0xA4,  # Display all on resume
        0xA6,  # Normal display
        0xAF,  # Display on
    ]
    
    for cmd in init_cmds:
        try:
            i2c.writeto(OLED_ADDR, bytes([0x00, cmd]))
        except OSError:
            pass  # Expected in emulator without real device
    
    print("SSD1306 init sequence sent")


# =============================================================================
# EXAMPLE 6: MPU6050 Accelerometer Reading
# =============================================================================

def example_mpu6050():
    """MPU6050 accelerometer - very popular sensor project."""
    from machine import Pin, I2C
    import struct
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    MPU6050_ADDR = 0x68
    
    # Wake up MPU6050
    i2c.writeto_mem(MPU6050_ADDR, 0x6B, bytes([0x00]))
    
    # Read accelerometer data
    data = i2c.readfrom_mem(MPU6050_ADDR, 0x3B, 6)
    
    # Parse accelerometer values (big-endian signed 16-bit)
    ax = struct.unpack('>h', data[0:2])[0]
    ay = struct.unpack('>h', data[2:4])[0]
    az = struct.unpack('>h', data[4:6])[0]
    
    # Convert to g (assuming ±2g range)
    scale = 16384.0
    ax_g = ax / scale
    ay_g = ay / scale
    az_g = az / scale
    
    print(f"Accel: X={ax_g:.2f}g, Y={ay_g:.2f}g, Z={az_g:.2f}g")


# =============================================================================
# EXAMPLE 7: NeoPixel Rainbow
# =============================================================================

def example_neopixel_rainbow():
    """NeoPixel rainbow animation - very popular project."""
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
    
    # Rainbow cycle
    for j in range(3):  # 3 cycles
        for i in range(NUM_LEDS):
            pixel_index = (i * 256 // NUM_LEDS + j * 30) % 256
            np[i] = wheel(pixel_index)
        np.write()
    
    # Clear
    np.fill((0, 0, 0))
    np.write()
    
    print("NeoPixel rainbow complete")


# =============================================================================
# EXAMPLE 8: WiFi Connection (Pico W)
# =============================================================================

def example_wifi_connect():
    """WiFi connection pattern - Pico W projects."""
    import network
    import utime
    
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    # Scan for networks
    networks = wlan.scan()
    print(f"Found {len(networks)} networks")
    
    # Connect
    wlan.connect("TestSSID", "password123")
    
    # Wait for connection (with timeout)
    max_wait = 10
    while max_wait > 0:
        if wlan.isconnected():
            break
        max_wait -= 1
        utime.sleep_ms(100)
    
    if wlan.isconnected():
        ip = wlan.ifconfig()[0]
        print(f"Connected! IP: {ip}")
    else:
        print("Connection timeout (expected in emulator)")


# =============================================================================
# EXAMPLE 9: Timer-based Periodic Task
# =============================================================================

def example_timer_periodic():
    """Timer-based periodic execution - common pattern."""
    from machine import Timer
    import utime
    
    counter = [0]
    
    def tick(timer):
        counter[0] += 1
    
    timer = Timer()
    timer.init(mode=Timer.PERIODIC, period=50, callback=tick)
    
    # Let it run for a bit
    utime.sleep_ms(250)
    
    timer.deinit()
    
    print(f"Timer ticked {counter[0]} times")


# =============================================================================
# EXAMPLE 10: UART Communication
# =============================================================================

def example_uart_communication():
    """UART serial communication - GPS/sensor modules."""
    from machine import Pin, UART
    
    uart = UART(0, baudrate=9600, tx=Pin(0), rx=Pin(1))
    
    # Send data
    uart.write(b'AT\r\n')
    
    # Check for response
    if uart.any():
        response = uart.read()
        print(f"UART response: {response}")
    else:
        print("UART send complete (no response in emulator)")
    
    uart.deinit()


# =============================================================================
# EXAMPLE 11: SPI SD Card Pattern
# =============================================================================

def example_spi_sdcard():
    """SPI SD card initialization pattern."""
    from machine import Pin, SPI
    
    # SD card uses SPI
    spi = SPI(0, baudrate=400000, polarity=0, phase=0,
              sck=Pin(18), mosi=Pin(19), miso=Pin(16))
    cs = Pin(17, Pin.OUT)
    
    # SD card init sequence
    cs.on()  # Deselect
    
    # Send 80 clock pulses with CS high
    spi.write(bytes([0xFF] * 10))
    
    cs.off()  # Select card
    
    # CMD0 - GO_IDLE_STATE
    spi.write(bytes([0x40, 0x00, 0x00, 0x00, 0x00, 0x95]))
    response = spi.read(1)
    
    cs.on()  # Deselect
    
    spi.deinit()
    print("SD card init sequence complete")


# =============================================================================
# EXAMPLE 12: Real-Time Clock (RTC)
# =============================================================================

def example_rtc():
    """RTC usage - datalogging projects."""
    from machine import RTC
    
    rtc = RTC()
    
    # Set time
    rtc.datetime((2025, 12, 13, 5, 14, 30, 0, 0))
    
    # Read time
    dt = rtc.datetime()
    year, month, day, weekday, hour, minute, second, subsec = dt
    
    print(f"RTC: {year}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}")


# =============================================================================
# EXAMPLE 13: Watchdog Timer
# =============================================================================

def example_watchdog():
    """Watchdog timer - reliability pattern."""
    from machine import WDT
    import utime
    
    # 8 second timeout
    wdt = WDT(timeout=8000)
    
    # Simulate normal operation with feeding
    for i in range(5):
        wdt.feed()
        utime.sleep_ms(100)
    
    print("Watchdog fed successfully")


# =============================================================================
# EXAMPLE 14: PIO State Machine (RP2040 specific)
# =============================================================================

def example_pio_statemachine():
    """PIO state machine - advanced RP2040 feature."""
    from rp2 import PIO, StateMachine
    
    # Create a simple state machine (no actual program)
    sm = StateMachine(0, None, freq=2000)
    
    sm.active(1)
    sm.put(0x12345678)
    val = sm.get()
    sm.active(0)
    
    print(f"PIO StateMachine test complete")


# =============================================================================
# EXAMPLE 15: Multiple ADC Channels (Voltage Monitoring)
# =============================================================================

def example_multi_adc():
    """Multiple ADC channels - battery/solar monitoring."""
    from machine import Pin, ADC
    
    # Read multiple analog inputs
    adc_channels = {
        "GP26 (ADC0)": ADC(26),
        "GP27 (ADC1)": ADC(27),
        "GP28 (ADC2)": ADC(28),
        "Temp Sensor": ADC(4),
    }
    
    print("ADC Readings:")
    for name, adc in adc_channels.items():
        raw = adc.read_u16()
        voltage = raw * 3.3 / 65535
        print(f"  {name}: {raw} raw, {voltage:.3f}V")


# =============================================================================
# EXAMPLE 16: IRQ Handler Pattern
# =============================================================================

def example_irq_handler():
    """Pin interrupt handler - event-driven programming."""
    from machine import Pin
    
    events = []
    
    def button_handler(pin):
        events.append(f"IRQ on {pin}")
    
    button = Pin(14, Pin.IN, Pin.PULL_UP)
    button.irq(handler=button_handler, trigger=Pin.IRQ_FALLING)
    
    print("IRQ handler registered")
    print(f"Events captured: {len(events)}")


# =============================================================================
# EXAMPLE 17: Memory-Efficient Pattern (micropython.const)
# =============================================================================

def example_const_optimization():
    """Memory optimization with micropython.const - embedded best practice."""
    import micropython
    
    # Constants for register addresses
    REG_CTRL = micropython.const(0x1A)
    REG_STATUS = micropython.const(0x1B)
    REG_DATA = micropython.const(0x3B)
    
    # These become compile-time constants in real MicroPython
    registers = [REG_CTRL, REG_STATUS, REG_DATA]
    
    print(f"Register addresses: {[hex(r) for r in registers]}")


# =============================================================================
# EXAMPLE 18: Binary Data Handling
# =============================================================================

def example_binary_data():
    """Binary data manipulation - protocol implementation."""
    import struct
    import binascii
    
    # Create a data packet
    header = struct.pack('<BBH', 0xAA, 0x55, 256)  # Start bytes + length
    payload = bytes([0x01, 0x02, 0x03, 0x04])
    checksum = sum(payload) & 0xFF
    
    packet = header + payload + bytes([checksum])
    
    print(f"Packet: {binascii.hexlify(packet).decode()}")
    
    # Parse it back
    start1, start2, length = struct.unpack('<BBH', packet[:4])
    assert start1 == 0xAA and start2 == 0x55
    
    print("Binary data handling complete")


# =============================================================================
# EXAMPLE 19: Collections Usage
# =============================================================================

def example_collections():
    """Collections for efficient data structures."""
    import collections
    
    # OrderedDict for config
    config = collections.OrderedDict()
    config['ssid'] = 'MyNetwork'
    config['password'] = 'secret'
    config['timeout'] = 30
    
    # namedtuple for sensor data
    SensorReading = collections.namedtuple('SensorReading', ['temp', 'humidity', 'pressure'])
    reading = SensorReading(25.5, 60, 1013.25)
    
    # deque for rolling buffer
    samples = collections.deque(maxlen=10)
    for i in range(15):
        samples.append(i)
    
    print(f"Config keys: {list(config.keys())}")
    print(f"Reading: temp={reading.temp}°C")
    print(f"Samples buffer: {list(samples)}")


# =============================================================================
# EXAMPLE 20: Complete Mini-Project - Environmental Monitor
# =============================================================================

def example_environmental_monitor():
    """Complete mini-project: Environmental monitor with display."""
    from machine import Pin, I2C, ADC, RTC
    import utime
    
    # Initialize hardware
    led = Pin(25, Pin.OUT)
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    temp_sensor = ADC(4)
    rtc = RTC()
    
    # Set initial time
    rtc.datetime((2025, 12, 13, 5, 15, 0, 0, 0))
    
    # Scan for I2C devices
    devices = i2c.scan()
    
    # Collect samples
    samples = []
    for i in range(5):
        # Blink LED
        led.on()
        
        # Read temperature
        raw = temp_sensor.read_u16()
        voltage = raw * 3.3 / 65535
        temp = 27 - (voltage - 0.706) / 0.001721
        
        # Get timestamp
        dt = rtc.datetime()
        timestamp = f"{dt[3]:02d}:{dt[4]:02d}:{dt[5]:02d}"
        
        samples.append({
            'time': timestamp,
            'temp': temp,
            'devices': len(devices)
        })
        
        led.off()
        utime.sleep_ms(50)
    
    # Report
    print("Environmental Monitor Report:")
    for s in samples:
        print(f"  [{s['time']}] Temp: {s['temp']:.1f}°C, I2C devices: {s['devices']}")


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("COMMUNITY MICROPYTHON EXAMPLES TEST SUITE")
    print("=" * 60)
    print("Testing real-world patterns from tutorials and projects...\n")
    
    examples = [
        ("LED Blink (Hello World)", example_led_blink),
        ("Button Debounce", example_button_debounce),
        ("PWM LED Fade", example_pwm_fade),
        ("Temperature Sensor", example_temperature_sensor),
        ("I2C OLED Display", example_i2c_oled),
        ("MPU6050 Accelerometer", example_mpu6050),
        ("NeoPixel Rainbow", example_neopixel_rainbow),
        ("WiFi Connection", example_wifi_connect),
        ("Timer Periodic", example_timer_periodic),
        ("UART Communication", example_uart_communication),
        ("SPI SD Card", example_spi_sdcard),
        ("Real-Time Clock", example_rtc),
        ("Watchdog Timer", example_watchdog),
        ("PIO StateMachine", example_pio_statemachine),
        ("Multi-Channel ADC", example_multi_adc),
        ("IRQ Handler", example_irq_handler),
        ("Const Optimization", example_const_optimization),
        ("Binary Data", example_binary_data),
        ("Collections", example_collections),
        ("Environmental Monitor (Full Project)", example_environmental_monitor),
    ]
    
    for name, example_fn in examples:
        run_example(name, example_fn)
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Passed: {_passed}")
    print(f"❌ Failed: {_failed}")
    
    if _errors:
        print("\nFailed examples:")
        for name, error in _errors:
            print(f"  - {name}: {error}")
    
    print("=" * 60)
    
    if _failed > 0:
        sys.exit(1)
