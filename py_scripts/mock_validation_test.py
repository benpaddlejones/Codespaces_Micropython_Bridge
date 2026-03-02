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


def test_machine_pin_input():
    """Test digital input pin configurations and reading."""
    from machine import Pin
    
    print("  Testing digital input modes...")
    
    # Test Pin.IN (floating input)
    pin_floating = Pin(10, Pin.IN)
    val = pin_floating.value()
    assert isinstance(val, int), "Pin.value() should return int"
    assert val in (0, 1), f"Pin value should be 0 or 1, got {val}"
    print(f"    GP10 (IN): {val}")
    
    # Test Pin.IN with PULL_UP
    pin_pullup = Pin(11, Pin.IN, Pin.PULL_UP)
    val = pin_pullup.value()
    assert isinstance(val, int), "Pin.value() should return int"
    assert val in (0, 1), f"Pin value should be 0 or 1, got {val}"
    print(f"    GP11 (PULL_UP): {val}")
    
    # Test Pin.IN with PULL_DOWN
    pin_pulldown = Pin(12, Pin.IN, Pin.PULL_DOWN)
    val = pin_pulldown.value()
    assert isinstance(val, int), "Pin.value() should return int"
    assert val in (0, 1), f"Pin value should be 0 or 1, got {val}"
    print(f"    GP12 (PULL_DOWN): {val}")
    
    # Test reading multiple times (should emit pin_update events with mode=IN)
    print("  Testing multiple reads...")
    for i in range(3):
        _ = pin_floating.value()
        _ = pin_pullup.value()
        _ = pin_pulldown.value()
    print("    3 read cycles completed")
    
    # Test init() method to change pin mode
    print("  Testing pin.init() mode change...")
    test_pin = Pin(13, Pin.OUT)
    test_pin.value(1)
    assert test_pin.value() == 1
    test_pin.init(mode=Pin.IN, pull=Pin.PULL_UP)
    # After init to input, read should work
    val = test_pin.value()
    assert val in (0, 1)
    print(f"    GP13 changed to INPUT: {val}")
    
    print("  All digital input tests passed!")


def test_machine_pwm():
    """Test machine.PWM class."""
    from machine import Pin, PWM
    
    pwm = PWM(Pin(15))
    
    pwm.freq(1000)
    assert pwm.freq() == 1000
    
    pwm.duty_u16(32768)
    assert pwm.duty_u16() == 32768
    
    # Test duty_ns: with freq=1000, period=1_000_000ns
    # Setting duty_ns(500000) -> _duty_u16 = (500000 * 65535) // 1_000_000 = 32767
    # Getting duty_ns() -> (32767 * 1_000_000) // 65535 = 499992
    pwm.duty_ns(500000)
    ns_val = pwm.duty_ns()
    assert isinstance(ns_val, int)
    assert 499000 <= ns_val <= 501000, \
        f"duty_ns should be ~500000 (accounting for integer rounding), got {ns_val}"
    
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
    
    # Scan should return a list of device addresses
    devices = i2c.scan()
    assert isinstance(devices, list), f"scan() should return list, got {type(devices)}"
    for addr in devices:
        assert isinstance(addr, int), f"Device address should be int, got {type(addr)}"
    
    # Read/Write
    i2c.writeto(0x68, bytes([0x75]))
    data = i2c.readfrom(0x68, 1)
    assert isinstance(data, bytes), f"readfrom() should return bytes, got {type(data)}"
    assert len(data) == 1
    
    # Memory operations
    i2c.writeto_mem(0x68, 0x6B, bytes([0x00]))
    data = i2c.readfrom_mem(0x68, 0x75, 1)
    assert isinstance(data, bytes), f"readfrom_mem() should return bytes, got {type(data)}"
    assert len(data) == 1
    
    # Low-level primitives
    i2c.start()
    i2c.stop()
    buf = bytearray(4)
    result = i2c.readinto(buf)
    assert result is None, f"readinto() should return None, got {result}"
    nacks = i2c.write(bytes([0x00]))
    assert isinstance(nacks, int), f"write() should return int (ACK count), got {type(nacks)}"
    assert nacks == 1, f"write() should return len(buf)=1, got {nacks}"


