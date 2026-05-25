"""
Emulator Performance Profiling Test
====================================
This script profiles the emulator to identify performance bottlenecks.
"""

import time

# Performance metrics
_metrics = {}


def profile(name: str):
    """Decorator to profile function execution time."""
    def decorator(func):
        """Wrap ``func`` so each invocation records timing under ``name``."""
        def wrapper(*args, **kwargs):
            """Execute the wrapped function and update the metrics table."""
            start = time.ticks_us()
            result = func(*args, **kwargs)
            elapsed = time.ticks_diff(time.ticks_us(), start) / 1000
            if name not in _metrics:
                _metrics[name] = {"calls": 0, "total_ms": 0, "min_ms": float('inf'), "max_ms": 0}
            _metrics[name]["calls"] += 1
            _metrics[name]["total_ms"] += elapsed
            _metrics[name]["min_ms"] = min(_metrics[name]["min_ms"], elapsed)
            _metrics[name]["max_ms"] = max(_metrics[name]["max_ms"], elapsed)
            return result
        return wrapper
    return decorator


def run_profile(name: str, func, iterations: int = 1000):
    """Run a function multiple times and record metrics."""
    start = time.ticks_us()
    for _ in range(iterations):
        func()
    elapsed = time.ticks_diff(time.ticks_us(), start) / 1000
    _metrics[name] = {
        "calls": iterations,
        "total_ms": elapsed,
        "min_ms": elapsed / iterations,
        "max_ms": elapsed / iterations,
        "avg_ms": elapsed / iterations,
    }
    return elapsed


def print_metrics():
    """Print performance metrics summary."""
    print("\n" + "=" * 70)
    print("PERFORMANCE METRICS")
    print("=" * 70)
    print(f"{'Test':<35} {'Calls':>8} {'Total':>10} {'Avg':>10} {'Per/s':>10}")
    print("-" * 70)
    
    for name, m in sorted(_metrics.items(), key=lambda x: -x[1]["total_ms"]):
        avg = m["total_ms"] / m["calls"] if m["calls"] > 0 else 0
        per_sec = m["calls"] / (m["total_ms"] / 1000) if m["total_ms"] > 0 else 0
        print(f"{name:<35} {m['calls']:>8} {m['total_ms']:>9.2f}ms {avg:>9.4f}ms {per_sec:>9.0f}")
    
    print("=" * 70)


# =============================================================================
# PERFORMANCE TESTS
# =============================================================================

def test_pin_toggle():
    """Profile rapid pin toggling."""
    from machine import Pin
    led = Pin(25, Pin.OUT)
    
    def toggle():
        """Drive the LED high then low once."""
        led.value(1)
        led.value(0)
    
    return run_profile("Pin toggle (on/off)", toggle, iterations=5000)


def test_pin_value_read():
    """Profile pin value reading."""
    from machine import Pin
    led = Pin(25, Pin.OUT)
    led.value(1)
    
    def read():
        """Read the pin value once."""
        _ = led.value()
    
    return run_profile("Pin value read", read, iterations=5000)


def test_pwm_duty_cycle():
    """Profile PWM duty cycle changes."""
    from machine import Pin, PWM
    pwm = PWM(Pin(15))
    pwm.freq(1000)
    
    def change_duty():
        """Set the PWM duty cycle to mid-scale."""
        pwm.duty_u16(32768)
    
    result = run_profile("PWM duty change", change_duty, iterations=2000)
    pwm.deinit()
    return result


def test_adc_read():
    """Profile ADC readings."""
    from machine import ADC
    adc = ADC(26)
    
    def read():
        """Read one 16-bit ADC sample."""
        _ = adc.read_u16()
    
    return run_profile("ADC read_u16", read, iterations=5000)


def test_i2c_scan():
    """Profile I2C bus scan."""
    from machine import Pin, I2C
    i2c = I2C(0, scl=Pin(1), sda=Pin(0))
    
    def scan():
        """Perform one I2C bus scan."""
        _ = i2c.scan()
    
    return run_profile("I2C scan", scan, iterations=500)


def test_i2c_read():
    """Profile I2C read operations."""
    from machine import Pin, I2C
    i2c = I2C(0, scl=Pin(1), sda=Pin(0))
    
    def read():
        """Read 6 bytes from I2C device 0x68."""
        _ = i2c.readfrom(0x68, 6)
    
    return run_profile("I2C readfrom (6 bytes)", read, iterations=2000)


def test_i2c_write():
    """Profile I2C write operations."""
    from machine import Pin, I2C
    i2c = I2C(0, scl=Pin(1), sda=Pin(0))
    data = bytes([0x01, 0x02, 0x03, 0x04])
    
    def write():
        """Write a 4-byte payload to I2C device 0x68."""
        i2c.writeto(0x68, data)
    
    return run_profile("I2C writeto (4 bytes)", write, iterations=2000)


def test_spi_transfer():
    """Profile SPI data transfer."""
    from machine import Pin, SPI
    spi = SPI(0, baudrate=1000000, sck=Pin(18), mosi=Pin(19), miso=Pin(16))
    data = bytes([0xAA] * 16)
    
    def transfer():
        """Write a 16-byte payload over SPI."""
        spi.write(data)
    
    result = run_profile("SPI write (16 bytes)", transfer, iterations=2000)
    spi.deinit()
    return result


