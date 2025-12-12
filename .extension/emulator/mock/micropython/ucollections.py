"""MicroPython `ucollections` module emulator - wraps standard Python collections."""
from collections import namedtuple, OrderedDict, deque

__all__ = ["namedtuple", "OrderedDict", "deque"]

# MicroPython's ucollections provides these collection types
# The API is compatible with Python's collections
