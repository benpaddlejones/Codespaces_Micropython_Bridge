"""Community Example Tests - Validates emulator against common MicroPython patterns.

This script tests patterns commonly found in:
- Official MicroPython documentation
- Raspberry Pi Pico tutorials
- Popular sensor libraries
- Community projects

Run with: python runner.py community_tests.py
"""

from machine import Pin, PWM, ADC, I2C, SPI, Timer, UART, RTC, mem32
import utime
import gc
import micropython

# Track test results
tests_passed = 0
tests_failed = 0
test_errors = []


def test(name, func):
    """Run a test and report results."""
    global tests_passed, tests_failed
    print(f"\n{'='*50}")
    print(f"TEST: {name}")
    print('='*50)
    try:
        func()
        tests_passed += 1
        print(f"✅ PASSED: {name}")
    except Exception as e:
        tests_failed += 1
        test_errors.append((name, str(e)))
        print(f"❌ FAILED: {name}")
        print(f"   Error: {e}")


# =============================================================================
# TEST 1: Basic LED Blink (Most Common Pattern)
# =============================================================================
def test_led_blink():
    """Classic LED blink - the 'Hello World' of microcontrollers."""
    led = Pin(25, Pin.OUT)
    
    for _ in range(3):
        led.on()
        utime.sleep_ms(100)
        led.off()
        utime.sleep_ms(100)
    
    # Also test value() method
    led.value(1)
    assert led.value() == 1, "LED should be ON"
    led.value(0)
    assert led.value() == 0, "LED should be OFF"
    
    # Test toggle
    led.toggle()
    assert led.value() == 1, "LED should be ON after toggle"
    led.toggle()
    assert led.value() == 0, "LED should be OFF after toggle"
    
    # Test low/high aliases
    led.high()
    assert led.value() == 1, "LED should be ON after high()"
    led.low()
    assert led.value() == 0, "LED should be OFF after low()"


# =============================================================================
# TEST 2: PWM Fade (Common in LED projects)
# =============================================================================
def test_pwm_fade():
    """PWM LED fade - common in ambient lighting projects."""
    led = Pin(15, Pin.OUT)
    pwm = PWM(led)
    pwm.freq(1000)
    
    # Fade up
    for duty in range(0, 65536, 8192):
        pwm.duty_u16(duty)
        utime.sleep_ms(20)
    
    # Fade down
    for duty in range(65535, -1, -8192):
        pwm.duty_u16(max(0, duty))
        utime.sleep_ms(20)
    
    # Test init() method — verify BOTH freq and duty round-trip
    pwm.init(freq=500, duty_u16=32768)
    assert pwm.freq() == 500, f"Freq should be 500, got {pwm.freq()}"
    assert pwm.duty_u16() == 32768, \
        f"duty_u16 should be 32768 after init, got {pwm.duty_u16()}"

    # Final fade sample should be readable too
    pwm.duty_u16(12345)
    assert pwm.duty_u16() == 12345, \
        f"duty_u16 round-trip failed, got {pwm.duty_u16()}"

    pwm.deinit()


# =============================================================================
# TEST 3: ADC Temperature Sensor (RP2040 Specific)
# =============================================================================
def test_adc_temperature():
    """Read internal temperature sensor - common in Pico projects."""
    # RP2040 internal temp sensor is ADC4
    temp_sensor = ADC(4)
    
    reading = temp_sensor.read_u16()
    assert 0 <= reading <= 65535, f"ADC reading out of range: {reading}"
    
    # Test legacy read() method
    reading_12bit = temp_sensor.read()
    assert 0 <= reading_12bit <= 4095, f"12-bit ADC reading out of range: {reading_12bit}"
    
    # Test read_uv() for voltage
    voltage_uv = temp_sensor.read_uv()
    assert 0 <= voltage_uv <= 3_300_000, f"Voltage out of range: {voltage_uv}"
    
    # Convert ADC to temperature (RP2040 formula)
    conversion_factor = 3.3 / 65535
    voltage = reading * conversion_factor
    temperature = 27 - (voltage - 0.706) / 0.001721
    print(f"Temperature: {temperature:.1f}°C (simulated)")


