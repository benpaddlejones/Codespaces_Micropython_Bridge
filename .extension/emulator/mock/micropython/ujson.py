"""MicroPython `ujson` module emulator - wraps standard Python json."""
from json import dumps, loads, load, dump

__all__ = ["dumps", "loads", "load", "dump"]

# MicroPython's ujson is compatible with Python's json
