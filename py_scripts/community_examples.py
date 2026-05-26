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
        assert led.value() == 1, f"iter {i}: led.on() must set value to 1"
        utime.sleep_ms(100)
        led.off()
        assert led.value() == 0, f"iter {i}: led.off() must set value to 0"
        utime.sleep_ms(100)

    # Final state must be OFF
    assert led.value() == 0, "LED must end in OFF state"
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
    toggles = 0

    # Simulate a few button reads
    for _ in range(10):
        state = button.value()
        assert state in (0, 1), f"button.value() must be 0 or 1, got {state}"
        current_time = utime.ticks_ms()
        assert isinstance(current_time, int), "ticks_ms() must return int"

        if state == 0:  # Button pressed (active low)
            if utime.ticks_diff(current_time, last_press) > debounce_ms:
                led.toggle()
                toggles += 1
                last_press = current_time

    # LED final state must be a valid digital level
    assert led.value() in (0, 1), "LED must be in valid digital state"
    assert toggles >= 0, "toggle count must be non-negative"
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
    assert led_pwm.freq() == 1000, f"freq must be 1000, got {led_pwm.freq()}"

    # Fade up — every duty write must round-trip
    for duty in range(0, 65535, 6553):
        led_pwm.duty_u16(duty)
        assert led_pwm.duty_u16() == duty, \
            f"duty_u16 round-trip failed: set {duty}, got {led_pwm.duty_u16()}"
        utime.sleep_ms(10)

    # Fade down
    for duty in range(65535, 0, -6553):
        led_pwm.duty_u16(duty)
        assert led_pwm.duty_u16() == duty, \
            f"duty_u16 round-trip failed: set {duty}, got {led_pwm.duty_u16()}"
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
        assert isinstance(reading, int), \
            f"read_u16() must return int, got {type(reading).__name__}"
        assert 0 <= reading <= 65535, f"ADC reading out of range: {reading}"
        readings.append(reading)

    assert len(readings) == 10, f"Must collect 10 samples, got {len(readings)}"
    avg_reading = sum(readings) / len(readings)
    assert 0 <= avg_reading <= 65535, f"Average out of range: {avg_reading}"

    # Convert to temperature (RP2040 formula)
    conversion_factor = 3.3 / 65535
    voltage = avg_reading * conversion_factor
    assert 0 <= voltage <= 3.3, f"Computed voltage out of range: {voltage}"
    temperature = 27 - (voltage - 0.706) / 0.001721
    assert isinstance(temperature, float), "temperature must be float"

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
    assert isinstance(devices, list), f"scan() must return list, got {type(devices).__name__}"
    assert len(devices) > 0, "mock scan() must return at least one device"
    for addr in devices:
        assert isinstance(addr, int), f"device address must be int, got {type(addr).__name__}"
        assert 0 <= addr <= 0x7F, f"I2C address out of 7-bit range: {addr}"
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

    # Every writeto returns the number of bytes ACKed (real device-dependent).
    # Contract: returns a non-negative int <= len(buf).
    for cmd in init_cmds:
        written = i2c.writeto(OLED_ADDR, bytes([0x00, cmd]))
        assert isinstance(written, int), \
            f"writeto must return int, got {type(written).__name__} for cmd {hex(cmd)}"
        assert 0 <= written <= 2, \
            f"writeto must return 0..2 bytes ACKed for cmd {hex(cmd)}, got {written}"

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

    # Wake up MPU6050 — writeto_mem must return None per real MicroPython
    result = i2c.writeto_mem(MPU6050_ADDR, 0x6B, bytes([0x00]))
    assert result is None, f"writeto_mem must return None, got {result}"

    # Read accelerometer data — exactly 6 bytes
    data = i2c.readfrom_mem(MPU6050_ADDR, 0x3B, 6)
    assert isinstance(data, bytes), \
        f"readfrom_mem must return bytes, got {type(data).__name__}"
    assert len(data) == 6, f"Must read 6 bytes, got {len(data)}"

    # Parse accelerometer values (big-endian signed 16-bit)
    ax = struct.unpack('>h', data[0:2])[0]
    ay = struct.unpack('>h', data[2:4])[0]
    az = struct.unpack('>h', data[4:6])[0]
    for axis_name, val in (("ax", ax), ("ay", ay), ("az", az)):
        assert isinstance(val, int), f"{axis_name} must be int, got {type(val).__name__}"
        assert -32768 <= val <= 32767, \
            f"{axis_name} must fit in int16, got {val}"

    # Convert to g (assuming ±2g range)
    scale = 16384.0
    ax_g = ax / scale
    ay_g = ay / scale
    az_g = az / scale
    for axis_name, val in (("ax_g", ax_g), ("ay_g", ay_g), ("az_g", az_g)):
        assert -2.0 <= val <= 2.0, f"{axis_name} out of ±2g range: {val}"

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
    assert len(np) == NUM_LEDS, f"len(np) must be {NUM_LEDS}, got {len(np)}"

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

    # Rainbow cycle — each set must round-trip exactly
    last_colors = [None] * NUM_LEDS
    for j in range(3):  # 3 cycles
        for i in range(NUM_LEDS):
            pixel_index = (i * 256 // NUM_LEDS + j * 30) % 256
            color = wheel(pixel_index)
            assert len(color) == 3 and all(0 <= c <= 255 for c in color), \
                f"wheel() must return valid RGB, got {color}"
            np[i] = color
            assert np[i] == color, \
                f"pixel {i} round-trip failed: set {color}, got {np[i]}"
            last_colors[i] = color
        np.write()

    # After the last cycle every pixel must still equal what we set
    for i, color in enumerate(last_colors):
        assert np[i] == color, f"pixel {i} mutated after write(), got {np[i]}"

    # Clear must zero every pixel
    np.fill((0, 0, 0))
    for i in range(NUM_LEDS):
        assert np[i] == (0, 0, 0), f"fill((0,0,0)) must clear pixel {i}, got {np[i]}"
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
    assert wlan.active(True) is True, "active(True) must return True"

    # Scan returns list of 6-tuples; count is environment-dependent.
    networks = wlan.scan()
    assert isinstance(networks, list), "scan() must return list"
    for net in networks:
        assert len(net) == 6, f"Each scan entry must be 6-tuple, got {len(net)}"
    print(f"Found {len(networks)} networks")

    # Connect (real hardware may legitimately time out; assert structure either way)
    wlan.connect("TestSSID", "password123")

    # Wait for connection (with timeout)
    max_wait = 10
    while max_wait > 0:
        if wlan.isconnected():
            break
        max_wait -= 1
        utime.sleep_ms(100)

    # Contract: ifconfig() always returns 4-tuple of dotted-decimal strs.
    cfg = wlan.ifconfig()
    assert isinstance(cfg, tuple) and len(cfg) == 4, \
        f"ifconfig() must return 4-tuple, got {cfg!r}"
    for field, value in zip(("ip", "subnet", "gateway", "dns"), cfg):
        assert isinstance(value, str) and value, \
            f"{field} must be non-empty str, got {value!r}"
        parts = value.split(".")
        assert len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts), \
            f"{field} must be dotted-decimal IPv4, got {value!r}"

    if wlan.isconnected():
        print(f"Connected! IP: {cfg[0]}")
    else:
        print("Connection timeout (acceptable on real hardware)")