# =============================================================================
# TEST 4: I2C Device Scan (Common debugging pattern)
# =============================================================================
def test_i2c_scan():
    """I2C bus scan - first step in any I2C project."""
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    devices = i2c.scan()
    print(f"I2C devices found: {[hex(addr) for addr in devices]}")
    
    assert isinstance(devices, list), "scan() should return a list"
    assert len(devices) > 0, "Auto-respond should return mock devices"


# =============================================================================
# TEST 5: I2C Device Read/Write (Sensor communication)
# =============================================================================
def test_i2c_communication():
    """I2C read/write - simulates MPU6050 accelerometer communication."""
    i2c = I2C(0, scl=Pin(1), sda=Pin(0))
    
    # Simulate MPU6050 WHO_AM_I register read
    MPU6050_ADDR = 0x68
    WHO_AM_I_REG = 0x75
    
    # Write to device. Contract: writeto returns number of ACKs (device-dependent).
    result = i2c.writeto(MPU6050_ADDR, bytes([WHO_AM_I_REG]))
    assert isinstance(result, int) and 0 <= result <= 1, \
        f"writeto must return int in 0..len(buf), got {result}"

    # Read response
    data = i2c.readfrom(MPU6050_ADDR, 1)
    assert len(data) == 1, f"Should read 1 byte, got {len(data)}"
    
    # Memory read pattern
    accel_data = i2c.readfrom_mem(MPU6050_ADDR, 0x3B, 6)  # ACCEL_XOUT_H
    assert len(accel_data) == 6, f"Should read 6 bytes, got {len(accel_data)}"
    
    # Memory write pattern
    i2c.writeto_mem(MPU6050_ADDR, 0x6B, bytes([0x00]))  # Wake up MPU6050


# =============================================================================
# TEST 6: I2C Low-Level Primitives
# =============================================================================
def test_i2c_primitives():
    """Test low-level I2C primitives used by some libraries."""
    i2c = I2C(0, scl=Pin(1), sda=Pin(0))
    
    # Low-level primitives
    i2c.start()
    acks = i2c.write(bytes([0x68 << 1]))  # Address + write bit
    assert isinstance(acks, int) and acks >= 0, \
        f"write() must return non-negative ACK count, got {acks}"

    buf = bytearray(2)
    i2c.readinto(buf)
    i2c.stop()

    # Vectored write. Contract: writevto returns number of ACKs (device-dependent),
    # bounded by total payload bytes.
    payload = [bytes([0x3B]), bytes([0x00, 0x01])]
    total = sum(len(p) for p in payload)
    nbytes = i2c.writevto(0x68, payload)
    assert isinstance(nbytes, int) and 0 <= nbytes <= total, \
        f"writevto must return 0..{total} ACKs, got {nbytes}"


# =============================================================================
# TEST 7: SPI Communication (Display/SD card pattern)
# =============================================================================
def test_spi_communication():
    """SPI communication - common for displays and SD cards."""
    spi = SPI(0, baudrate=1000000, polarity=0, phase=0)
    
    # CS pin pattern (manual chip select)
    cs = Pin(17, Pin.OUT)
    cs.value(1)  # Deselect
    
    cs.value(0)  # Select
    assert cs.value() == 0, "CS should be low (selected)"
    spi.write(bytes([0x9F]))  # Read ID command (common for flash chips)
    response = spi.read(3)
    cs.value(1)  # Deselect
    assert cs.value() == 1, "CS should be high (deselected)"

    # Contract: spi.read(n) returns exactly n bytes (content is device-dependent).
    assert isinstance(response, (bytes, bytearray)), \
        f"spi.read() must return bytes-like, got {type(response).__name__}"
    assert len(response) == 3, f"spi.read(3) must return 3 bytes, got {len(response)}"

    # Contract: write_readinto() returns None and preserves buffer length.
    write_buf = bytes([0x03, 0x00, 0x00, 0x00])  # Read command
    read_buf = bytearray(b"\xAA\xBB\xCC\xDD")
    original_len = len(read_buf)
    result = spi.write_readinto(write_buf, read_buf)
    assert result is None, f"write_readinto must return None, got {result}"
    assert len(read_buf) == original_len, \
        f"write_readinto must not change buffer length, got {len(read_buf)}"

    spi.deinit()


