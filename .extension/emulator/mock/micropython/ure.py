"""MicroPython `ure` module emulator - wraps standard Python re."""
from re import compile, match, search, sub, split, DEBUG

__all__ = ["compile", "match", "search", "sub", "split", "DEBUG"]

# MicroPython's ure is mostly compatible with Python's re
# Note: MicroPython's ure has some limitations compared to full Python re
