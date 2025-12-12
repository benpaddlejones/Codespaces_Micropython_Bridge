"""MicroPython `ubinascii` module emulator - wraps standard Python binascii."""
from binascii import hexlify, unhexlify, a2b_base64, b2a_base64

__all__ = ["hexlify", "unhexlify", "a2b_base64", "b2a_base64"]

# MicroPython's ubinascii is compatible with Python's binascii
