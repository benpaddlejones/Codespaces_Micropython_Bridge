"""MicroPython `machine` module emulator for hardware simulation.

This module provides mock implementations of MicroPython's machine module
for running MicroPython code in a standard Python environment.

Compatible with: MicroPython v1.20+ (RP2040/Raspberry Pi Pico)
Last API audit: December 2025

See: https://docs.micropython.org/en/latest/library/machine.html
"""
from __future__ import annotations

from typing import Callable, Optional, Union
import random

import state


class Pin:
    """Pin implementation for GPIO control."""

    IN = 0
    OUT = 1
    PULL_UP = 2
    PULL_DOWN = 3
    IRQ_RISING = 1
    IRQ_FALLING = 2

    _MODE_NAMES = {
        IN: "IN",
        OUT: "OUT",
        PULL_UP: "PULL_UP",
        PULL_DOWN: "PULL_DOWN",
    }

    def __init__(
        self,
        id: Union[int, str],
        mode: int = OUT,
        pull: Optional[int] = None,
        value: Optional[int] = None,
    ) -> None:
        self._id = str(id)
        self._mode = mode
        self._pull = pull
        self._value = 0
        self._irq_handler: Optional[Callable[["Pin"], None]] = None
        self._irq_trigger = 0

        state.register_pin(self._id, self._mode_name, value if value is not None else 0)
        if value is not None:
            self.value(value)

    @property
    def _mode_name(self) -> str:
        return self._MODE_NAMES.get(self._mode, "OUT")

    def value(self, val: Optional[int] = None) -> int:
        if val is None:
            # Reading pin value - emit with IN mode
            current = state.get_pin_value(self._id)
            state.update_pin(self._id, current, "IN")
            return current

        self._value = 1 if val else 0
        state.update_pin(self._id, self._value, "OUT")
        return self._value

    def on(self) -> None:
        self.value(1)

    def off(self) -> None:
        self.value(0)

    def low(self) -> None:
        """Set pin to low (alias for off())."""
        self.value(0)

    def high(self) -> None:
        """Set pin to high (alias for on())."""
        self.value(1)

    def toggle(self) -> None:
        self.value(0 if self.value() else 1)

    def init(
        self,
        mode: int = -1,
        pull: Optional[int] = None,
        value: Optional[int] = None,
        drive: int = 0,
        alt: int = -1,
    ) -> None:
        """Reinitialize the pin with new settings."""
        if mode != -1:
            self._mode = mode
        if pull is not None:
            self._pull = pull
        if value is not None:
            self.value(value)
        # drive and alt are ignored in emulator

    def mode(self, mode: Optional[int] = None) -> Optional[int]:
        """Get or set the pin mode."""
        if mode is None:
            return self._mode
        self._mode = mode
        return None

    def pull(self, pull: Optional[int] = None) -> Optional[int]:
        """Get or set the pull resistor."""
        if pull is None:
            return self._pull
        self._pull = pull
        return None

    def drive(self, drive: Optional[int] = None) -> Optional[int]:
        """Get or set the drive strength (ignored in emulator)."""
        return 0

    def irq(
        self,
        handler: Optional[Callable[["Pin"], None]] = None,
        trigger: int = IRQ_RISING | IRQ_FALLING,
    ) -> None:
        """Register an interrupt handler."""
        self._irq_handler = handler
        self._irq_trigger = trigger

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"<Pin id={self._id} mode={self._mode_name} value={self._value} "
            f"pull={self._pull}>"
        )