# =============================================================================
# EXAMPLE 9: Timer-based Periodic Task
# =============================================================================

def example_timer_periodic():
    """Timer-based periodic execution - common pattern."""
    from machine import Timer
    import utime

    counter = [0]

    def tick(timer):
        """Periodic timer callback that increments the shared counter."""
        counter[0] += 1

    timer = Timer()
    init_result = timer.init(mode=Timer.PERIODIC, period=50, callback=tick)
    assert init_result is None, f"Timer.init() must return None, got {init_result}"

    # Let it run for a bit
    utime.sleep_ms(250)

    deinit_result = timer.deinit()
    assert deinit_result is None, f"Timer.deinit() must return None, got {deinit_result}"

    assert isinstance(counter[0], int), "counter must remain int"
    assert counter[0] >= 0, f"counter must be non-negative, got {counter[0]}"
    print(f"Timer ticked {counter[0]} times")


# =============================================================================
# EXAMPLE 10: UART Communication
# =============================================================================

def example_uart_communication():
    """UART serial communication - GPS/sensor modules."""
    from machine import Pin, UART

    uart = UART(0, baudrate=9600, tx=Pin(0), rx=Pin(1))

    # Send data — must return exact byte count
    msg = b'AT\r\n'
    written = uart.write(msg)
    assert written == len(msg), f"write() must return {len(msg)}, got {written}"

    # Loopback is enabled by default in the mock — data MUST be available
    available = uart.any()
    assert available == len(msg), \
        f"any() must report {len(msg)} bytes after loopback, got {available}"

    response = uart.read()
    assert response == msg, \
        f"Loopback must echo {msg!r}, got {response!r}"

    # After draining
    assert uart.any() == 0, "any() must be 0 after read"

    print(f"UART response: {response}")
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
    assert cs.value() == 1, "CS must be high (deselected) after on()"

    # Send 80 clock pulses with CS high
    spi.write(bytes([0xFF] * 10))

    cs.off()  # Select card
    assert cs.value() == 0, "CS must be low (selected) after off()"

    # CMD0 - GO_IDLE_STATE
    spi.write(bytes([0x40, 0x00, 0x00, 0x00, 0x00, 0x95]))
    response = spi.read(1)
    # Contract: spi.read(n) returns n bytes; content is device-dependent.
    assert isinstance(response, (bytes, bytearray)), \
        f"spi.read() must return bytes-like, got {type(response).__name__}"
    assert len(response) == 1, f"Must read 1 byte, got {len(response)}"

    cs.on()  # Deselect
    assert cs.value() == 1, "CS must be high after final deselect"

    spi.deinit()
    print("SD card init sequence complete")