def test_timer_callback():
    """Profile timer creation/deinit cycle."""
    from machine import Timer
    
    def callback(t):
        """No-op timer callback used purely for profiling overhead."""
        pass
    
    def create_timer():
        """Create, start and immediately deinit a periodic timer."""
        timer = Timer()
        timer.init(mode=Timer.PERIODIC, period=100, callback=callback)
        timer.deinit()
    
    return run_profile("Timer init/deinit", create_timer, iterations=1000)


def test_time_ticks():
    """Profile utime ticks functions."""
    import utime
    
    def ticks():
        """Read the millisecond tick counter once."""
        _ = utime.ticks_ms()
    
    return run_profile("utime.ticks_ms()", ticks, iterations=10000)


def test_time_sleep_us():
    """Profile microsecond sleep (with very small delay)."""
    import utime
    
    def sleep():
        """Sleep for one microsecond."""
        utime.sleep_us(1)  # 1 microsecond
    
    return run_profile("utime.sleep_us(1)", sleep, iterations=1000)


def test_neopixel_write():
    """Profile NeoPixel writes."""
    from neopixel import NeoPixel
    from machine import Pin
    
    np = NeoPixel(Pin(16), 8)
    
    def write():
        """Set the first three NeoPixel colors and flush to the strip."""
        np[0] = (255, 0, 0)
        np[1] = (0, 255, 0)
        np[2] = (0, 0, 255)
        np.write()
    
    return run_profile("NeoPixel write (3 pixels)", write, iterations=1000)


def test_gc_collect():
    """Profile garbage collection."""
    import gc
    
    def collect():
        """Trigger one garbage collection cycle."""
        gc.collect()
    
    return run_profile("gc.collect()", collect, iterations=500)


def test_micropython_const():
    """Profile micropython.const (should be instant)."""
    import micropython
    
    def const_call():
        """Invoke ``micropython.const`` once."""
        _ = micropython.const(42)
    
    return run_profile("micropython.const()", const_call, iterations=10000)


def test_struct_pack():
    """Profile struct packing."""
    import struct
    
    def pack():
        """Pack a small fixed payload with ``struct.pack``."""
        _ = struct.pack('<HHI', 0x1234, 0x5678, 0xDEADBEEF)
    
    return run_profile("struct.pack('<HHI', ...)", pack, iterations=5000)


def test_state_emission_overhead():
    """Measure raw state emission overhead."""
    import state
    
    def emit():
        """Emit a single test event through the state bus."""
        state.emit_event("test_event", {"pin": "0", "value": 1})
    
    return run_profile("state.emit_event()", emit, iterations=5000)


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("MICROPYTHON EMULATOR PERFORMANCE PROFILE")
    print("=" * 70)
    print("Running performance benchmarks...\n")
    
    # Run all profile tests
    tests = [
        ("Pin Operations", [test_pin_toggle, test_pin_value_read]),
        ("PWM Operations", [test_pwm_duty_cycle]),
        ("ADC Operations", [test_adc_read]),
        ("I2C Operations", [test_i2c_scan, test_i2c_read, test_i2c_write]),
        ("SPI Operations", [test_spi_transfer]),
        ("Timer Operations", [test_timer_callback]),
        ("Time Functions", [test_time_ticks, test_time_sleep_us]),
        ("NeoPixel", [test_neopixel_write]),
        ("Memory/GC", [test_gc_collect]),
        ("Micropython", [test_micropython_const]),
        ("Struct", [test_struct_pack]),
        ("State Emission", [test_state_emission_overhead]),
    ]
    
    for category, test_funcs in tests:
        print(f"\n--- {category} ---")
        for test_func in test_funcs:
            try:
                test_func()
                print(f"  ✓ {test_func.__name__}")
            except Exception as e:
                print(f"  ✗ {test_func.__name__}: {e}")
    
    # Print summary
    print_metrics()
    
    # Performance recommendations
    print("\n" + "=" * 70)
    print("ANALYSIS")
    print("=" * 70)
    
    # Find slowest operations
    sorted_metrics = sorted(_metrics.items(), key=lambda x: -x[1]["total_ms"] / x[1]["calls"])
    
    print("\nSlowest operations (avg time per call):")
    for name, m in sorted_metrics[:5]:
        avg = m["total_ms"] / m["calls"]
        print(f"  - {name}: {avg:.4f}ms avg")
    
    print("\nFastest operations (avg time per call):")
    for name, m in sorted_metrics[-5:]:
        avg = m["total_ms"] / m["calls"]
        print(f"  - {name}: {avg:.4f}ms avg")
    
    # Calculate total throughput
    total_ops = sum(m["calls"] for m in _metrics.values())
    total_time = sum(m["total_ms"] for m in _metrics.values())
    print(f"\nTotal: {total_ops:,} operations in {total_time:.2f}ms")
    # Guard against zero elapsed time (e.g. when running under the emulator mock
    # where operations can complete in sub-millisecond time and round to 0).
    safe_seconds = max(total_time, 1) / 1000
    print(f"Overall throughput: {total_ops / safe_seconds:,.0f} ops/sec")