class PWM:
    """PWM (Pulse Width Modulation) implementation."""

    def __init__(
        self,
        pin: Pin,
        freq: int = 1000,
        duty_u16: int = 0,
    ) -> None:
        self._pin = pin
        self._freq = freq
        self._duty_u16 = duty_u16
        self._active = True
        state.emit_pwm_update(pin._id, freq, duty_u16)

    def init(
        self,
        *,
        freq: int = 0,
        duty_u16: int = 0,
        duty_ns: int = 0,
    ) -> None:
        """Reinitialize the PWM with new settings."""
        if freq > 0:
            self._freq = freq
        if duty_u16 > 0:
            self._duty_u16 = duty_u16
        elif duty_ns > 0:
            period_ns = 1_000_000_000 // self._freq if self._freq > 0 else 1
            self._duty_u16 = (duty_ns * 65535) // period_ns
        state.emit_pwm_update(self._pin._id, self._freq, self._duty_u16)

    def freq(self, value: Optional[int] = None) -> Optional[int]:
        if value is None:
            return self._freq
        self._freq = value
        state.emit_pwm_update(self._pin._id, self._freq, self._duty_u16)
        return None

    def duty_u16(self, value: Optional[int] = None) -> Optional[int]:
        if value is None:
            return self._duty_u16
        self._duty_u16 = max(0, min(65535, value))
        state.emit_pwm_update(self._pin._id, self._freq, self._duty_u16)
        return None

    def duty_ns(self, value: Optional[int] = None) -> Optional[int]:
        if value is None:
            period_ns = 1_000_000_000 // self._freq if self._freq > 0 else 0
            return (self._duty_u16 * period_ns) // 65535
        period_ns = 1_000_000_000 // self._freq if self._freq > 0 else 1
        self._duty_u16 = (value * 65535) // period_ns
        state.emit_pwm_update(self._pin._id, self._freq, self._duty_u16)
        return None

    def deinit(self) -> None:
        self._active = False
        self._duty_u16 = 0
        state.emit_pwm_update(self._pin._id, self._freq, 0)


class ADC:
    """ADC (Analog to Digital Converter) implementation.
    
    Returns simulated analog readings. Pin 4 is used for internal temperature.
    """

    # Internal temperature sensor is on ADC channel 4
    TEMP_SENSOR = 4

    def __init__(self, pin: Union[Pin, int]) -> None:
        if isinstance(pin, Pin):
            self._pin_id = pin._id
        else:
            self._pin_id = str(pin)
        
        self._simulated_value: Optional[int] = None
        state.emit_event("adc_init", {"pin": self._pin_id})

    def read_u16(self) -> int:
        """Read analog value as 16-bit unsigned integer (0-65535).
        
        If a simulated value is set via state, it returns that value.
        Otherwise, returns a random value simulating sensor noise.
        For temperature sensor (pin 4), returns ~27°C room temperature.
        """
        # Check if webview has set a simulated value
        sim_value = state.get_adc_value(self._pin_id)
        if sim_value is not None:
            value = sim_value
        # Temperature sensor simulation (pin 4 / ADC4)
        elif self._pin_id in ("4", "ADC4", str(self.TEMP_SENSOR)):
            # Simulate ~27°C (room temperature)
            # Formula: T = 27 - (ADC_voltage - 0.706) / 0.001721
            # At 27°C, voltage ≈ 0.706V → ADC reading ≈ 27000
            value = 27000 + random.randint(-500, 500)
        else:
            # Default: return mid-range with some noise
            value = 32768 + random.randint(-1000, 1000)
        
        # Emit read event for visualization
        state.emit_event("adc_read", {
            "pin": self._pin_id,
            "value": value,
            "voltage_mv": (value * 3300) // 65535,
        })
        return value

    def read(self) -> int:
        """Read analog value as 12-bit unsigned integer (0-4095).
        
        Legacy method - converts 16-bit value to 12-bit.
        """
        return self.read_u16() >> 4

    def read_uv(self) -> int:
        """Read analog value in microvolts.
        
        RP2040 has a 3.3V reference and 12-bit ADC.
        Returns voltage in microvolts (0 - 3,300,000).
        """
        # Convert 16-bit reading to microvolts
        # 65535 = 3.3V = 3,300,000 uV
        return (self.read_u16() * 3_300_000) // 65535

    def set_simulated_value(self, value: int) -> None:
        """Set a specific value to be returned by read_u16()."""
        self._simulated_value = value
        state.set_adc_value(self._pin_id, value)