# =============================================================================
# EXAMPLE 12: Real-Time Clock (RTC)
# =============================================================================

def example_rtc():
    """RTC usage - datalogging projects."""
    from machine import RTC

    rtc = RTC()

    # Set time and verify round-trip
    set_value = (2025, 12, 13, 5, 14, 30, 0, 0)
    rtc.datetime(set_value)

    dt = rtc.datetime()
    assert isinstance(dt, tuple), f"datetime() must return tuple, got {type(dt).__name__}"
    assert len(dt) == 8, f"datetime() must be 8-tuple, got {len(dt)}"
    assert dt == set_value, \
        f"datetime round-trip failed: expected {set_value}, got {dt}"

    year, month, day, weekday, hour, minute, second, subsec = dt
    assert year == 2025 and month == 12 and day == 13, \
        f"Date fields wrong: {(year, month, day)}"
    assert hour == 14 and minute == 30 and second == 0, \
        f"Time fields wrong: {(hour, minute, second)}"

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
    assert wdt is not None, "WDT() must return an instance"

    # Simulate normal operation with feeding — feed() must return None
    for i in range(5):
        result = wdt.feed()
        assert result is None, f"feed() iter {i} must return None, got {result}"
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
    assert sm is not None, "StateMachine() must return instance"

    # active() must round-trip
    sm.active(1)
    assert sm.active() == 1, f"sm.active(1) must report 1, got {sm.active()}"

    # put() must accept int and not raise
    sm.put(0x12345678)

    # Contract: get() returns int; the value is FIFO-dependent.
    val = sm.get()
    assert isinstance(val, int), \
        f"sm.get() must return int, got {type(val).__name__}"
    assert 0 <= val <= 0xFFFFFFFF, \
        f"sm.get() must be 32-bit unsigned, got {val}"

    sm.active(0)
    assert sm.active() == 0, f"sm.active(0) must report 0, got {sm.active()}"

    print("PIO StateMachine test complete")


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
    readings_seen = 0
    for name, adc in adc_channels.items():
        raw = adc.read_u16()
        assert isinstance(raw, int), \
            f"{name}: read_u16() must return int, got {type(raw).__name__}"
        assert 0 <= raw <= 65535, f"{name}: raw out of range: {raw}"
        voltage = raw * 3.3 / 65535
        assert 0.0 <= voltage <= 3.3, f"{name}: voltage out of range: {voltage}"
        readings_seen += 1
        print(f"  {name}: {raw} raw, {voltage:.3f}V")

    assert readings_seen == 4, \
        f"Must read all 4 channels, got {readings_seen}"


# =============================================================================
# EXAMPLE 16: IRQ Handler Pattern
# =============================================================================

def example_irq_handler():
    """Pin interrupt handler - event-driven programming."""
    from machine import Pin

    events = []

    def button_handler(pin):
        """Pin IRQ handler that records each event into the closure list."""
        events.append(f"IRQ on {pin}")

    button = Pin(14, Pin.IN, Pin.PULL_UP)
    # Contract: Pin.irq() returns None.
    result = button.irq(handler=button_handler, trigger=Pin.IRQ_FALLING)
    assert result is None, f"Pin.irq() must return None, got {result}"
    # Clearing with None is also part of the public contract.
    cleared = button.irq(handler=None, trigger=Pin.IRQ_FALLING)
    assert cleared is None, f"Pin.irq(handler=None) must return None, got {cleared}"

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

    # In real MicroPython these are compile-time constants — in the mock
    # const() must be identity-like for the wrapped value.
    assert REG_CTRL == 0x1A, f"REG_CTRL must equal 0x1A, got {REG_CTRL}"
    assert REG_STATUS == 0x1B, f"REG_STATUS must equal 0x1B, got {REG_STATUS}"
    assert REG_DATA == 0x3B, f"REG_DATA must equal 0x3B, got {REG_DATA}"

    registers = [REG_CTRL, REG_STATUS, REG_DATA]
    assert registers == [0x1A, 0x1B, 0x3B], \
        f"registers list mismatch: {registers}"

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
    assert len(header) == 4, f"<BBH must pack to 4 bytes, got {len(header)}"
    payload = bytes([0x01, 0x02, 0x03, 0x04])
    checksum = sum(payload) & 0xFF
    assert checksum == 0x0A, f"checksum must be 0x0A, got {hex(checksum)}"

    packet = header + payload + bytes([checksum])
    assert len(packet) == 9, f"packet must be 9 bytes, got {len(packet)}"

    hex_str = binascii.hexlify(packet)
    assert isinstance(hex_str, bytes), \
        f"hexlify must return bytes, got {type(hex_str).__name__}"
    assert len(hex_str) == 18, f"hexlify must be 18 chars, got {len(hex_str)}"
    print(f"Packet: {hex_str.decode()}")

    # Parse it back
    start1, start2, length = struct.unpack('<BBH', packet[:4])
    assert start1 == 0xAA, f"start1 must be 0xAA, got {hex(start1)}"
    assert start2 == 0x55, f"start2 must be 0x55, got {hex(start2)}"
    assert length == 256, f"length must be 256, got {length}"

    # Round-trip through unhexlify
    assert binascii.unhexlify(hex_str) == packet, \
        "unhexlify(hexlify(packet)) must return original packet"

    print("Binary data handling complete")


