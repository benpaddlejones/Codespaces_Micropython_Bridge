"""
MicroPython Emulator Demo - Cycles through hardware tests
This script demonstrates various MicroPython features in the emulator.
Each test runs for approximately 8 seconds before moving to the next.

Tests included:
1. LED Blink - Basic GPIO output
2. PWM Fade - LED breathing effect  
3. Timer Callbacks - Periodic timer events
4. UART Loopback - Serial communication (auto-enabled in emulator)
5. I2C Scan - Device discovery
"""
from machine import Pin, PWM, Timer, UART, I2C
import utime

# Configuration
TEST_DURATION_MS = 8000  # 8 seconds per test
LOOP_FOREVER = True      # Set to False to run once

# ============================================================================
# Test 1: LED Blink
# ============================================================================
def test_led_blink():
    """Basic LED blink test - toggles every 500ms"""
    print("=" * 50)
    print("TEST 1: LED Blink")
    print("=" * 50)
    print("Toggling LED every 500ms...")
    print()
    
    led = Pin("LED", Pin.OUT)
    start = utime.ticks_ms()
    count = 0
    
    while utime.ticks_diff(utime.ticks_ms(), start) < TEST_DURATION_MS:
        led.toggle()
        count += 1
        state = "ON " if led.value() else "OFF"
        print(f"  LED {state} (toggle #{count})")
        utime.sleep_ms(500)
    
    led.off()
    print(f"\nCompleted {count} toggles")
    print()


# ============================================================================
# Test 2: PWM Fade
# ============================================================================
def test_pwm_fade():
    """PWM LED fade - breathing effect"""
    print("=" * 50)
    print("TEST 2: PWM Fade (LED Breathing)")
    print("=" * 50)
    print("Fading LED up and down using PWM...")
    print()
    
    led = PWM(Pin(25))
    led.freq(1000)
    start = utime.ticks_ms()
    cycle = 0
    
    while utime.ticks_diff(utime.ticks_ms(), start) < TEST_DURATION_MS:
        cycle += 1
        
        # Fade up
        print(f"  Cycle {cycle}: Fading up...", end="", flush=True)
        for duty in range(0, 65536, 4096):
            led.duty_u16(duty)
            utime.sleep_ms(30)
        print(f" peak={led.duty_u16()}")
        
        # Fade down
        print(f"  Cycle {cycle}: Fading down...", end="", flush=True)
        for duty in range(65535, -1, -4096):
            led.duty_u16(duty)
            utime.sleep_ms(30)
        print(f" low={led.duty_u16()}")
    
    led.deinit()
    print(f"\nCompleted {cycle} fade cycles")
    print()


# ============================================================================
# Test 3: Timer Callbacks
# ============================================================================
def test_timer():
    """Timer callback test - periodic interrupts"""
    print("=" * 50)
    print("TEST 3: Timer Callbacks")
    print("=" * 50)
    print("Firing timer every 500ms...")
    print()
    
    callback_count = 0
    timer_start = utime.ticks_ms()
    
    def timer_callback(t):
        nonlocal callback_count
        callback_count += 1
        elapsed = utime.ticks_diff(utime.ticks_ms(), timer_start)
        print(f"  ⏱️  Timer #{callback_count} at {elapsed}ms")
    
    timer = Timer(-1)
    timer.init(period=500, mode=Timer.PERIODIC, callback=timer_callback)
    
    start = utime.ticks_ms()
    while utime.ticks_diff(utime.ticks_ms(), start) < TEST_DURATION_MS:
        utime.sleep_ms(100)
    
    timer.deinit()
    print(f"\nTimer fired {callback_count} times")
    print()