class I2C:
    """I2C bus implementation for emulated device communication.
    
    This is an I2C emulator that logs all transactions and simulates
    device responses. By default, it auto-responds with valid data
    to prevent infinite loops in common patterns like:
    - `while not i2c.scan(): pass`
    - `while device.read() == 0: pass`
    
    Device responses can be configured through the webview panel
    or programmatically via the state module.
    """

    def __init__(
        self,
        id: int,
        *,
        scl: Optional[Pin] = None,
        sda: Optional[Pin] = None,
        freq: int = 400000,
    ) -> None:
        self._id = id
        self._scl = scl
        self._sda = sda
        self._freq = freq
        state.emit_event("i2c_init", {
            "id": id,
            "scl": scl._id if scl else None,
            "sda": sda._id if sda else None,
            "freq": freq,
        })

    def scan(self) -> list[int]:
        """Scan for I2C devices. Returns list of addresses found.
        
        If no devices are explicitly configured, returns common device
        addresses to prevent infinite scan loops.
        """
        devices = state.get_i2c_devices(self._id)
        state.emit_event("i2c_scan", {"id": self._id, "devices": devices})
        return devices

    def register_device(self, addr: int) -> None:
        """Register a mock I2C device at the given address.
        
        This makes the device appear in scan() results and allows
        configuring responses for this address.
        """
        state.register_i2c_device(self._id, addr)

    def writeto(self, addr: int, buf: bytes, stop: bool = True) -> int:
        """Write bytes to an I2C device."""
        hex_data = buf.hex()
        state.emit_event("i2c_write", {
            "id": self._id,
            "addr": addr,
            "data": hex_data,
            "stop": stop,
            "scl": self._scl._id if self._scl else None,
            "sda": self._sda._id if self._sda else None,
        })
        return len(buf)

    def readfrom(self, addr: int, nbytes: int, stop: bool = True) -> bytes:
        """Read bytes from an I2C device."""
        # Get response from state (configured via webview)
        response = state.get_i2c_response(self._id, addr, nbytes)
        state.emit_event("i2c_read", {
            "id": self._id,
            "addr": addr,
            "nbytes": nbytes,
            "response": response.hex(),
            "stop": stop,
            "scl": self._scl._id if self._scl else None,
            "sda": self._sda._id if self._sda else None,
        })
        return response

    def writeto_mem(
        self,
        addr: int,
        memaddr: int,
        buf: bytes,
        *,
        addrsize: int = 8,
    ) -> None:
        """Write to a memory address on an I2C device."""
        state.emit_event("i2c_write_mem", {
            "id": self._id,
            "addr": addr,
            "memaddr": memaddr,
            "data": buf.hex(),
            "addrsize": addrsize,
            "scl": self._scl._id if self._scl else None,
            "sda": self._sda._id if self._sda else None,
        })

    def readfrom_mem(
        self,
        addr: int,
        memaddr: int,
        nbytes: int,
        *,
        addrsize: int = 8,
    ) -> bytes:
        """Read from a memory address on an I2C device."""
        response = state.get_i2c_response(self._id, addr, nbytes, memaddr)
        state.emit_event("i2c_read_mem", {
            "id": self._id,
            "addr": addr,
            "memaddr": memaddr,
            "nbytes": nbytes,
            "response": response.hex(),
            "addrsize": addrsize,
            "scl": self._scl._id if self._scl else None,
            "sda": self._sda._id if self._sda else None,
        })
        return response

    def readfrom_mem_into(
        self,
        addr: int,
        memaddr: int,
        buf: bytearray,
        *,
        addrsize: int = 8,
    ) -> None:
        """Read from memory into existing buffer."""
        data = self.readfrom_mem(addr, memaddr, len(buf), addrsize=addrsize)
        buf[:len(data)] = data

    # Low-level I2C primitives
    def start(self) -> None:
        """Generate a START condition on the bus."""
        state.emit_event("i2c_start", {"id": self._id})

    def stop(self) -> None:
        """Generate a STOP condition on the bus."""
        state.emit_event("i2c_stop", {"id": self._id})

    def readinto(self, buf: bytearray, nack: bool = True) -> None:
        """Read bytes into buffer (low-level primitive)."""
        for i in range(len(buf)):
            buf[i] = 0
        state.emit_event("i2c_readinto", {"id": self._id, "nbytes": len(buf), "nack": nack})

    def write(self, buf: bytes) -> int:
        """Write bytes to the bus (low-level primitive)."""
        state.emit_event("i2c_write_raw", {"id": self._id, "data": buf.hex()})
        return len(buf)  # Number of ACKs received

    def writevto(
        self,
        addr: int,
        vector: list,
        stop: bool = True,
    ) -> int:
        """Write multiple buffers to an I2C device (vectored write)."""
        total = 0
        for buf in vector:
            total += len(buf)
        state.emit_event("i2c_writevto", {
            "id": self._id,
            "addr": addr,
            "nbytes": total,
            "stop": stop,
        })
        return total


class SoftI2C(I2C):
    """Software I2C implementation (bit-banging)."""

    def __init__(
        self,
        *,
        scl: Pin,
        sda: Pin,
        freq: int = 400000,
    ) -> None:
        super().__init__(0, scl=scl, sda=sda, freq=freq)


