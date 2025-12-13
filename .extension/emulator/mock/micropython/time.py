"""MicroPython `time` module - alias for utime with full functionality."""
from __future__ import annotations

# Re-export everything from utime for compatibility
from utime import (
    sleep,
    sleep_ms,
    sleep_us,
    ticks_ms,
    ticks_us,
    ticks_cpu,
    ticks_diff,
    ticks_add,
    time,
    time_ns,
    localtime,
    gmtime,
    mktime,
)