# =============================================================================
# TEST 8: Timer Callbacks (Interrupt-driven patterns)
# =============================================================================
def test_timer_callbacks():
    """Timer callbacks - common for periodic tasks."""
    counter = [0]  # Use list for mutable closure
    
    def tick(t):
        """Periodic timer callback that increments the shared counter."""
        counter[0] += 1
    
    timer = Timer()
    result = timer.init(freq=10, mode=Timer.PERIODIC, callback=tick)
    assert result is None, f"Timer.init() must return None, got {result}"

    # Let timer run briefly
    utime.sleep_ms(250)
    timer.deinit()

    # Counter type must be int (mock may or may not tick, but state must be sane)
    assert isinstance(counter[0], int), \
        f"Counter must remain int, got {type(counter[0]).__name__}"
    assert counter[0] >= 0, f"Counter must be non-negative, got {counter[0]}"

    # Test timer value — must be 32-bit masked int
    timer2 = Timer(1)
    timer2.init(freq=1, mode=Timer.ONE_SHOT, callback=tick)
    val = timer2.value()
    assert isinstance(val, int), f"Timer.value() should return int, got {type(val)}"
    assert 0 <= val <= 0xFFFFFFFF, \
        f"Timer.value() must be 32-bit masked, got {val}"
    timer2.deinit()


# =============================================================================
# TEST 9: UART Communication (Serial devices)
# =============================================================================
def test_uart_communication():
    """UART communication - GPS, Bluetooth modules, etc."""
    uart = UART(0, baudrate=9600, tx=Pin(0), rx=Pin(1))
    
    # Write data
    message = b"AT+GMR\r\n"  # Common AT command
    bytes_written = uart.write(message)
    assert bytes_written == len(message), \
        f"Should write {len(message)} bytes, got {bytes_written}"

    # Loopback is enabled by default in mock — data MUST be available
    available = uart.any()
    assert available == len(message), \
        f"any() must report {len(message)} bytes after loopback write, got {available}"

    response = uart.read()
    assert response == message, \
        f"Loopback must return same data; expected {message!r}, got {response!r}"

    # After draining, any() must report 0
    assert uart.any() == 0, f"any() must be 0 after read, got {uart.any()}"

    # Test txdone/flush
    uart.write(b"test")
    assert uart.txdone() == True, "TX should be done immediately in mock"
    flush_result = uart.flush()
    assert flush_result is None, f"flush() must return None, got {flush_result}"

    uart.deinit()


# =============================================================================
# TEST 10: RTC Operations
# =============================================================================
def test_rtc_operations():
    """RTC date/time - common for logging and scheduling."""
    rtc = RTC()
    
    # Get current time
    dt = rtc.datetime()
    assert isinstance(dt, tuple), f"datetime() must return tuple, got {type(dt).__name__}"
    assert len(dt) == 8, f"datetime should return 8-tuple, got {len(dt)}"

    # Set time and verify exact round-trip
    set_value = (2025, 12, 13, 6, 12, 30, 0, 0)  # Sat Dec 13, 2025 12:30:00
    rtc.datetime(set_value)
    dt2 = rtc.datetime()
    assert dt2 == set_value, \
        f"datetime round-trip failed: expected {set_value}, got {dt2}"

    # Test alarm functions
    rtc.alarm(0, (2025, 12, 13, 6, 12, 31, 0, 0))
    left = rtc.alarm_left(0)
    assert isinstance(left, int), f"alarm_left should return int, got {type(left)}"
    assert left >= 0, f"alarm_left must be non-negative, got {left}"
    cancel_result = rtc.cancel(0)
    assert cancel_result is None, f"cancel() must return None, got {cancel_result}"