class SPI:
    """SPI bus implementation stub."""

    MSB = 0
    LSB = 1

    def __init__(
        self,
        id: int,
        baudrate: int = 1000000,
        *,
        polarity: int = 0,
        phase: int = 0,
        bits: int = 8,
        firstbit: int = MSB,
        sck: Optional[Pin] = None,
        mosi: Optional[Pin] = None,
        miso: Optional[Pin] = None,
    ) -> None:
        self._id = id
        self._baudrate = baudrate
        self._polarity = polarity
        self._phase = phase
        self._bits = bits
        self._firstbit = firstbit
        state.emit_event("spi_init", {
            "id": id,
            "baudrate": baudrate,
            "polarity": polarity,
            "phase": phase,
        })

    def init(
        self,
        baudrate: int = 1000000,
        *,
        polarity: int = 0,
        phase: int = 0,
        bits: int = 8,
        firstbit: int = 0,
    ) -> None:
        self._baudrate = baudrate
        self._polarity = polarity
        self._phase = phase
        self._bits = bits
        self._firstbit = firstbit

    def deinit(self) -> None:
        state.emit_event("spi_deinit", {"id": self._id})

    def read(self, nbytes: int, write: int = 0x00) -> bytes:
        state.emit_event("spi_read", {"id": self._id, "nbytes": nbytes})
        return bytes([0] * nbytes)

    def readinto(self, buf: bytearray, write: int = 0x00) -> None:
        for i in range(len(buf)):
            buf[i] = 0

    def write(self, buf: bytes) -> None:
        state.emit_event("spi_write", {"id": self._id, "data": buf.hex()})

    def write_readinto(self, write_buf: bytes, read_buf: bytearray) -> None:
        self.write(write_buf)
        self.readinto(read_buf)


class SoftSPI(SPI):
    """Software SPI implementation."""

    def __init__(
        self,
        baudrate: int = 1000000,
        *,
        polarity: int = 0,
        phase: int = 0,
        bits: int = 8,
        firstbit: int = 0,
        sck: Pin,
        mosi: Pin,
        miso: Pin,
    ) -> None:
        super().__init__(
            0, baudrate, polarity=polarity, phase=phase, bits=bits,
            firstbit=firstbit, sck=sck, mosi=mosi, miso=miso
        )


class Timer:
    """Hardware timer implementation."""

    ONE_SHOT = 0
    PERIODIC = 1

    def __init__(self, id: int = -1) -> None:
        self._id = id
        self._mode = self.PERIODIC
        self._freq = 0
        self._period = 0
        self._callback: Optional[Callable[["Timer"], None]] = None
        self._active = False

    def init(
        self,
        *,
        mode: int = PERIODIC,
        freq: int = 0,
        period: int = 0,
        callback: Optional[Callable[["Timer"], None]] = None,
    ) -> None:
        self._mode = mode
        self._freq = freq
        self._period = period
        self._callback = callback
        self._active = True
        state.emit_event("timer_init", {
            "id": self._id,
            "mode": "PERIODIC" if mode == self.PERIODIC else "ONE_SHOT",
            "freq": freq,
            "period": period,
        })

    def deinit(self) -> None:
        self._active = False
        self._callback = None
        state.emit_event("timer_deinit", {"id": self._id})

    def value(self) -> int:
        """Return the current timer counter value.
        
        In the emulator, returns a simulated increasing value.
        """
        import time
        return int(time.time() * 1000) & 0xFFFFFFFF