# =============================================================================
# EXAMPLE 19: Collections Usage
# =============================================================================

def example_collections():
    """Collections for efficient data structures."""
    import collections

    # OrderedDict for config — insertion order must be preserved
    config = collections.OrderedDict()
    config['ssid'] = 'MyNetwork'
    config['password'] = 'secret'
    config['timeout'] = 30
    assert list(config.keys()) == ['ssid', 'password', 'timeout'], \
        f"OrderedDict must preserve insertion order, got {list(config.keys())}"
    assert config['timeout'] == 30, f"config['timeout'] must be 30, got {config['timeout']}"

    # namedtuple for sensor data — named and positional access must match
    SensorReading = collections.namedtuple('SensorReading', ['temp', 'humidity', 'pressure'])
    reading = SensorReading(25.5, 60, 1013.25)
    assert reading.temp == 25.5, f"reading.temp must be 25.5, got {reading.temp}"
    assert reading.humidity == 60, f"reading.humidity must be 60, got {reading.humidity}"
    assert reading.pressure == 1013.25, f"reading.pressure must be 1013.25, got {reading.pressure}"
    assert reading[0] == 25.5 and reading[1] == 60 and reading[2] == 1013.25, \
        f"namedtuple positional access must match, got {tuple(reading)}"

    # deque for rolling buffer — maxlen must enforce eviction
    samples = collections.deque(maxlen=10)
    for i in range(15):
        samples.append(i)
    assert len(samples) == 10, f"deque(maxlen=10) must cap at 10, got {len(samples)}"
    assert list(samples) == list(range(5, 15)), \
        f"deque must evict oldest; expected [5..14], got {list(samples)}"

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

    # Set initial time and verify round-trip
    set_value = (2025, 12, 13, 5, 15, 0, 0, 0)
    rtc.datetime(set_value)
    assert rtc.datetime() == set_value, \
        f"RTC round-trip failed: {rtc.datetime()}"

# Scan for I2C devices — count is environment-dependent.
    devices = i2c.scan()
    assert isinstance(devices, list), "scan() must return list"
    for addr in devices:
        assert isinstance(addr, int) and 0 <= addr <= 0x7F, \
            f"I2C address out of 7-bit range: {addr}"

    # Collect samples
    samples = []
    for i in range(5):
        # Blink LED
        led.on()
        assert led.value() == 1, f"iter {i}: LED must be on"

        # Read temperature
        raw = temp_sensor.read_u16()
        assert 0 <= raw <= 65535, f"iter {i}: ADC raw out of range: {raw}"
        voltage = raw * 3.3 / 65535
        temp = 27 - (voltage - 0.706) / 0.001721

        # Get timestamp
        dt = rtc.datetime()
        assert len(dt) == 8, f"iter {i}: datetime must be 8-tuple"
        timestamp = f"{dt[3]:02d}:{dt[4]:02d}:{dt[5]:02d}"

        samples.append({
            'time': timestamp,
            'temp': temp,
            'devices': len(devices)
        })

        led.off()
        assert led.value() == 0, f"iter {i}: LED must be off"
        utime.sleep_ms(50)

    # Final invariants on collected dataset
    assert len(samples) == 5, f"Must collect 5 samples, got {len(samples)}"
    for i, s in enumerate(samples):
        assert set(s.keys()) == {'time', 'temp', 'devices'}, \
            f"sample {i} missing keys: {s.keys()}"
        assert isinstance(s['time'], str) and len(s['time']) == 8, \
            f"sample {i} timestamp malformed: {s['time']!r}"
        assert isinstance(s['temp'], float), \
            f"sample {i} temp must be float, got {type(s['temp']).__name__}"
        assert s['devices'] == len(devices), \
            f"sample {i} device count drift: {s['devices']} vs {len(devices)}"

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