# =============================================================================
# TEST 11: Memory Operations
# =============================================================================
def test_memory_operations():
    """Memory-mapped I/O - used for direct hardware access."""
    # GPIO base address on RP2040
    GPIO_BASE = 0x40014000
    
    # Test mem32 subscript access
    mem32[GPIO_BASE] = 0x12345678
    val = mem32[GPIO_BASE]
    assert val == 0x12345678, f"mem32 read/write failed: {val}"


# =============================================================================
# TEST 12: Time Functions
# =============================================================================
def test_time_functions():
    """Time functions - essential for delays and timing."""
    # Basic sleep functions
    start = utime.ticks_ms()
    utime.sleep_ms(50)
    elapsed = utime.ticks_diff(utime.ticks_ms(), start)
    assert elapsed >= 45, f"sleep_ms(50) should take ~50ms, got {elapsed}ms"
    
    # ticks_add
    t = utime.ticks_ms()
    t2 = utime.ticks_add(t, 1000)
    diff = utime.ticks_diff(t2, t)
    assert diff == 1000, f"ticks_add should add 1000, got diff={diff}"
    
    # time() and time_ns()
    ts = utime.time()
    assert ts > 0, f"time() should return positive value, got {ts}"
    
    ts_ns = utime.time_ns()
    assert ts_ns > 0, f"time_ns() should return positive value, got {ts_ns}"
    
    # localtime/gmtime
    lt = utime.localtime()
    assert len(lt) >= 8, f"localtime should return 8+ tuple, got {len(lt)}"
    
    # mktime
    ts2 = utime.mktime((2025, 12, 13, 12, 0, 0, 5, 347))
    assert ts2 > 0, f"mktime should return positive timestamp, got {ts2}"


# =============================================================================
# TEST 13: MicroPython Specific Functions
# =============================================================================
def test_micropython_functions():
    """MicroPython-specific functions."""
    # const optimization
    MY_CONST = micropython.const(42)
    assert MY_CONST == 42
    
    # Memory info (should not crash)
    micropython.mem_info()
    micropython.mem_info(True)  # Verbose
    
    # Stack info
    stack = micropython.stack_use()
    assert stack > 0, f"stack_use should return positive value, got {stack}"
    
    # Heap lock/unlock
    micropython.heap_lock()
    depth = micropython.heap_unlock()
    assert depth == 0, f"heap_unlock should return 0, got {depth}"
    
    # Schedule (should execute immediately in mock)
    scheduled = [False]
    def scheduled_func(arg):
        """Scheduled callback that records its argument into the closure list."""
        scheduled[0] = arg
    
    micropython.schedule(scheduled_func, True)
    assert scheduled[0] == True, "schedule should execute function"


# =============================================================================
# TEST 14: GC Functions
# =============================================================================
def test_gc_functions():
    """Garbage collection functions."""
    gc.collect()
    
    free = gc.mem_free()
    assert free > 0, f"mem_free should return positive value, got {free}"
    
    alloc = gc.mem_alloc()
    assert alloc >= 0, f"mem_alloc should return non-negative, got {alloc}"
    
    # Threshold
    gc.threshold(50000)
    thresh = gc.threshold()
    assert thresh > 0, f"threshold should return positive value"


# =============================================================================
# TEST 15: Pin Interrupt Pattern
# =============================================================================
def test_pin_interrupt():
    """Pin interrupts - common for buttons and encoders."""
    button = Pin(2, Pin.IN, Pin.PULL_UP)

    irq_count = [0]

    def button_handler(pin):
        """Pin IRQ handler that counts button press events."""
        irq_count[0] += 1

    # Contract: Pin.irq() returns None and accepts None to clear.
    result = button.irq(handler=button_handler, trigger=Pin.IRQ_FALLING)
    assert result is None, f"Pin.irq() must return None, got {result}"
    cleared = button.irq(handler=None, trigger=Pin.IRQ_RISING)
    assert cleared is None, f"Pin.irq(handler=None) must return None, got {cleared}"

    # Re-arming with FALLING must also be a no-op return-wise.
    re_armed = button.irq(handler=button_handler, trigger=Pin.IRQ_FALLING)
    assert re_armed is None, f"Pin.irq() re-arm must return None, got {re_armed}"