class UART:
    """UART serial communication stub with loopback support.
    
    In the emulator, loopback is enabled by default since there's no
    real hardware to communicate with. This allows UART code to be
    tested without modification.
    """
    
    # Class-level loopback mode - enabled by default in emulator
    _loopback_enabled = True

    def __init__(
        self,
        id: int,
        baudrate: int = 9600,
        bits: int = 8,
        parity: Optional[int] = None,
        stop: int = 1,
        *,
        tx: Optional[Pin] = None,
        rx: Optional[Pin] = None,
    ) -> None:
        self._id = id
        self._baudrate = baudrate
        self._tx = tx
        self._rx = rx
        self._rx_buffer = bytearray()
        self._loopback = UART._loopback_enabled
        state.emit_event("uart_init", {
            "id": id,
            "baudrate": baudrate,
            "bits": bits,
            "parity": parity,
            "stop": stop,
            "tx": tx._id if tx else None,
            "rx": rx._id if rx else None,
            "loopback": self._loopback,
        })

    @classmethod
    def enable_loopback(cls, enabled: bool = True) -> None:
        """Enable or disable loopback mode for all UART instances."""
        cls._loopback_enabled = enabled

    def init(
        self,
        baudrate: int = 9600,
        bits: int = 8,
        parity: Optional[int] = None,
        stop: int = 1,
    ) -> None:
        self._baudrate = baudrate

    def deinit(self) -> None:
        state.emit_event("uart_deinit", {"id": self._id})

    def any(self) -> int:
        return len(self._rx_buffer)

    def read(self, nbytes: Optional[int] = None) -> Optional[bytes]:
        if nbytes is None:
            data = bytes(self._rx_buffer)
            self._rx_buffer.clear()
            return data if data else None
        data = bytes(self._rx_buffer[:nbytes])
        del self._rx_buffer[:nbytes]
        return data if data else None

    def readinto(
        self, buf: bytearray, nbytes: Optional[int] = None
    ) -> Optional[int]:
        data = self.read(nbytes or len(buf))
        if data:
            buf[:len(data)] = data
            return len(data)
        return None

    def readline(self) -> Optional[bytes]:
        idx = self._rx_buffer.find(b'\n')
        if idx >= 0:
            line = bytes(self._rx_buffer[:idx + 1])
            del self._rx_buffer[:idx + 1]
            return line
        return None

    def write(self, buf: bytes) -> Optional[int]:
        state.emit_event("uart_write", {
            "id": self._id,
            "data": buf.hex(),
            "tx": self._tx._id if self._tx else None,
        })
        # Loopback mode: written data appears in rx buffer
        if self._loopback or UART._loopback_enabled:
            self._rx_buffer.extend(buf)
        return len(buf)
    
    def sendbreak(self) -> None:
        """Send a break condition."""
        state.emit_event("uart_break", {"id": self._id})

    def txdone(self) -> bool:
        """Check if all data has been transmitted.
        
        In the emulator, writes are instantaneous so this always returns True.
        """
        return True

    def flush(self) -> None:
        """Wait until all data has been transmitted.
        
        In the emulator, writes are instantaneous so this returns immediately.
        """
        pass


class WDT:
    """Watchdog timer stub."""

    def __init__(self, timeout: int = 5000) -> None:
        self._timeout = timeout
        state.emit_event("wdt_init", {"timeout": timeout})

    def feed(self) -> None:
        state.emit_event("wdt_feed", {})


class RTC:
    """Real-time clock stub."""

    def __init__(self, id: int = 0) -> None:
        import time
        self._id = id
        self._datetime = time.localtime()
        self._alarm: Optional[tuple] = None
        self._alarm_callback: Optional[Callable] = None
        state.emit_event("rtc_init", {"id": id})

    def init(self, datetime: tuple) -> None:
        """Initialize the RTC with a datetime tuple."""
        self._datetime = datetime
        state.emit_event("rtc_set", {"datetime": list(datetime)})

    def datetime(
        self,
        datetimetuple: Optional[tuple] = None,
    ) -> tuple:
        if datetimetuple is not None:
            self._datetime = datetimetuple
            state.emit_event("rtc_set", {"datetime": list(datetimetuple)})
        return self._datetime

    def alarm(self, id: int, time: Optional[tuple] = None, *, repeat: bool = False) -> None:
        """Set an alarm.
        
        Args:
            id: Alarm ID (typically 0)
            time: Alarm time tuple or milliseconds from now
            repeat: Whether the alarm should repeat
        """
        self._alarm = time
        state.emit_event("rtc_alarm_set", {"id": id, "time": list(time) if time else None, "repeat": repeat})

    def alarm_left(self, id: int = 0) -> int:
        """Return milliseconds until the alarm triggers.
        
        In the emulator, always returns 0 (alarm would trigger now).
        """
        return 0

    def cancel(self, id: int = 0) -> None:
        """Cancel a pending alarm."""
        self._alarm = None
        self._alarm_callback = None
        state.emit_event("rtc_alarm_cancel", {"id": id})

    def irq(self, *, trigger: int = 0, handler: Optional[Callable] = None, wake: int = 0) -> None:
        """Set up an interrupt handler for the RTC."""
        self._alarm_callback = handler
        state.emit_event("rtc_irq_set", {"trigger": trigger, "wake": wake})


# Module-level functions