def test_machine_spi():
    """Test machine.SPI class."""
    from machine import Pin, SPI
    
    spi = SPI(0, baudrate=1000000, polarity=0, phase=0,
              sck=Pin(18), mosi=Pin(19), miso=Pin(16))
    
    # Write
    spi.write(bytes([0x01, 0x02, 0x03]))
    
    # Read should return zero-filled bytes of requested length
    data = spi.read(5)
    assert isinstance(data, bytes), f"read() should return bytes, got {type(data)}"
    assert len(data) == 5
    assert data == bytes([0] * 5), f"read() should return zeros, got {data}"
    
    # readinto should fill buffer with zeros
    buf = bytearray(4)
    result = spi.readinto(buf)
    assert result is None, f"readinto() should return None, got {result}"
    assert buf == bytearray(4), f"readinto() should zero-fill buffer, got {buf}"
    
    # write_readinto
    tx = bytes([0xAA, 0xBB])
    rx_buf = bytearray(4)
    result = spi.write_readinto(tx, rx_buf)
    assert result is None, f"write_readinto() should return None, got {result}"
    
    spi.deinit()


def test_machine_uart():
    """Test machine.UART class."""
    from machine import Pin, UART
    
    uart = UART(0, baudrate=115200, tx=Pin(0), rx=Pin(1))
    
    # Write should return number of bytes written
    written = uart.write(b"Hello UART")
    assert written == 10, f"write() should return 10 bytes written, got {written}"
    
    # With loopback enabled (default), read should return what was written
    data = uart.read(10)
    assert data == b"Hello UART", \
        f"read() should return written data via loopback, got {data}"
    
    # After reading all data, any() should return 0
    remaining = uart.any()
    assert remaining == 0, \
        f"any() should return 0 after reading all data, got {remaining}"
    
    uart.deinit()


def test_machine_timer():
    """Test machine.Timer class."""
    from machine import Timer
    
    timer = Timer()
    
    callback_count = [0]
    def tick(t):
        callback_count[0] += 1
    
    timer.init(mode=Timer.PERIODIC, period=100, callback=tick)
    
    # Timer value should return current time in ms (masked to 32-bit)
    val = timer.value()
    assert isinstance(val, int), f"Timer.value() should return int, got {type(val)}"
    assert val > 0, f"Timer.value() should be positive, got {val}"
    assert val <= 0xFFFFFFFF, f"Timer.value() should be 32-bit masked, got {val}"
    
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
    assert wdt is not None, "WDT() should return an instance"
    # feed() should not raise and should return None
    result = wdt.feed()
    assert result is None, f"feed() should return None, got {result}"


def test_machine_functions():
    """Test machine module-level functions."""
    from machine import (
        freq, reset, soft_reset, unique_id,
        idle, lightsleep, deepsleep,
        reset_cause, wake_reason,
        disable_irq, enable_irq,
        time_pulse_us, bitstream
    )
    
    # Frequency — default should be 125MHz, and set values should persist
    f = freq()
    assert f == 125_000_000, f"Default freq should be 125MHz, got {f}"
    freq(240_000_000)
    f2 = freq()
    assert f2 == 240_000_000, f"freq() should return set value 240MHz, got {f2}"
    freq(125_000_000)  # Restore default
    
    # Unique ID should be exactly 8 bytes
    uid = unique_id()
    assert isinstance(uid, bytes), f"unique_id() should return bytes, got {type(uid)}"
    assert len(uid) == 8
    assert uid == b'\x00\x01\x02\x03\x04\x05\x06\x07', \
        f"unique_id() should return mock ID, got {uid}"
    
    # Reset cause should be PWRON_RESET (1)
    cause = reset_cause()
    assert cause == 1, f"reset_cause() should return 1 (PWRON_RESET), got {cause}"
    
    # Wake reason should be PIN_WAKE (2)
    reason = wake_reason()
    assert reason == 2, f"wake_reason() should return 2 (PIN_WAKE), got {reason}"
    
    # IRQ control
    state = disable_irq()
    assert isinstance(state, int), f"disable_irq() should return int (IRQ state), got {type(state)}"
    enable_irq(state)
    
    # Time pulse (returns random 100-1000)
    from machine import Pin
    pulse = time_pulse_us(Pin(0), 1, 1000)
    assert isinstance(pulse, int)
    assert 100 <= pulse <= 1000, \
        f"time_pulse_us should return 100-1000, got {pulse}"


