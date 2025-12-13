"""
MicroPython Mock Validation Test Suite
======================================
This test exercises all major mock module functions to ensure they work correctly.
Run after any mock changes: python3 .extension/emulator/mock/runner.py py_scripts/mock_validation_test.py

If a test fails, FIX THE MOCK - do NOT modify this test to hide failures.
"""

import sys

# Track test results
_passed = 0
_failed = 0
_errors = []


def run_test(name: str, test_fn):
    """Run a single test and track results."""
    global _passed, _failed
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    try:
        test_fn()
        print(f"✅ PASSED: {name}")
        _passed += 1
    except Exception as e:
        print(f"❌ FAILED: {name}")
        print(f"   Error: {e}")
        _failed += 1
        _errors.append((name, str(e)))


# =============================================================================
# machine MODULE TESTS
# =============================================================================

def test_machine_pin():
    """Test machine.Pin class and methods."""
    from machine import Pin
    
    # Pin modes - verify constants exist (actual values may vary by port)
    assert hasattr(Pin, 'IN')
    assert hasattr(Pin, 'OUT')
    assert hasattr(Pin, 'PULL_UP')
    assert hasattr(Pin, 'PULL_DOWN')
    
    # Create pins
    led = Pin(25, Pin.OUT)
    button = Pin(14, Pin.IN, Pin.PULL_UP)
    
    # Toggle methods
    led.on()
    assert led.value() == 1
    led.off()
    assert led.value() == 0
    led.toggle()
    assert led.value() == 1
    
    # IRQ
    def callback(pin):
        pass
    led.irq(handler=callback, trigger=1)  # 1 = rising edge


def test_machine_pwm():
    """Test machine.PWM class."""
    from machine import Pin, PWM
    
    pwm = PWM(Pin(15))
    
    pwm.freq(1000)
    assert pwm.freq() == 1000
    
    pwm.duty_u16(32768)
    assert pwm.duty_u16() == 32768
    
    # Test duty_ns
    pwm.duty_ns(500000)
    # Note: duty_ns returns calculated value based on freq
    ns_val = pwm.duty_ns()
    assert isinstance(ns_val, int)
    
    pwm.deinit()


def test_machine_adc():
    """Test machine.ADC class."""
    from machine import ADC
    
    adc = ADC(26)
    
    reading = adc.read_u16()
    assert 0 <= reading <= 65535
    
    reading_12bit = adc.read()
    assert 0 <= reading_12bit <= 4095
    
    voltage = adc.read_uv()
    assert 0 <= voltage <= 3_300_000


def test_machine_i2c():
    """Test machine.I2C class."""
    from machine import Pin, I2C
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    
    # Scan
    devices = i2c.scan()
    assert isinstance(devices, list)
    
    # Read/Write
    i2c.writeto(0x68, bytes([0x75]))
    data = i2c.readfrom(0x68, 1)
    assert len(data) == 1
    
    # Memory operations
    i2c.writeto_mem(0x68, 0x6B, bytes([0x00]))
    data = i2c.readfrom_mem(0x68, 0x75, 1)
    assert len(data) == 1
    
    # Low-level primitives
    i2c.start()
    i2c.stop()
    buf = bytearray(4)
    i2c.readinto(buf)
    i2c.write(bytes([0x00]))


def test_machine_spi():
    """Test machine.SPI class."""
    from machine import Pin, SPI
    
    spi = SPI(0, baudrate=1000000, polarity=0, phase=0,
              sck=Pin(18), mosi=Pin(19), miso=Pin(16))
    
    # Write
    spi.write(bytes([0x01, 0x02, 0x03]))
    
    # Read
    data = spi.read(5)
    assert len(data) == 5
    
    # Read/write
    buf = bytearray(4)
    spi.readinto(buf)
    
    tx = bytes([0xAA, 0xBB])
    rx = spi.write_readinto(tx, buf)
    
    spi.deinit()


