"""MicroPython `uhashlib` module emulator - wraps standard Python hashlib."""
from hashlib import sha256, sha1, md5

__all__ = ["sha256", "sha1", "md5"]

# MicroPython's uhashlib provides sha256, sha1, and md5 classes
# The API is compatible with Python's hashlib