def test_machine_mem():
    """Test machine memory access objects."""
    from machine import mem8, mem16, mem32
    
    # Unset addresses should return 0
    val8 = mem8[0x40000000]
    assert val8 == 0, f"mem8 default should be 0, got {val8}"
    val16 = mem16[0x40000000]
    assert val16 == 0, f"mem16 default should be 0, got {val16}"
    val32 = mem32[0x40000000]
    assert val32 == 0, f"mem32 default should be 0, got {val32}"
    
    # Write and read back
    mem8[0x40000000] = 0xFF
    assert mem8[0x40000000] == 0xFF, \
        f"mem8 should read back 0xFF, got {mem8[0x40000000]}"
    mem16[0x40000000] = 0xFFFF
    assert mem16[0x40000000] == 0xFFFF, \
        f"mem16 should read back 0xFFFF, got {mem16[0x40000000]}"
    mem32[0x40000000] = 0xFFFFFFFF
    assert mem32[0x40000000] == 0xFFFFFFFF, \
        f"mem32 should read back 0xFFFFFFFF, got {mem32[0x40000000]}"


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
    
    # Tick arithmetic — ticks_diff handles 30-bit wraparound
    diff = utime.ticks_diff(utime.ticks_ms(), ms)
    assert isinstance(diff, int)
    assert diff >= 0, f"ticks_diff should be non-negative for forward time, got {diff}"

    # Verify wraparound: simulate ticks1 < ticks2 numerically but logically ahead
    TICKS_MAX = (1 << 30) - 1
    t1 = 10           # wrapped around past zero
    t2 = TICKS_MAX - 5  # just before wrap
    wrap_diff = utime.ticks_diff(t1, t2)
    assert wrap_diff == 16, \
        f"ticks_diff should handle wraparound (expected 16, got {wrap_diff})"

    add = utime.ticks_add(ms, 1000)
    assert isinstance(add, int)
    assert 0 <= add <= TICKS_MAX, \
        f"ticks_add should stay in 30-bit range, got {add}"

    # Verify ticks_add wraps at 30 bits
    wrapped = utime.ticks_add(TICKS_MAX, 1)
    assert wrapped == 0, \
        f"ticks_add(TICKS_MAX, 1) should wrap to 0, got {wrapped}"
    
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
    
    # Memory info (prints to stdout, returns None)
    result = micropython.mem_info()
    assert result is None, f"mem_info() should return None, got {result}"
    result = micropython.qstr_info()
    assert result is None, f"qstr_info() should return None, got {result}"
    
    # stack_use returns mock value 1984
    stack = micropython.stack_use()
    assert stack == 1984, f"stack_use() should return 1984, got {stack}"
    
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
    
    # Opt level always returns 0
    level = micropython.opt_level()
    assert level == 0, f"opt_level() should return 0, got {level}"


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
    
    # Memory functions return specific mock values
    alloc = gc.mem_alloc()
    assert alloc == 50000, f"mem_alloc() should return 50000, got {alloc}"
    
    free = gc.mem_free()
    assert free == 190000, f"mem_free() should return 190000, got {free}"
    
    # Threshold should not raise
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
    
    # get(), tx_fifo(), rx_fifo() all return 0 in mock
    val = sm.get()
    assert val == 0, f"sm.get() should return 0, got {val}"
    tx = sm.tx_fifo()
    assert tx == 0, f"sm.tx_fifo() should return 0, got {tx}"
    rx = sm.rx_fifo()
    assert rx == 0, f"sm.rx_fifo() should return 0, got {rx}"
    
    sm.active(0)
    assert sm.active() == 0, "sm.active(0) should deactivate"


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
    assert np[1] == (0, 255, 0), f"Pixel 1 should be green, got {np[1]}"
    assert np[2] == (0, 0, 255), f"Pixel 2 should be blue, got {np[2]}"
    
    # Fill and verify all pixels changed
    np.fill((100, 100, 100))
    for i in range(8):
        assert np[i] == (100, 100, 100), \
            f"Pixel {i} should be (100,100,100) after fill, got {np[i]}"
    
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
    
    # Status should be STAT_GOT_IP (3) when connected
    status = wlan.status()
    assert status == 3, f"status() should be 3 (STAT_GOT_IP) when connected, got {status}"
    
    # RSSI status
    rssi = wlan.status("rssi")
    assert rssi == -50, f"status('rssi') should be -50, got {rssi}"
    
    # IP config should return 4-tuple of strings
    config = wlan.ifconfig()
    assert len(config) == 4
    assert config[0] == "192.168.1.100", \
        f"IP should be 192.168.1.100, got {config[0]}"
    for item in config:
        assert isinstance(item, str), f"ifconfig elements should be strings, got {type(item)}"
    
    # Scan should return list of network tuples
    networks = wlan.scan()
    assert isinstance(networks, list)
    assert len(networks) >= 1, f"scan() should return at least 1 network, got {len(networks)}"
    # Each network should have 6 elements: (ssid, bssid, channel, rssi, security, hidden)
    for net in networks:
        assert len(net) == 6, f"Network tuple should have 6 elements, got {len(net)}"
    
    wlan.disconnect()
    assert wlan.isconnected() == False, \
        "Should be disconnected after disconnect()"


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
    # sys should have MicroPython-specific attributes with real values
    assert hasattr(sys, 'implementation')
    assert hasattr(sys, 'platform')
    assert isinstance(sys.platform, str), \
        f"sys.platform should be a string, got {type(sys.platform)}"
    assert len(sys.platform) > 0, "sys.platform should not be empty"
    assert hasattr(sys, 'version')
    assert isinstance(sys.version, str), \
        f"sys.version should be a string, got {type(sys.version)}"
    # print_exception should exist (patched by runner.py)
    assert hasattr(sys, 'print_exception'), \
        "sys should have print_exception (MicroPython-specific)"