def test_machine_uart():
    """Test machine.UART class."""
    from machine import Pin, UART
    
    uart = UART(0, baudrate=115200, tx=Pin(0), rx=Pin(1))
    
    uart.write(b"Hello UART")
    
    data = uart.read(10)
    
    assert uart.any() >= 0
    
    uart.deinit()


def test_machine_timer():
    """Test machine.Timer class."""
    from machine import Timer
    
    timer = Timer()
    
    callback_count = [0]
    def tick(t):
        callback_count[0] += 1
    
    timer.init(mode=Timer.PERIODIC, period=100, callback=tick)
    
    # Timer value
    val = timer.value()
    assert isinstance(val, int)
    
    timer.deinit()


def test_machine_rtc():
    """Test machine.RTC class."""
    from machine import RTC
    
    rtc = RTC()
    
    # Set datetime
    rtc.datetime((2025, 12, 13, 5, 10, 30, 0, 0))
    
    # Get datetime
    dt = rtc.datetime()
    assert len(dt) == 8
    assert dt[0] == 2025
    
    # Alarm methods (stubs)
    rtc.alarm(0, (2025, 12, 13, 12, 0, 0, 0, 0))
    rtc.alarm_left(0)
    rtc.cancel(0)


def test_machine_wdt():
    """Test machine.WDT class."""
    from machine import WDT
    
    wdt = WDT(timeout=5000)
    wdt.feed()


def test_machine_functions():
    """Test machine module-level functions."""
    from machine import (
        freq, reset, soft_reset, unique_id,
        idle, lightsleep, deepsleep,
        reset_cause, wake_reason,
        disable_irq, enable_irq,
        time_pulse_us, bitstream
    )
    
    # Frequency
    f = freq()
    assert f > 0
    freq(125_000_000)
    
    # Unique ID
    uid = unique_id()
    assert len(uid) == 8
    
    # Reset cause
    cause = reset_cause()
    assert isinstance(cause, int)
    
    # Wake reason
    reason = wake_reason()
    assert isinstance(reason, int)
    
    # IRQ control
    state = disable_irq()
    enable_irq(state)
    
    # Time pulse (returns mock value)
    from machine import Pin
    pulse = time_pulse_us(Pin(0), 1, 1000)
    assert isinstance(pulse, int)


def test_machine_mem():
    """Test machine memory access objects."""
    from machine import mem8, mem16, mem32
    
    # These are mock objects that allow index access
    val8 = mem8[0x40000000]
    val16 = mem16[0x40000000]
    val32 = mem32[0x40000000]
    
    mem8[0x40000000] = 0xFF
    mem16[0x40000000] = 0xFFFF
    mem32[0x40000000] = 0xFFFFFFFF


# =============================================================================
# utime MODULE TESTS
# =============================================================================

def test_utime():
    """Test utime module functions."""
    import utime
    
    # Time functions
    t = utime.time()
    assert isinstance(t, int)
    
    ms = utime.ticks_ms()
    assert isinstance(ms, int)
    
    us = utime.ticks_us()
    assert isinstance(us, int)
    
    # Tick arithmetic
    diff = utime.ticks_diff(utime.ticks_ms(), ms)
    assert isinstance(diff, int)
    
    add = utime.ticks_add(ms, 1000)
    assert isinstance(add, int)
    
    # Sleep (short durations for test)
    utime.sleep_ms(1)
    utime.sleep_us(100)
    
    # Local time
    lt = utime.localtime()
    assert len(lt) == 8
    
    # Make time
    timestamp = utime.mktime((2025, 12, 13, 10, 30, 0, 5, 347))
    assert isinstance(timestamp, int)


# =============================================================================
# micropython MODULE TESTS
# =============================================================================