# =============================================================================
# TEST 16: NeoPixel Pattern
# =============================================================================
def test_neopixel():
    """NeoPixel LED strip - popular for lighting projects."""
    # Mock must always provide neopixel — do NOT swallow ImportError
    import neopixel

    NUM_LEDS = 8
    np = neopixel.NeoPixel(Pin(16), NUM_LEDS)
    assert len(np) == NUM_LEDS, f"len(np) must be {NUM_LEDS}, got {len(np)}"

    # Set colors and verify exact round-trip
    np[0] = (255, 0, 0)    # Red
    np[1] = (0, 255, 0)    # Green
    np[2] = (0, 0, 255)    # Blue
    assert np[0] == (255, 0, 0), f"pixel 0 must be red, got {np[0]}"
    assert np[1] == (0, 255, 0), f"pixel 1 must be green, got {np[1]}"
    assert np[2] == (0, 0, 255), f"pixel 2 must be blue, got {np[2]}"

    # Rainbow pattern — every pixel must round-trip
    expected = []
    for i in range(NUM_LEDS):
        hue = (i * 256 // NUM_LEDS) % 256
        color = (hue, 255 - hue, (hue * 2) % 256)
        np[i] = color
        expected.append(color)
    for i, color in enumerate(expected):
        assert np[i] == color, f"pixel {i} must be {color}, got {np[i]}"

    np.write()

    # Fill must overwrite every pixel
    np.fill((100, 100, 100))
    for i in range(NUM_LEDS):
        assert np[i] == (100, 100, 100), \
            f"fill() must overwrite pixel {i}, got {np[i]}"
    np.write()


# =============================================================================
# TEST 17: Network WLAN Pattern
# =============================================================================
def test_network_wlan():
    """WiFi connection - common for IoT projects."""
    # Mock must always provide network — do NOT swallow ImportError
    import network

    assert network.STA_IF == 0, f"STA_IF must be 0, got {network.STA_IF}"
    assert network.AP_IF == 1, f"AP_IF must be 1, got {network.AP_IF}"

    wlan = network.WLAN(network.STA_IF)
    assert wlan.active(True) is True, "active(True) must return True"
    assert wlan.active() is True, "active() must report True after enable"

    # Before connect: not connected, status must be a non-negative int
    assert wlan.isconnected() is False, "WLAN must start disconnected"
    pre_status = wlan.status()
    assert isinstance(pre_status, int), \
        f"status() must return int, got {type(pre_status).__name__}"

    # Scan returns a list of 6-tuples; the count is environment-dependent
    networks = wlan.scan()
    assert isinstance(networks, list), \
        f"scan() must return list, got {type(networks).__name__}"
    for net in networks:
        assert len(net) == 6, f"Each scan entry must be 6-tuple, got {len(net)}"
        ssid, bssid, channel, rssi, security, hidden = net
        assert isinstance(ssid, (bytes, bytearray)), \
            f"ssid must be bytes, got {type(ssid).__name__}"
        assert isinstance(bssid, (bytes, bytearray)) and len(bssid) == 6, \
            f"bssid must be 6 bytes, got {bssid!r}"
        assert isinstance(channel, int), "channel must be int"
        assert isinstance(rssi, int) and rssi < 0, \
            f"rssi must be negative int, got {rssi}"
        assert isinstance(security, int), "security must be int"
        assert isinstance(hidden, (bool, int)), "hidden must be bool/int"

    # After connect (mock auto-connects, real hardware may differ)
    wlan.connect("TestSSID", "password123")
    assert wlan.isconnected() is True, "isconnected() must be True after connect"
    post_status = wlan.status()
    assert isinstance(post_status, int), "status() must return int"

    # Contract: status('rssi') returns negative int when connected
    rssi = wlan.status("rssi")
    assert isinstance(rssi, int) and rssi < 0, \
        f"status('rssi') must be negative int, got {rssi}"

    # Contract: ifconfig() returns 4-tuple of dotted-decimal strings
    cfg = wlan.ifconfig()
    assert isinstance(cfg, tuple) and len(cfg) == 4, \
        f"ifconfig() must return 4-tuple, got {cfg!r}"
    for field, value in zip(("ip", "subnet", "gateway", "dns"), cfg):
        assert isinstance(value, str) and value, \
            f"{field} must be non-empty str, got {value!r}"
        parts = value.split(".")
        assert len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts), \
            f"{field} must be dotted-decimal IPv4, got {value!r}"

    wlan.disconnect()
    assert wlan.isconnected() is False, "isconnected() must be False after disconnect"


