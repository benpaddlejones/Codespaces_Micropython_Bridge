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
    
    # Test init() method
    pwm.init(freq=500, duty_u16=32768)
    assert pwm.freq() == 500, f"Freq should be 500, got {pwm.freq()}"
    
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
    
    # Write to device
    result = i2c.writeto(MPU6050_ADDR, bytes([WHO_AM_I_REG]))
    assert result == 1, f"writeto should return bytes written, got {result}"
    
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
    assert acks >= 0, "write() should return ACK count"
    
    buf = bytearray(2)
    i2c.readinto(buf)
    i2c.stop()
    
    # Vectored write
    nbytes = i2c.writevto(0x68, [bytes([0x3B]), bytes([0x00, 0x01])])
    assert nbytes == 3, f"writevto should return total bytes, got {nbytes}"


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
    spi.write(bytes([0x9F]))  # Read ID command (common for flash chips)
    response = spi.read(3)
    cs.value(1)  # Deselect
    
    assert len(response) == 3, f"Should read 3 bytes, got {len(response)}"
    
    # Write-readinto pattern
    write_buf = bytes([0x03, 0x00, 0x00, 0x00])  # Read command
    read_buf = bytearray(4)
    spi.write_readinto(write_buf, read_buf)
    
    spi.deinit()


# =============================================================================
# TEST 8: Timer Callbacks (Interrupt-driven patterns)
# =============================================================================
def test_timer_callbacks():
    """Timer callbacks - common for periodic tasks."""
    counter = [0]  # Use list for mutable closure
    
    def tick(t):
        counter[0] += 1
    
    timer = Timer()
    timer.init(freq=10, mode=Timer.PERIODIC, callback=tick)
    
    # Let timer run briefly
    utime.sleep_ms(250)
    timer.deinit()
    
    # Counter may or may not increment in mock (depends on implementation)
    print(f"Timer ticks: {counter[0]}")
    
    # Test timer value
    timer2 = Timer(1)
    timer2.init(freq=1, mode=Timer.ONE_SHOT, callback=tick)
    val = timer2.value()
    assert isinstance(val, int), f"Timer.value() should return int, got {type(val)}"
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
    assert bytes_written == len(message), f"Should write {len(message)} bytes"
    
    # With loopback, data should be available to read
    utime.sleep_ms(10)  # Small delay for loopback
    
    if uart.any() > 0:
        response = uart.read()
        assert response == message, "Loopback should return same data"
    
    # Test txdone/flush
    uart.write(b"test")
    assert uart.txdone() == True, "TX should be done immediately in mock"
    uart.flush()  # Should not block
    
    uart.deinit()


# =============================================================================
# TEST 10: RTC Operations
# =============================================================================
def test_rtc_operations():
    """RTC date/time - common for logging and scheduling."""
    rtc = RTC()
    
    # Get current time
    dt = rtc.datetime()
    assert len(dt) == 9 or len(dt) == 8, f"datetime should return 8-9 tuple, got {len(dt)}"
    
    # Set time
    rtc.datetime((2025, 12, 13, 6, 12, 30, 0, 0))  # Sat Dec 13, 2025 12:30:00
    
    # Test alarm functions
    rtc.alarm(0, (2025, 12, 13, 6, 12, 31, 0, 0))
    left = rtc.alarm_left(0)
    assert isinstance(left, int), f"alarm_left should return int, got {type(left)}"
    rtc.cancel(0)


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
        irq_count[0] += 1
    
    # Set up interrupt
    button.irq(handler=button_handler, trigger=Pin.IRQ_FALLING)
    
    # In real hardware, button press would trigger
    # In mock, we just verify setup doesn't crash
    print(f"Button IRQ configured on pin {button._id}")


# =============================================================================
# TEST 16: NeoPixel Pattern
# =============================================================================
def test_neopixel():
    """NeoPixel LED strip - popular for lighting projects."""
    try:
        import neopixel
        
        NUM_LEDS = 8
        np = neopixel.NeoPixel(Pin(16), NUM_LEDS)
        
        # Set colors
        np[0] = (255, 0, 0)    # Red
        np[1] = (0, 255, 0)    # Green
        np[2] = (0, 0, 255)    # Blue
        
        # Rainbow pattern
        for i in range(NUM_LEDS):
            hue = (i * 256 // NUM_LEDS) % 256
            np[i] = (hue, 255 - hue, (hue * 2) % 256)
        
        np.write()
        
        # Fill all with one color
        np.fill((100, 100, 100))
        np.write()
        
    except ImportError:
        print("NeoPixel module not available")


# =============================================================================
# TEST 17: Network WLAN Pattern
# =============================================================================
def test_network_wlan():
    """WiFi connection - common for IoT projects."""
    try:
        import network
        
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        
        # Scan for networks
        networks = wlan.scan()
        print(f"Networks found: {len(networks)}")
        
        # Check connection status
        connected = wlan.isconnected()
        print(f"Connected: {connected}")
        
        # Get status
        status = wlan.status()
        print(f"Status: {status}")
        
    except ImportError:
        print("Network module not available")


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
        i2c.readfrom_mem(0x68, 0x3B, 6)
    elapsed = utime.ticks_diff(utime.ticks_ms(), start)
    
    print(f"100 I2C reads: {elapsed}ms ({elapsed/100:.2f}ms per read)")


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