def test_micropython():
    """Test micropython module functions."""
    import micropython
    
    # const decorator
    MY_CONST = micropython.const(42)
    assert MY_CONST == 42
    
    # Decorators (should be no-ops in mock)
    @micropython.native
    def native_func():
        return 1
    assert native_func() == 1
    
    @micropython.viper
    def viper_func():
        return 2
    assert viper_func() == 2
    
    # Memory info (stubs)
    micropython.mem_info()
    micropython.qstr_info()
    micropython.stack_use()
    
    # Heap management
    micropython.heap_lock()
    micropython.heap_unlock()
    
    # Schedule
    def scheduled(arg):
        pass
    micropython.schedule(scheduled, None)
    
    # Keyboard interrupt
    micropython.kbd_intr(3)
    
    # Alloc emergency buffer
    micropython.alloc_emergency_exception_buf(100)
    
    # Opt level
    micropython.opt_level(0)


# =============================================================================
# gc MODULE TESTS
# =============================================================================

def test_gc():
    """Test gc module functions."""
    import gc
    
    gc.collect()
    gc.enable()
    gc.disable()
    gc.enable()  # Re-enable
    
    assert gc.isenabled() == True
    
    # Memory functions
    alloc = gc.mem_alloc()
    assert isinstance(alloc, int)
    
    free = gc.mem_free()
    assert isinstance(free, int)
    
    # Threshold
    gc.threshold(50000)


# =============================================================================
# rp2 MODULE TESTS
# =============================================================================

def test_rp2():
    """Test rp2 module (RP2040-specific)."""
    import rp2
    from rp2 import PIO, StateMachine
    
    # PIO constants
    assert hasattr(PIO, 'IN_LOW')
    assert hasattr(PIO, 'OUT_LOW')
    assert hasattr(PIO, 'SHIFT_LEFT')
    
    # Create PIO and StateMachine
    pio = PIO(0)
    sm = StateMachine(0, None, freq=2000)
    
    # StateMachine methods
    sm.active(1)
    assert sm.active() == 1
    sm.restart()
    sm.exec(0)
    sm.put(0x1234)
    sm.get()
    sm.tx_fifo()
    sm.rx_fifo()
    sm.active(0)


# =============================================================================
# neopixel MODULE TESTS
# =============================================================================

def test_neopixel():
    """Test neopixel module."""
    from neopixel import NeoPixel
    from machine import Pin
    
    np = NeoPixel(Pin(16), 8)
    
    # Set pixel colors
    np[0] = (255, 0, 0)
    np[1] = (0, 255, 0)
    np[2] = (0, 0, 255)
    
    # Read back
    assert np[0] == (255, 0, 0)
    
    # Fill
    np.fill((100, 100, 100))
    
    # Write to strip
    np.write()
    
    # Length
    assert len(np) == 8


# =============================================================================
# network MODULE TESTS
# =============================================================================

def test_network():
    """Test network module."""
    import network
    
    # WLAN constants
    assert network.STA_IF == 0
    assert network.AP_IF == 1
    
    # Create WLAN
    wlan = network.WLAN(network.STA_IF)
    
    wlan.active(True)
    assert wlan.active() == True
    
    wlan.connect("TestNetwork", "password123")
    assert wlan.isconnected() == True
    
    # Status
    status = wlan.status()
    assert isinstance(status, int)
    
    # IP config
    config = wlan.ifconfig()
    assert len(config) == 4
    
    # Scan
    networks = wlan.scan()
    assert isinstance(networks, list)
    
    wlan.disconnect()


# =============================================================================
# uctypes MODULE TESTS
# =============================================================================

def test_uctypes():
    """Test uctypes module."""
    import uctypes
    
    assert hasattr(uctypes, 'LITTLE_ENDIAN')
    assert hasattr(uctypes, 'BIG_ENDIAN')
    assert hasattr(uctypes, 'NATIVE')
    
    assert hasattr(uctypes, 'UINT8')
    assert hasattr(uctypes, 'UINT16')
    assert hasattr(uctypes, 'UINT32')
    
    # sizeof - use type constant directly
    size = uctypes.sizeof(uctypes.UINT32)
    assert size == 4


# =============================================================================
# struct MODULE TESTS
# =============================================================================

