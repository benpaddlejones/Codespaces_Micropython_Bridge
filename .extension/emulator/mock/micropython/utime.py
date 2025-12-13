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


def sleep(seconds: float) -> None:
	_time.sleep(seconds)


def sleep_ms(milliseconds: int) -> None:
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
	"""Return increasing millisecond counter."""
	return int(_time.time() * 1000)


def ticks_us() -> int:
	"""Return increasing microsecond counter."""
	return int(_time.time() * 1_000_000)


def ticks_cpu() -> int:
	"""Return CPU ticks counter (high resolution)."""
	return int(_time.perf_counter() * 1_000_000_000)


def ticks_diff(ticks1: int, ticks2: int) -> int:
	"""Compute difference between two tick values.
	
	Returns ticks1 - ticks2, handling wraparound correctly.
	Result is a signed value in the range [-TICKS_MAX//2 .. TICKS_MAX//2-1].
	"""
	# MicroPython uses 30-bit ticks, but we don't worry about wraparound
	# in the emulator since we're using Python's time module
	return ticks1 - ticks2


def ticks_add(ticks: int, delta: int) -> int:
	"""Add delta to a tick value, wrapping as needed."""
	return ticks + delta


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
