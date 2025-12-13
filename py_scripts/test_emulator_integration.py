"""
Emulator Integration Test Suite
================================
Tests that community examples produce correct __EMU__ events for the webview UI.
Runs examples through the actual emulator and validates output for:
- Raspberry Pi Pico
- Raspberry Pi Pico W
- ESP32

Run: python3 test/test_emulator_integration.py
"""

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
RUNNER_PATH = PROJECT_ROOT / ".extension" / "emulator" / "mock" / "runner.py"
EXAMPLES_PATH = PROJECT_ROOT / "py_scripts" / "community_examples.py"

# Boards to test
BOARDS = ["pico", "pico-w", "esp32"]

# Event prefix from runner.py
EMU_PREFIX = "__EMU__"


@dataclass
class EmulatorResult:
    """Result from running a script through the emulator."""
    board: str
    exit_code: int
    stdout: str
    stderr: str
    events: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.errors
    
    def get_events_by_type(self, event_type: str) -> List[Dict[str, Any]]:
        """Filter events by type."""
        return [e for e in self.events if e.get("type") == event_type]
    
    def has_event(self, event_type: str, **kwargs) -> bool:
        """Check if an event matching criteria exists."""
        for event in self.events:
            if event.get("type") != event_type:
                continue
            match = True
            for key, value in kwargs.items():
                if event.get(key) != value:
                    match = False
                    break
            if match:
                return True
        return False
    
    def count_events(self, event_type: str) -> int:
        """Count events of a specific type."""
        return len(self.get_events_by_type(event_type))


def run_emulator(script_path: Path, board: str = "pico") -> EmulatorResult:
    """Run a script through the emulator and capture output."""
    result = subprocess.run(
        [sys.executable, str(RUNNER_PATH), str(script_path), "--board", board],
        capture_output=True,
        text=True,
        timeout=60,
        cwd=str(PROJECT_ROOT),
    )
    
    emu_result = EmulatorResult(
        board=board,
        exit_code=result.returncode,
        stdout=result.stdout,
        stderr=result.stderr,
    )
    
    # Parse __EMU__ events from stdout
    for line in result.stdout.splitlines():
        if line.startswith(EMU_PREFIX):
            json_str = line[len(EMU_PREFIX):]
            try:
                event = json.loads(json_str)
                emu_result.events.append(event)
                if event.get("type") == "error":
                    emu_result.errors.append(event.get("message", "Unknown error"))
            except json.JSONDecodeError as e:
                emu_result.errors.append(f"Invalid JSON: {json_str[:50]}...")
    
    return emu_result


def print_header(text: str) -> None:
    """Print a section header."""
    print(f"\n{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}")