def test_struct():
    """Test struct module."""
    import struct
    
    # Pack
    packed = struct.pack('<HH', 0x1234, 0x5678)
    assert len(packed) == 4
    
    # Unpack
    values = struct.unpack('<HH', packed)
    assert values == (0x1234, 0x5678)
    
    # Calc size
    size = struct.calcsize('<HHI')
    assert size == 8


# =============================================================================
# binascii MODULE TESTS
# =============================================================================

def test_binascii():
    """Test binascii module."""
    import binascii
    
    # Hex encode/decode
    hex_str = binascii.hexlify(b'hello')
    assert hex_str == b'68656c6c6f'
    
    original = binascii.unhexlify(hex_str)
    assert original == b'hello'
    
    # Base64 (if available)
    if hasattr(binascii, 'b2a_base64'):
        b64 = binascii.b2a_base64(b'hello')
        assert b'aGVsbG8' in b64


# =============================================================================
# array MODULE TESTS
# =============================================================================

def test_array():
    """Test array module."""
    import array
    
    # Integer array
    arr = array.array('i', [1, 2, 3, 4, 5])
    assert len(arr) == 5
    assert arr[0] == 1
    
    arr.append(6)
    assert len(arr) == 6
    
    # Byte array
    byte_arr = array.array('B', [0xFF, 0x00, 0xAA])
    assert byte_arr[0] == 0xFF


# =============================================================================
# collections MODULE TESTS
# =============================================================================

def test_collections():
    """Test collections module."""
    import collections
    
    # OrderedDict
    od = collections.OrderedDict()
    od['a'] = 1
    od['b'] = 2
    od['c'] = 3
    assert list(od.keys()) == ['a', 'b', 'c']
    
    # namedtuple
    Point = collections.namedtuple('Point', ['x', 'y'])
    p = Point(10, 20)
    assert p.x == 10
    assert p.y == 20
    
    # deque
    dq = collections.deque([1, 2, 3], maxlen=5)
    dq.append(4)
    dq.appendleft(0)
    assert len(dq) == 5


# =============================================================================
# sys MODULE TESTS
# =============================================================================

def test_sys():
    """Test sys module extensions."""
    # sys should have MicroPython-specific attributes
    assert hasattr(sys, 'implementation')
    assert hasattr(sys, 'platform')
    assert hasattr(sys, 'version')


# =============================================================================
# RUN ALL TESTS
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("MICROPYTHON MOCK VALIDATION TEST SUITE")
    print("=" * 60)
    print("Testing all major mock module functions...")
    
    # machine module
    run_test("machine.Pin", test_machine_pin)
    run_test("machine.PWM", test_machine_pwm)
    run_test("machine.ADC", test_machine_adc)
    run_test("machine.I2C", test_machine_i2c)
    run_test("machine.SPI", test_machine_spi)
    run_test("machine.UART", test_machine_uart)
    run_test("machine.Timer", test_machine_timer)
    run_test("machine.RTC", test_machine_rtc)
    run_test("machine.WDT", test_machine_wdt)
    run_test("machine functions", test_machine_functions)
    run_test("machine mem access", test_machine_mem)
    
    # Other core modules
    run_test("utime", test_utime)
    run_test("micropython", test_micropython)
    run_test("gc", test_gc)
    run_test("rp2", test_rp2)
    run_test("neopixel", test_neopixel)
    run_test("network", test_network)
    
    # Utility modules
    run_test("uctypes", test_uctypes)
    run_test("struct", test_struct)
    run_test("binascii", test_binascii)
    run_test("array", test_array)
    run_test("collections", test_collections)
    run_test("sys", test_sys)
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Passed: {_passed}")
    print(f"❌ Failed: {_failed}")
    
    if _errors:
        print("\nFailed tests:")
        for name, error in _errors:
            print(f"  - {name}: {error}")
    
    print("=" * 60)
    
    # Exit with error code if any failures
    if _failed > 0:
        sys.exit(1)