# ============================================================================
# Test 4: UART Loopback
# ============================================================================
def test_uart():
    """UART loopback test - TX data loops to RX (auto-enabled in emulator)"""
    print("=" * 50)
    print("TEST 4: UART Loopback")
    print("=" * 50)
    print("Testing UART communication (loopback enabled by default)...")
    print()
    
    uart = UART(0, baudrate=115200, tx=Pin(0), rx=Pin(1))
    start = utime.ticks_ms()
    test_num = 0
    
    test_messages = [
        b"Hello MicroPython!",
        b"Emulator Test",
        bytes([0x00, 0x55, 0xAA, 0xFF]),
        b"UART working!",
        b"Loopback enabled",
    ]
    
    while utime.ticks_diff(utime.ticks_ms(), start) < TEST_DURATION_MS:
        msg = test_messages[test_num % len(test_messages)]
        test_num += 1
        
        uart.write(msg)
        received = uart.read()
        
        if len(msg) <= 20:
            print(f"  TX: {msg}")
            print(f"  RX: {received}")
        else:
            print(f"  TX: {msg[:20]}... ({len(msg)} bytes)")
            print(f"  RX: {received[:20] if received else None}... ({len(received) if received else 0} bytes)")
        
        match = "✓ Match" if msg == received else "✗ Mismatch"
        print(f"  {match}")
        print()
        
        utime.sleep_ms(1500)
    
    print(f"Completed {test_num} UART tests")
    print()


# ============================================================================
# Test 5: I2C Scan
# ============================================================================
def test_i2c():
    """I2C bus scan - discovers connected devices"""
    print("=" * 50)
    print("TEST 5: I2C Bus Scan")
    print("=" * 50)
    print("Scanning I2C bus for devices...")
    print("(Emulator has mock devices at 0x27, 0x3C, 0x68, 0x76)")
    print()
    
    i2c = I2C(0, scl=Pin(1), sda=Pin(0), freq=400000)
    start = utime.ticks_ms()
    scan_num = 0
    
    # Known device descriptions
    device_names = {
        0x27: "LCD Display (PCF8574)",
        0x3C: "OLED Display (SSD1306)",
        0x68: "IMU (MPU6050) or RTC (DS3231)",
        0x76: "Sensor (BME280/BMP280)",
        0x77: "Sensor (BME280 alt addr)",
        0x48: "ADC (ADS1115)",
        0x50: "EEPROM (AT24C32)",
    }
    
    while utime.ticks_diff(utime.ticks_ms(), start) < TEST_DURATION_MS:
        scan_num += 1
        print(f"  Scan #{scan_num}:")
        
        devices = i2c.scan()
        
        if devices:
            print(f"    Found {len(devices)} device(s):")
            for addr in devices:
                name = device_names.get(addr, "Unknown device")
                print(f"      0x{addr:02X} - {name}")
        else:
            print("    No devices found")
        
        print()
        utime.sleep_ms(2000)
    
    print(f"Completed {scan_num} I2C scans")
    print()


# ============================================================================
# Main Loop
# ============================================================================
def main():
    """Run all tests in sequence"""
    tests = [
        ("LED Blink", test_led_blink),
        ("PWM Fade", test_pwm_fade),
        ("Timer", test_timer),
        ("UART", test_uart),
        ("I2C", test_i2c),
    ]
    
    cycle = 0
    
    while True:
        cycle += 1
        print()
        print("#" * 60)
        print(f"#  EMULATOR DEMO - CYCLE {cycle}")
        print("#" * 60)
        print()
        print("Tests will run for ~8 seconds each")
        print(f"Total tests: {len(tests)}")
        print()
        
        for i, (name, test_func) in enumerate(tests, 1):
            print(f">>> Starting test {i}/{len(tests)}: {name}")
            print()
            
            try:
                test_func()
            except Exception as e:
                print(f"  ❌ Test failed: {e}")
                print()
            
            # Small pause between tests
            utime.sleep_ms(500)
        
        print()
        print("=" * 60)
        print(f"  CYCLE {cycle} COMPLETE - All {len(tests)} tests finished!")
        print("=" * 60)
        
        if not LOOP_FOREVER:
            print("\nDemo complete. Set LOOP_FOREVER=True to repeat.")
            break
        
        print("\nRestarting in 3 seconds...")
        utime.sleep(3)


if __name__ == "__main__":
    main()
