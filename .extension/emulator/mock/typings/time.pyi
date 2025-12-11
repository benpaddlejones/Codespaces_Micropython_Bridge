"""Type stubs for MicroPython time module (alias for utime)."""

def sleep(seconds: float) -> None:
    """Sleep for given number of seconds."""
    ...

def sleep_ms(ms: int) -> None:
    """Sleep for given number of milliseconds."""
    ...

def sleep_us(us: int) -> None:
    """Sleep for given number of microseconds."""
    ...

def ticks_ms() -> int:
    """Returns an incrementing millisecond counter."""
    ...

def ticks_us() -> int:
    """Returns an incrementing microsecond counter."""
    ...

def ticks_cpu() -> int:
    """Returns an incrementing CPU cycle counter."""
    ...

def ticks_add(ticks: int, delta: int) -> int:
    """Add a delta to a ticks value."""
    ...

def ticks_diff(ticks1: int, ticks2: int) -> int:
    """Compute difference between two ticks values."""
    ...

def time() -> int:
    """Returns seconds since epoch (if RTC is set)."""
    ...

def localtime(secs: int = ...) -> tuple[int, int, int, int, int, int, int, int]:
    """Convert seconds to local time tuple."""
    ...

def mktime(t: tuple[int, int, int, int, int, int, int, int]) -> int:
    """Convert local time tuple to seconds."""
    ...
