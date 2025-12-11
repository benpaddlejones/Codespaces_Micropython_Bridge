"""Type stubs for MicroPython struct module."""
from typing import Any, Tuple

def calcsize(fmt: str) -> int:
    """Return the size of the struct described by format string."""
    ...

def pack(fmt: str, *values: Any) -> bytes:
    """Pack values according to format string."""
    ...

def pack_into(fmt: str, buffer: bytearray, offset: int, *values: Any) -> None:
    """Pack values into buffer starting at offset."""
    ...

def unpack(fmt: str, data: bytes) -> Tuple[Any, ...]:
    """Unpack data according to format string."""
    ...

def unpack_from(fmt: str, data: bytes, offset: int = ...) -> Tuple[Any, ...]:
    """Unpack data from buffer starting at offset."""
    ...
