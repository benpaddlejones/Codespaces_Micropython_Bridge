"""Subset of the MicroPython `time` module."""
from __future__ import annotations

import time as _time


def sleep(seconds: float) -> None:
    _time.sleep(seconds)


def sleep_ms(milliseconds: int) -> None:
    _time.sleep(milliseconds / 1000.0)


def sleep_us(microseconds: int) -> None:
    _time.sleep(microseconds / 1_000_000.0)


def ticks_ms() -> int:
    return int(_time.time() * 1000)


def ticks_us() -> int:
    return int(_time.time() * 1_000_000)