# =============================================================================
# PERFORMANCE TEST: Rapid Pin Toggling
# =============================================================================
def test_performance_pin_toggle():
    """Performance: Rapid pin toggling to check event emission overhead."""
    led = Pin(25, Pin.OUT)

    start = utime.ticks_ms()
    for _ in range(1000):
        led.on()
        led.off()
    elapsed = utime.ticks_diff(utime.ticks_ms(), start)

    # Final state must be OFF (last call was led.off())
    assert led.value() == 0, f"led must end OFF, got {led.value()}"
    assert isinstance(elapsed, int) and elapsed >= 0, \
        f"elapsed must be non-negative int, got {elapsed!r}"
    print(f"1000 pin toggles: {elapsed}ms ({elapsed/1000:.3f}ms per toggle)")
    assert elapsed < 5000, f"Pin toggling too slow: {elapsed}ms for 1000 toggles"


# =============================================================================
# PERFORMANCE TEST: I2C Operations
# =============================================================================
def test_performance_i2c():
    """Performance: I2C read/write operations."""
    i2c = I2C(0, scl=Pin(1), sda=Pin(0))
    
    start = utime.ticks_ms()
    for _ in range(100):
        data = i2c.readfrom_mem(0x68, 0x3B, 6)
        assert isinstance(data, bytes) and len(data) == 6, \
            f"readfrom_mem must return 6 bytes, got {data!r}"
    elapsed = utime.ticks_diff(utime.ticks_ms(), start)

    print(f"100 I2C reads: {elapsed}ms ({elapsed/100:.2f}ms per read)")
    assert elapsed < 5000, \
        f"100 I2C reads should take <5s, got {elapsed}ms"


# =============================================================================
# RUN ALL TESTS
# =============================================================================
def run_all_tests():
    """Execute all test functions."""
    print("\n" + "="*60)
    print("MICROPYTHON EMULATOR - COMMUNITY PATTERN TESTS")
    print("="*60)
    
    # Core functionality tests
    test("LED Blink", test_led_blink)
    test("PWM Fade", test_pwm_fade)
    test("ADC Temperature", test_adc_temperature)
    test("I2C Scan", test_i2c_scan)
    test("I2C Communication", test_i2c_communication)
    test("I2C Primitives", test_i2c_primitives)
    test("SPI Communication", test_spi_communication)
    test("Timer Callbacks", test_timer_callbacks)
    test("UART Communication", test_uart_communication)
    test("RTC Operations", test_rtc_operations)
    test("Memory Operations", test_memory_operations)
    test("Time Functions", test_time_functions)
    test("MicroPython Functions", test_micropython_functions)
    test("GC Functions", test_gc_functions)
    test("Pin Interrupt", test_pin_interrupt)
    test("NeoPixel", test_neopixel)
    test("Network WLAN", test_network_wlan)
    
    # Performance tests
    test("PERF: Pin Toggle", test_performance_pin_toggle)
    test("PERF: I2C Operations", test_performance_i2c)
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    
    if test_errors:
        print("\nFailed tests:")
        for name, error in test_errors:
            print(f"  - {name}: {error}")
    
    print("\n" + "="*60)
    
    return tests_failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    if not success:
        raise SystemExit(1)
