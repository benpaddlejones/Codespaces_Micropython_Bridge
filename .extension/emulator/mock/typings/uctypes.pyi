"""Type stubs for MicroPython uctypes module."""
from typing import Any, Union

NATIVE: int
LITTLE_ENDIAN: int
BIG_ENDIAN: int

VOID: int
UINT8: int
INT8: int
UINT16: int
INT16: int
UINT32: int
INT32: int
UINT64: int
INT64: int
FLOAT32: int
FLOAT64: int
PTR: int
ARRAY: int

BFUINT8: int
BFINT8: int
BFUINT16: int
BFINT16: int
BFUINT32: int
BFINT32: int
BF_POS: int
BF_LEN: int

def sizeof(struct: Union[type, "struct"], layout_type: int = ...) -> int:
    """Return the size of a structure in bytes."""
    ...

def addressof(obj: Any) -> int:
    """Return address of an object."""
    ...

def bytes_at(addr: int, size: int) -> bytes:
    """Return bytes at given address."""
    ...

def bytearray_at(addr: int, size: int) -> bytearray:
    """Return bytearray at given address."""
    ...

class struct:
    """Create structured access to memory."""
    def __init__(self, addr: int, descriptor: dict[str, Any], layout_type: int = ...) -> None: ...