# =============================================================================
# uhashlib MODULE TESTS
# =============================================================================

def test_uhashlib():
    """Test uhashlib module (sha256, sha1, md5)."""
    import uhashlib

    # SHA256
    h = uhashlib.sha256(b"hello")
    digest = h.digest()
    assert isinstance(digest, bytes), "digest() should return bytes"
    assert len(digest) == 32, f"SHA256 digest should be 32 bytes, got {len(digest)}"

    # SHA1
    h = uhashlib.sha1(b"hello")
    digest = h.digest()
    assert isinstance(digest, bytes), "digest() should return bytes"
    assert len(digest) == 20, f"SHA1 digest should be 20 bytes, got {len(digest)}"

    # MD5
    h = uhashlib.md5(b"hello")
    digest = h.digest()
    assert isinstance(digest, bytes), "digest() should return bytes"
    assert len(digest) == 16, f"MD5 digest should be 16 bytes, got {len(digest)}"

    # Incremental hashing
    h = uhashlib.sha256()
    h.update(b"hel")
    h.update(b"lo")
    digest_inc = h.digest()
    h2 = uhashlib.sha256(b"hello")
    assert digest_inc == h2.digest(), "Incremental hash should match one-shot"


# =============================================================================
# uio MODULE TESTS
# =============================================================================

def test_uio():
    """Test uio module (StringIO, BytesIO)."""
    import uio

    # StringIO
    sio = uio.StringIO()
    sio.write("hello world")
    assert sio.getvalue() == "hello world"

    sio2 = uio.StringIO("initial")
    assert sio2.getvalue() == "initial"

    # BytesIO
    bio = uio.BytesIO()
    bio.write(b"\x01\x02\x03")
    assert bio.getvalue() == b"\x01\x02\x03"

    bio2 = uio.BytesIO(b"data")
    assert bio2.getvalue() == b"data"

    # open should be available
    assert hasattr(uio, 'open'), "uio should have open function"


# =============================================================================
# ujson MODULE TESTS
# =============================================================================

def test_ujson():
    """Test ujson module (dumps, loads)."""
    import ujson

    # dumps
    result = ujson.dumps({"key": "value", "num": 42})
    assert isinstance(result, str), "dumps should return a string"
    assert "key" in result
    assert "42" in result

    # loads
    obj = ujson.loads('{"a": 1, "b": [2, 3]}')
    assert obj["a"] == 1
    assert obj["b"] == [2, 3]

    # Round-trip
    original = {"list": [1, 2, 3], "nested": {"x": True}}
    assert ujson.loads(ujson.dumps(original)) == original

    # dumps with various types
    assert ujson.dumps(None) == "null"
    assert ujson.dumps(True) == "true"
    assert ujson.dumps(False) == "false"


# =============================================================================
# uos MODULE TESTS
# =============================================================================

