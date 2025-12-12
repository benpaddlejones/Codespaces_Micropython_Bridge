"""Type stubs for MicroPython machine module."""
from typing import Callable, Optional, Union

class Pin:
    """GPIO Pin control."""
    IN: int
    OUT: int
    PULL_UP: int
    PULL_DOWN: int
    IRQ_RISING: int
    IRQ_FALLING: int

    def __init__(
        self,
        id: Union[int, str],
        mode: int = ...,
        pull: Optional[int] = ...,
        value: Optional[int] = ...,
    ) -> None: ...
    def value(self, val: Optional[int] = ...) -> int: ...
    def on(self) -> None: ...
    def off(self) -> None: ...
    def toggle(self) -> None: ...
    def irq(
        self,
        handler: Optional[Callable[["Pin"], None]] = ...,
        trigger: int = ...,
    ) -> None: ...

class PWM:
    """Pulse Width Modulation control."""
    def __init__(self, pin: Pin, freq: int = ..., duty_u16: int = ...) -> None: ...
    def freq(self, value: Optional[int] = ...) -> Optional[int]: ...
    def duty_u16(self, value: Optional[int] = ...) -> Optional[int]: ...
    def duty_ns(self, value: Optional[int] = ...) -> Optional[int]: ...
    def deinit(self) -> None: ...

class ADC:
    """Analog to Digital Converter."""
    def __init__(self, pin: Union[Pin, int]) -> None: ...
    def read_u16(self) -> int: ...

class I2C:
    """I2C bus communication."""
    def __init__(
        self,
        id: int,
        *,
        scl: Optional[Pin] = ...,
        sda: Optional[Pin] = ...,
        freq: int = ...,
    ) -> None: ...
    def scan(self) -> list[int]: ...
    def register_device(self, addr: int) -> None: ...
    def writeto(self, addr: int, buf: bytes, stop: bool = ...) -> int: ...
    def readfrom(self, addr: int, nbytes: int, stop: bool = ...) -> bytes: ...
    def writeto_mem(self, addr: int, memaddr: int, buf: bytes, *, addrsize: int = ...) -> None: ...
    def readfrom_mem(self, addr: int, memaddr: int, nbytes: int, *, addrsize: int = ...) -> bytes: ...
    def readfrom_mem_into(self, addr: int, memaddr: int, buf: bytearray, *, addrsize: int = ...) -> None: ...

class SoftI2C(I2C):
    """Software I2C implementation."""
    def __init__(self, *, scl: Pin, sda: Pin, freq: int = ...) -> None: ...

class SPI:
    """SPI bus communication."""
    MSB: int
    LSB: int

    def __init__(
        self,
        id: int,
        baudrate: int = ...,
        *,
        polarity: int = ...,
        phase: int = ...,
        bits: int = ...,
        firstbit: int = ...,
        sck: Optional[Pin] = ...,
        mosi: Optional[Pin] = ...,
        miso: Optional[Pin] = ...,
    ) -> None: ...
    def init(
        self,
        baudrate: int = ...,
        *,
        polarity: int = ...,
        phase: int = ...,
        bits: int = ...,
        firstbit: int = ...,
    ) -> None: ...
    def deinit(self) -> None: ...
    def read(self, nbytes: int, write: int = ...) -> bytes: ...
    def readinto(self, buf: bytearray, write: int = ...) -> None: ...
    def write(self, buf: bytes) -> None: ...
    def write_readinto(self, write_buf: bytes, read_buf: bytearray) -> None: ...

class SoftSPI(SPI):
    """Software SPI implementation."""
    def __init__(
        self,
        baudrate: int = ...,
        *,
        polarity: int = ...,
        phase: int = ...,
        bits: int = ...,
        firstbit: int = ...,
        sck: Pin,
        mosi: Pin,
        miso: Pin,
    ) -> None: ...

class Timer:
    """Hardware timer."""
    ONE_SHOT: int
    PERIODIC: int

    def __init__(self, id: int = ...) -> None: ...
    def init(
        self,
        *,
        mode: int = ...,
        freq: int = ...,
        period: int = ...,
        callback: Optional[Callable[["Timer"], None]] = ...,
    ) -> None: ...
    def deinit(self) -> None: ...

class UART:
    """Serial UART communication."""
    def __init__(
        self,
        id: int,
        baudrate: int = ...,
        bits: int = ...,
        parity: Optional[int] = ...,
        stop: int = ...,
        *,
        tx: Optional[Pin] = ...,
        rx: Optional[Pin] = ...,
    ) -> None: ...
    def init(
        self,
        baudrate: int = ...,
        bits: int = ...,
        parity: Optional[int] = ...,
        stop: int = ...,
    ) -> None: ...
    def deinit(self) -> None: ...
    def any(self) -> int: ...
    def read(self, nbytes: Optional[int] = ...) -> Optional[bytes]: ...
    def readinto(self, buf: bytearray, nbytes: Optional[int] = ...) -> Optional[int]: ...
    def readline(self) -> Optional[bytes]: ...
    def write(self, buf: bytes) -> Optional[int]: ...

class WDT:
    """Watchdog timer."""
    def __init__(self, timeout: int = ...) -> None: ...
    def feed(self) -> None: ...

class RTC:
    """Real-time clock."""
    def __init__(self) -> None: ...
    def datetime(
        self, datetimetuple: Optional[tuple[int, int, int, int, int, int, int, int]] = ...
    ) -> tuple[int, int, int, int, int, int, int, int]: ...

def reset() -> None:
    """Reset the device."""
    ...

def soft_reset() -> None:
    """Soft reset the device."""
    ...

def freq(hz: Optional[int] = ...) -> int:
    """Get or set CPU frequency."""
    ...

def unique_id() -> bytes:
    """Returns a unique identifier for the board/SoC."""
    ...

def idle() -> None:
    """Wait for an interrupt."""
    ...

def lightsleep(time_ms: Optional[int] = ...) -> None:
    """Light sleep mode."""
    ...

def deepsleep(time_ms: Optional[int] = ...) -> None:
    """Deep sleep mode."""
    ...

def disable_irq() -> int:
    """Disable interrupts, returning previous state."""
    ...

def enable_irq(state: int) -> None:
    """Re-enable interrupts."""
    ...

def mem8(addr: int, value: Optional[int] = ...) -> int:
    """Read/write 8-bit memory."""
    ...

def mem16(addr: int, value: Optional[int] = ...) -> int:
    """Read/write 16-bit memory."""
    ...

def mem32(addr: int, value: Optional[int] = ...) -> int:
    """Read/write 32-bit memory."""
    ...