def print_result(name: str, passed: bool, details: str = "") -> None:
    """Print a test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  {status}: {name}")
    if details and not passed:
        print(f"         {details}")


class EmulatorIntegrationTests:
    """Test suite for emulator integration."""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results: Dict[str, EmulatorResult] = {}
    
    def run_all_boards(self, script_path: Path) -> None:
        """Run the script on all boards and store results."""
        for board in BOARDS:
            print(f"  Running on {board}...", end=" ", flush=True)
            try:
                result = run_emulator(script_path, board)
                self.results[board] = result
                status = "✓" if result.success else "✗"
                print(f"{status} ({len(result.events)} events)")
            except subprocess.TimeoutExpired:
                print("TIMEOUT")
                self.results[board] = EmulatorResult(
                    board=board, exit_code=-1, stdout="", stderr="Timeout",
                    errors=["Script execution timed out"]
                )
            except Exception as e:
                print(f"ERROR: {e}")
                self.results[board] = EmulatorResult(
                    board=board, exit_code=-1, stdout="", stderr=str(e),
                    errors=[str(e)]
                )
    
    def assert_test(self, name: str, condition: bool, details: str = "") -> bool:
        """Record a test assertion."""
        if condition:
            self.passed += 1
        else:
            self.failed += 1
        print_result(name, condition, details)
        return condition
    
    # =========================================================================
    # Core Event Tests - Run on all boards
    # =========================================================================
    
    def test_emulator_lifecycle(self) -> None:
        """Test that emulator produces start and complete events."""
        print_header("Test: Emulator Lifecycle Events")
        
        for board, result in self.results.items():
            # Must have reset event
            self.assert_test(
                f"[{board}] Has 'reset' event",
                result.has_event("reset"),
                f"Events: {[e['type'] for e in result.events[:5]]}"
            )
            
            # Must have start event
            self.assert_test(
                f"[{board}] Has 'start' event",
                result.has_event("start"),
            )
            
            # Must have complete event
            self.assert_test(
                f"[{board}] Has 'complete' event with status='ok'",
                result.has_event("complete", status="ok"),
                f"Exit code: {result.exit_code}"
            )
    
    def test_pin_operations(self) -> None:
        """Test that pin operations emit correct events."""
        print_header("Test: Pin Operations (LED Blink)")
        
        for board, result in self.results.items():
            # LED pin 25 should be registered
            self.assert_test(
                f"[{board}] Pin 25 registered as OUT",
                result.has_event("pin_register", pin="25", mode="OUT"),
            )
            
            # Should have pin updates (on/off toggles)
            pin_updates = [
                e for e in result.get_events_by_type("pin_update")
                if e.get("pin") == "25"
            ]
            self.assert_test(
                f"[{board}] Pin 25 toggled multiple times",
                len(pin_updates) >= 5,
                f"Found {len(pin_updates)} updates"
            )
            
            # Should have both high and low states
            values = {e.get("value") for e in pin_updates}
            self.assert_test(
                f"[{board}] Pin 25 has both HIGH and LOW states",
                0 in values and 1 in values,
                f"Values: {values}"
            )
    
    def test_pwm_operations(self) -> None:
        """Test PWM fade operations."""
        print_header("Test: PWM Operations (LED Fade)")
        
        for board, result in self.results.items():
            # PWM init event
            self.assert_test(
                f"[{board}] PWM initialized on pin 25",
                result.has_event("pwm_init", pin="25"),
            )
            
            # PWM frequency set
            self.assert_test(
                f"[{board}] PWM frequency set to 1000Hz",
                result.has_event("pwm_freq", pin="25", freq=1000),
            )
            
            # PWM duty cycle changes
            pwm_duty_events = result.get_events_by_type("pwm_duty")
            self.assert_test(
                f"[{board}] Multiple PWM duty changes (fade effect)",
                len(pwm_duty_events) >= 10,
                f"Found {len(pwm_duty_events)} duty events"
            )
            
            # PWM deinit
            self.assert_test(
                f"[{board}] PWM deinitialized",
                result.has_event("pwm_deinit", pin="25"),
            )
    
    def test_adc_operations(self) -> None:
        """Test ADC reading operations."""
        print_header("Test: ADC Operations (Temperature Sensor)")
        
        for board, result in self.results.items():
            # Internal temp sensor on ADC4
            self.assert_test(
                f"[{board}] ADC initialized on channel 4 (temp sensor)",
                result.has_event("adc_init", pin="4"),
            )
            
            # Multi-channel ADC example
            adc_inits = result.get_events_by_type("adc_init")
            adc_pins = {e.get("pin") for e in adc_inits}
            self.assert_test(
                f"[{board}] Multiple ADC channels initialized",
                len(adc_pins) >= 2,
                f"ADC pins: {adc_pins}"
            )
    
    def test_i2c_operations(self) -> None:
        """Test I2C bus operations."""
        print_header("Test: I2C Operations (OLED, MPU6050)")
        
        for board, result in self.results.items():
            # I2C bus init
            self.assert_test(
                f"[{board}] I2C bus 0 initialized",
                result.has_event("i2c_init", id=0),
            )
            
            # I2C scan performed
            self.assert_test(
                f"[{board}] I2C scan performed",
                result.has_event("i2c_scan", id=0),
            )
            
            # I2C write operations (SSD1306 init sequence)
            i2c_writes = result.get_events_by_type("i2c_write")
            self.assert_test(
                f"[{board}] I2C write operations performed",
                len(i2c_writes) >= 10,
                f"Found {len(i2c_writes)} I2C writes"
            )
            
            # I2C memory read (MPU6050)
            self.assert_test(
                f"[{board}] I2C memory read performed",
                result.has_event("i2c_read_mem"),
            )
    
    def test_spi_operations(self) -> None:
        """Test SPI bus operations."""
        print_header("Test: SPI Operations (SD Card)")
        
        for board, result in self.results.items():
            # SPI init
            self.assert_test(
                f"[{board}] SPI bus 0 initialized",
                result.has_event("spi_init", id=0),
            )
            
            # SPI write operations
            spi_writes = result.get_events_by_type("spi_write")
            self.assert_test(
                f"[{board}] SPI write operations performed",
                len(spi_writes) >= 2,
                f"Found {len(spi_writes)} SPI writes"
            )
            
            # SPI deinit
            self.assert_test(
                f"[{board}] SPI deinitialized",
                result.has_event("spi_deinit", id=0),
            )
    
    def test_uart_operations(self) -> None:
        """Test UART operations."""
        print_header("Test: UART Operations")
        
        for board, result in self.results.items():
            # UART init
            self.assert_test(
                f"[{board}] UART 0 initialized",
                result.has_event("uart_init", id=0),
            )
            
            # UART write
            self.assert_test(
                f"[{board}] UART write performed",
                result.has_event("uart_write", id=0),
            )
            
            # UART deinit
            self.assert_test(
                f"[{board}] UART deinitialized",
                result.has_event("uart_deinit", id=0),
            )
    
    def test_timer_operations(self) -> None:
        """Test Timer operations."""
        print_header("Test: Timer Operations")
        
        for board, result in self.results.items():
            # Timer init
            timer_inits = result.get_events_by_type("timer_init")
            self.assert_test(
                f"[{board}] Timer initialized",
                len(timer_inits) >= 1,
            )
            
            # Timer deinit
            self.assert_test(
                f"[{board}] Timer deinitialized",
                result.has_event("timer_deinit"),
            )
    
    def test_neopixel_operations(self) -> None:
        """Test NeoPixel operations."""
        print_header("Test: NeoPixel Operations (Rainbow)")
        
        for board, result in self.results.items():
            # NeoPixel init
            self.assert_test(
                f"[{board}] NeoPixel strip initialized",
                result.has_event("neopixel_init"),
            )
            
            # NeoPixel writes (rainbow animation)
            np_writes = result.get_events_by_type("neopixel_write")
            self.assert_test(
                f"[{board}] NeoPixel strip written multiple times",
                len(np_writes) >= 3,
                f"Found {len(np_writes)} writes"
            )
            
            # Verify pixel data format (RGB tuples)
            if np_writes:
                pixels = np_writes[0].get("pixels", [])
                self.assert_test(
                    f"[{board}] NeoPixel data contains RGB values",
                    len(pixels) >= 1 and len(pixels[0]) == 3,
                    f"First pixel: {pixels[0] if pixels else 'None'}"
                )
    
    def test_rtc_operations(self) -> None:
        """Test RTC operations."""
        print_header("Test: RTC Operations")
        
        for board, result in self.results.items():
            # RTC init
            self.assert_test(
                f"[{board}] RTC initialized",
                result.has_event("rtc_init"),
            )
            
            # RTC datetime set
            rtc_sets = result.get_events_by_type("rtc_set")
            self.assert_test(
                f"[{board}] RTC datetime set",
                len(rtc_sets) >= 1,
            )
            
            # Verify datetime format
            if rtc_sets:
                dt = rtc_sets[0].get("datetime", [])
                self.assert_test(
                    f"[{board}] RTC datetime has 8 elements",
                    len(dt) == 8,
                    f"Datetime: {dt}"
                )
    
    def test_wdt_operations(self) -> None:
        """Test Watchdog Timer operations."""
        print_header("Test: Watchdog Timer Operations")
        
        for board, result in self.results.items():
            # WDT init
            self.assert_test(
                f"[{board}] WDT initialized with timeout",
                result.has_event("wdt_init"),
            )
            
            # WDT feed
            wdt_feeds = result.get_events_by_type("wdt_feed")
            self.assert_test(
                f"[{board}] WDT fed multiple times",
                len(wdt_feeds) >= 3,
                f"Found {len(wdt_feeds)} feeds"
            )
    
    def test_wifi_operations(self) -> None:
        """Test WiFi operations (Pico W and ESP32)."""
        print_header("Test: WiFi Operations (Pico W / ESP32)")
        
        for board, result in self.results.items():
            # WLAN init
            self.assert_test(
                f"[{board}] WLAN interface initialized",
                result.has_event("wlan_init"),
            )
            
            # WLAN activated
            self.assert_test(
                f"[{board}] WLAN activated",
                result.has_event("wlan_active", active=True),
            )
            
            # WLAN scan
            self.assert_test(
                f"[{board}] WLAN scan performed",
                result.has_event("wlan_scan"),
            )
            
            # WLAN connect
            self.assert_test(
                f"[{board}] WLAN connect attempted",
                result.has_event("wlan_connect"),
            )
    
    def test_pio_operations(self) -> None:
        """Test PIO StateMachine operations (RP2040 specific)."""
        print_header("Test: PIO StateMachine Operations")
        
        for board, result in self.results.items():
            # PIO StateMachine init
            self.assert_test(
                f"[{board}] PIO StateMachine initialized",
                result.has_event("pio_sm_init"),
            )
            
            # SM active
            self.assert_test(
                f"[{board}] PIO SM activated",
                result.has_event("pio_sm_active", active=True),
            )
            
            # SM put data
            self.assert_test(
                f"[{board}] PIO SM put data",
                result.has_event("pio_sm_put"),
            )
    
    def test_no_errors(self) -> None:
        """Test that no error events were emitted."""
        print_header("Test: No Errors Emitted")
        
        for board, result in self.results.items():
            error_events = result.get_events_by_type("error")
            self.assert_test(
                f"[{board}] No error events",
                len(error_events) == 0,
                f"Errors: {[e.get('message') for e in error_events]}"
            )
            
            self.assert_test(
                f"[{board}] Exit code is 0",
                result.exit_code == 0,
                f"Exit code: {result.exit_code}"
            )
    
    def test_event_counts(self) -> None:
        """Test overall event counts are reasonable."""
        print_header("Test: Event Count Validation")
        
        for board, result in self.results.items():
            total_events = len(result.events)
            self.assert_test(
                f"[{board}] Reasonable event count (50-500)",
                50 <= total_events <= 500,
                f"Total events: {total_events}"
            )
            
            # Summarize event types
            event_types = {}
            for e in result.events:
                t = e.get("type", "unknown")
                event_types[t] = event_types.get(t, 0) + 1
            
            print(f"         Event summary: {dict(sorted(event_types.items()))}")
    
    def run_all(self) -> int:
        """Run all tests and return exit code."""
        print_header("Emulator Integration Test Suite")
        print(f"  Testing: {EXAMPLES_PATH}")
        print(f"  Boards: {', '.join(BOARDS)}")
        
        # Run examples on all boards
        print_header("Running Examples on All Boards")
        self.run_all_boards(EXAMPLES_PATH)
        
        # Run test suites
        self.test_emulator_lifecycle()
        self.test_pin_operations()
        self.test_pwm_operations()
        self.test_adc_operations()
        self.test_i2c_operations()
        self.test_spi_operations()
        self.test_uart_operations()
        self.test_timer_operations()
        self.test_neopixel_operations()
        self.test_rtc_operations()
        self.test_wdt_operations()
        self.test_wifi_operations()
        self.test_pio_operations()
        self.test_no_errors()
        self.test_event_counts()
        
        # Summary
        print_header("TEST SUMMARY")
        total = self.passed + self.failed
        print(f"  ✅ Passed: {self.passed}/{total}")
        print(f"  ❌ Failed: {self.failed}/{total}")
        
        if self.failed == 0:
            print("\n  🎉 All emulator integration tests passed!")
        else:
            print(f"\n  ⚠️  {self.failed} test(s) failed")
        
        print("="*70)
        
        return 0 if self.failed == 0 else 1


def main() -> int:
    """Main entry point."""
    tests = EmulatorIntegrationTests()
    return tests.run_all()


if __name__ == "__main__":
    sys.exit(main())