def reset() -> None:
    """Reset the device (ends emulation)."""
    state.emit_event("reset", {})
    raise SystemExit("Machine reset requested")


def soft_reset() -> None:
    """Soft reset."""
    state.emit_event("soft_reset", {})
    raise SystemExit("Soft reset requested")


def freq(hz: Optional[int] = None) -> int:
    """Get or set CPU frequency."""
    # RP2040 runs at 125MHz by default
    if hz is not None:
        state.emit_event("freq", {"hz": hz})
    return 125_000_000


def unique_id() -> bytes:
    """Return a unique identifier (simulated)."""
    return b'\x00\x01\x02\x03\x04\x05\x06\x07'


def idle() -> None:
    """Wait for interrupt (no-op in emulator)."""
    pass


def lightsleep(time_ms: Optional[int] = None) -> None:
    """Light sleep mode."""
    import time
    if time_ms:
        time.sleep(time_ms / 1000)


def deepsleep(time_ms: Optional[int] = None) -> None:
    """Deep sleep mode (ends emulation)."""
    state.emit_event("deepsleep", {"time_ms": time_ms})
    raise SystemExit("Deep sleep requested")


def disable_irq() -> int:
    """Disable interrupts."""
    return 0


def enable_irq(state_val: int) -> None:
    """Enable interrupts."""
    pass


# Reset/wake cause constants
PWRON_RESET = 1
HARD_RESET = 2
WDT_RESET = 3
DEEPSLEEP_RESET = 4
SOFT_RESET = 5

WLAN_WAKE = 1
PIN_WAKE = 2
RTC_WAKE = 3


def reset_cause() -> int:
    """Return the reset cause.
    
    Returns one of: PWRON_RESET, HARD_RESET, WDT_RESET, DEEPSLEEP_RESET, SOFT_RESET
    """
    return PWRON_RESET


def wake_reason() -> int:
    """Return the wake reason after deepsleep.
    
    Returns one of: WLAN_WAKE, PIN_WAKE, RTC_WAKE
    """
    return PIN_WAKE


def bootloader(timeout: int = 0) -> None:
    """Enter the bootloader (ends emulation).
    
    Args:
        timeout: Timeout in ms before bootloader mode (0 = immediate)
    """
    state.emit_event("bootloader", {"timeout": timeout})
    raise SystemExit("Bootloader mode requested")


def time_pulse_us(
    pin: Pin,
    pulse_level: int,
    timeout_us: int = 1000000,
) -> int:
    """Time a pulse on a pin.
    
    Wait for a pulse on the given pin at the specified level,
    then measure its duration in microseconds.
    
    In the emulator, returns a simulated pulse duration.
    
    Args:
        pin: Pin to measure
        pulse_level: 0 or 1 for the pulse level to time
        timeout_us: Maximum time to wait in microseconds
    
    Returns:
        Pulse duration in microseconds, or -1 if timeout, -2 if no pulse
    """
    state.emit_event("time_pulse_us", {
        "pin": pin._id,
        "pulse_level": pulse_level,
        "timeout_us": timeout_us,
    })
    # Return a simulated pulse duration (100-1000 us)
    return random.randint(100, 1000)


def bitstream(
    pin: Pin,
    encoding: int,
    timing: tuple,
    data: bytes,
) -> None:
    """Transmit a bitstream on a pin (used for WS2812 LEDs, etc).
    
    Args:
        pin: Output pin
        encoding: Encoding format (0=high/low timing per bit)
        timing: Tuple of timing values in ns
        data: Bytes to transmit
    """
    state.emit_event("bitstream", {
        "pin": pin._id,
        "encoding": encoding,
        "timing": list(timing),
        "data": data.hex(),
    })


# Memory access classes
class _MemoryAccess:
    """Base class for memory-mapped register access."""
    
    def __init__(self, size: int) -> None:
        self._size = size
        self._memory: dict[int, int] = {}
    
    def __getitem__(self, addr: int) -> int:
        return self._memory.get(addr, 0)
    
    def __setitem__(self, addr: int, value: int) -> None:
        mask = (1 << (self._size * 8)) - 1
        self._memory[addr] = value & mask
        state.emit_event(f"mem{self._size * 8}_write", {"addr": hex(addr), "value": value & mask})


# Memory access instances (mem8, mem16, mem32)
mem8 = _MemoryAccess(1)
mem16 = _MemoryAccess(2)
mem32 = _MemoryAccess(4)