def test_uos():
    """Test uos module (listdir, ilistdir, stat)."""
    import uos

    # listdir
    entries = uos.listdir(".")
    assert isinstance(entries, list), "listdir should return a list"
    assert len(entries) > 0, "Current directory should have entries"

    # ilistdir (MicroPython-specific)
    assert hasattr(uos, 'ilistdir'), "uos should have ilistdir"
    items = list(uos.ilistdir("."))
    assert len(items) > 0, "ilistdir should yield entries"
    # Each item should be a 3-tuple: (name, type, size)
    for name, ftype, size in items:
        assert isinstance(name, str), "Entry name should be a string"
        assert ftype in (0x4000, 0x8000), f"Type should be dir (0x4000) or file (0x8000), got {hex(ftype)}"
        assert isinstance(size, int), "Size should be an int"

    # getcwd
    cwd = uos.getcwd()
    assert isinstance(cwd, str), "getcwd should return a string"
    assert len(cwd) > 0, "cwd should not be empty"

    # stat should return a full stat result (10 fields)
    st = uos.stat(".")
    assert len(st) == 10, f"stat should return 10 fields, got {len(st)}"

    # dupterm (stub)
    assert hasattr(uos, 'dupterm'), "uos should have dupterm"


# =============================================================================
# ure MODULE TESTS
# =============================================================================

def test_ure():
    """Test ure module (compile, match, search, sub, split)."""
    import ure

    # compile
    pattern = ure.compile(r"\d+")
    assert pattern is not None, "compile should return a pattern object"

    # search
    m = ure.search(r"\d+", "abc123def")
    assert m is not None, "search should find digits"
    assert m.group(0) == "123", f"Should match '123', got '{m.group(0)}'"

    # match (anchored at start)
    m = ure.match(r"\d+", "123abc")
    assert m is not None, "match should find digits at start"
    assert m.group(0) == "123"

    m2 = ure.match(r"\d+", "abc123")
    assert m2 is None, "match should not find digits not at start"

    # sub
    result = ure.sub(r"\d", "X", "a1b2c3")
    assert result == "aXbXcX", f"sub should replace digits, got '{result}'"

    # split
    parts = ure.split(r"[,;]", "a,b;c,d")
    assert parts == ["a", "b", "c", "d"], f"split should separate, got {parts}"


# =============================================================================
# usocket MODULE TESTS
# =============================================================================

def test_usocket():
    """Test usocket module (constants and basic API)."""
    import usocket

    # Constants should exist
    assert hasattr(usocket, 'AF_INET'), "Should have AF_INET"
    assert hasattr(usocket, 'SOCK_STREAM'), "Should have SOCK_STREAM"
    assert hasattr(usocket, 'SOCK_DGRAM'), "Should have SOCK_DGRAM"
    assert hasattr(usocket, 'SOL_SOCKET'), "Should have SOL_SOCKET"

    # getaddrinfo
    assert hasattr(usocket, 'getaddrinfo'), "Should have getaddrinfo"

    # socket class
    assert hasattr(usocket, 'socket'), "Should have socket class"

    # Create a socket (non-blocking to avoid hanging)
    sock = usocket.socket(usocket.AF_INET, usocket.SOCK_STREAM)
    assert sock is not None, "Should create a socket"
    sock.close()


# =============================================================================
# uzlib MODULE TESTS
# =============================================================================

def test_uzlib():
    """Test uzlib module (decompress, DecompIO)."""
    import uzlib
    import zlib

    # Compress some data with standard zlib for testing
    original = b"hello world, this is a test of uzlib decompression"
    compressed = zlib.compress(original)

    # decompress
    result = uzlib.decompress(compressed)
    assert result == original, f"Decompressed data should match original"

    # DecompIO - streaming decompression
    assert hasattr(uzlib, 'DecompIO'), "Should have DecompIO class"

    import uio
    stream = uio.BytesIO(compressed)
    decomp = uzlib.DecompIO(stream)
    data = decomp.read()
    assert data == original, "DecompIO should decompress correctly"

    # readinto
    stream2 = uio.BytesIO(compressed)
    decomp2 = uzlib.DecompIO(stream2)
    buf = bytearray(len(original))
    n = decomp2.readinto(buf)
    assert buf[:n] == original, "readinto should work correctly"


# =============================================================================
# time MODULE NOTE
# =============================================================================
# The mock time.py (alias for utime) exists but cannot override CPython's
# built-in C time module via sys.path. Scripts should use `import utime`
# instead. The utime module is fully tested above.


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
    run_test("machine.Pin Input", test_machine_pin_input)
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
    
    # Previously untested modules
    run_test("uhashlib", test_uhashlib)
    run_test("uio", test_uio)
    run_test("ujson", test_ujson)
    run_test("uos", test_uos)
    run_test("ure", test_ure)
    run_test("usocket", test_usocket)
    run_test("uzlib", test_uzlib)
    
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
