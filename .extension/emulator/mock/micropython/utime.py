"""MicroPython `utime` module emulator for time operations.

This module provides mock implementations of MicroPython's time functions
for running MicroPython code in a standard Python environment.

Compatible with: MicroPython v1.20+ (RP2040/Raspberry Pi Pico)
Last API audit: December 2025

See: https://docs.micropython.org/en/latest/library/time.html
"""
from __future__ import annotations

import time as _time

# Minimum sleep threshold in microseconds - below this we just yield
_MIN_SLEEP_US = 100

# MicroPython uses 30-bit ticks with wraparound
_TICKS_PERIOD = 1 << 30
_TICKS_MAX = _TICKS_PERIOD - 1
_TICKS_HALFPERIOD = _TICKS_PERIOD // 2


def sleep(seconds: float) -> None:
    """Sleep for the given number of seconds.

    Fractional values are accepted for sub-second delays.
    """
    _time.sleep(seconds)


def sleep_ms(milliseconds: int) -> None:
    """Sleep for the given number of milliseconds.

    Negative or zero values are ignored (no sleep occurs).
    """
    if milliseconds > 0:
        _time.sleep(milliseconds / 1000.0)


def sleep_us(microseconds: int) -> None:
    """Sleep for microseconds.

    For very small delays (<100us), we skip actual sleep since
    Python's time.sleep() has ~50-100us overhead anyway.
    This dramatically improves performance for tight loops.
    """
    if microseconds >= _MIN_SLEEP_US:
        _time.sleep(microseconds / 1_000_000.0)
    # For sub-100us delays, we don't actually sleep - the function call
    # overhead itself provides some delay, and Python can't reliably
    # sleep for less than ~100us anyway


def ticks_ms() -> int:
    """Return increasing millisecond counter (30-bit, wraps at ~12.4 days)."""
    return int(_time.time() * 1000) & _TICKS_MAX


def ticks_us() -> int:
    """Return increasing microsecond counter (30-bit, wraps at ~17.9 minutes)."""
    return int(_time.time() * 1_000_000) & _TICKS_MAX


def ticks_cpu() -> int:
    """Return CPU ticks counter (high resolution)."""
    return int(_time.perf_counter() * 1_000_000_000) & _TICKS_MAX


def ticks_diff(ticks1: int, ticks2: int) -> int:
    """Compute difference between two tick values.

    Returns ticks1 - ticks2, handling 30-bit wraparound correctly.
    Result is a signed value in the range [-TICKS_HALFPERIOD .. TICKS_HALFPERIOD-1].
    """
    return ((ticks1 - ticks2 + _TICKS_HALFPERIOD) % _TICKS_PERIOD) - _TICKS_HALFPERIOD


def ticks_add(ticks: int, delta: int) -> int:
    """Add delta to a tick value, wrapping to 30-bit range."""
    return (ticks + delta) & _TICKS_MAX


def time() -> int:
    """Return seconds since epoch (Unix time)."""
    return int(_time.time())


def time_ns() -> int:
    """Return nanoseconds since epoch."""
    return int(_time.time() * 1_000_000_000)


def localtime(secs: int = None) -> tuple:
    """Convert seconds to local time tuple.

    Returns: (year, month, mday, hour, minute, second, weekday, yearday)
    """
    t = _time.localtime(secs)
    # MicroPython uses (year, month, mday, hour, minute, second, weekday, yearday)
    # Python uses (tm_year, tm_mon, tm_mday, tm_hour, tm_min, tm_sec, tm_wday, tm_yday, tm_isdst)
    return (t.tm_year, t.tm_mon, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec, t.tm_wday, t.tm_yday)


def gmtime(secs: int = None) -> tuple:
    """Convert seconds to UTC time tuple."""
    t = _time.gmtime(secs)
    return (t.tm_year, t.tm_mon, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec, t.tm_wday, t.tm_yday)


def mktime(tuple_time: tuple) -> int:
    """Convert local time tuple to seconds since epoch."""
    # Add tm_isdst=-1 to let Python figure it out
    return int(_time.mktime(tuple_time + (-1,)))


def strftime(fmt: str, t=None) -> str:
    """Format a time tuple according to ``fmt``.

    MicroPython exposes ``strftime`` on ports built with the ``MICROPY_PY_TIME_TIME_TIME_NS``
    extension. The mock always delegates to CPython's :func:`time.strftime`,
    converting an 8-tuple ``(year, mon, mday, hour, min, sec, wday, yday)``
    into the 9-tuple CPython expects.

    Args:
        fmt: A standard ``strftime`` format string.
        t: An 8-tuple as returned by :func:`localtime` / :func:`gmtime`;
            defaults to the current local time.

    Returns:
        The formatted time string.
    """
    if t is None:
        t = localtime()
    if len(t) == 8:
        # CPython needs a 9-tuple with tm_isdst.
        t = tuple(t) + (-1,)
    return _time.strftime(fmt, t)
