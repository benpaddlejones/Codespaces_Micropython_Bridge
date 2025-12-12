"""MicroPython `ustruct` module emulator - wraps standard Python struct."""
from struct import pack, unpack, unpack_from, pack_into, calcsize

__all__ = ["pack", "unpack", "unpack_from", "pack_into", "calcsize"]

# MicroPython's ustruct is compatible with Python's struct
