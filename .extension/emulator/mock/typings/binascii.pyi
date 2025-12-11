"""Type stubs for MicroPython binascii module."""
from typing import Union

def hexlify(data: bytes, sep: Union[str, bytes] = ...) -> bytes:
    """Convert binary data to hexadecimal representation."""
    ...

def unhexlify(data: Union[str, bytes]) -> bytes:
    """Convert hexadecimal data to binary representation."""
    ...

def a2b_base64(data: Union[str, bytes]) -> bytes:
    """Decode base64-encoded data."""
    ...

def b2a_base64(data: bytes, newline: bool = ...) -> bytes:
    """Encode binary data as base64."""
    ...

def crc32(data: bytes, value: int = ...) -> int:
    """Compute CRC-32 checksum."""
    ...
