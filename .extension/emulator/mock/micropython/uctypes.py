"""MicroPython `uctypes` module emulator.

This module provides low-level C-style type access. In the emulator,
we provide a simplified mock implementation.
"""
from typing import Any, Dict, Union

# Type constants
UINT8 = 0
INT8 = 1
UINT16 = 2
INT16 = 3
UINT32 = 4
INT32 = 5
UINT64 = 6
INT64 = 7
FLOAT32 = 8
FLOAT64 = 9
VOID = 10

# Address layout constants
NATIVE = 0
LITTLE_ENDIAN = 0
BIG_ENDIAN = 1

# Bit field constants
BFUINT8 = 0x00
BFINT8 = 0x10
BFUINT16 = 0x20
BFINT16 = 0x30
BFUINT32 = 0x40
BFINT32 = 0x50

# Array type marker
ARRAY = -1073741824

# Pointer type marker  
PTR = -2147483648


def sizeof(struct: Any) -> int:
    """Return the size of a structure or type in bytes."""
    if isinstance(struct, int):
        # Type constant
        sizes = {
            UINT8: 1, INT8: 1,
            UINT16: 2, INT16: 2,
            UINT32: 4, INT32: 4,
            UINT64: 8, INT64: 8,
            FLOAT32: 4, FLOAT64: 8,
            VOID: 0,
        }
        return sizes.get(struct, 4)
    elif hasattr(struct, '__len__'):
        return len(struct)
    return 4  # Default size


def addressof(obj: Any) -> int:
    """Return the address of an object."""
    return id(obj)


def bytes_at(addr: int, size: int) -> bytes:
    """Return bytes at the given address."""
    # Mock - return zeros
    return bytes(size)


def bytearray_at(addr: int, size: int) -> bytearray:
    """Return a bytearray at the given address."""
    # Mock - return zeros
    return bytearray(size)


class struct:
    """Mock structure type for memory-mapped structures."""
    
    def __init__(self, addr: Union[int, bytes, bytearray], descriptor: Dict, layout: int = NATIVE):
        """
        Create a structure at the given address or from buffer.
        
        Args:
            addr: Memory address or buffer
            descriptor: Structure descriptor dictionary
            layout: Memory layout (NATIVE, LITTLE_ENDIAN, BIG_ENDIAN)
        """
        if isinstance(addr, (bytes, bytearray)):
            self._buffer = bytearray(addr)
            self._addr = id(self._buffer)
        else:
            self._addr = addr
            self._buffer = bytearray(64)  # Mock buffer
        
        self._descriptor = descriptor
        self._layout = layout
    
    def __getattr__(self, name: str) -> Any:
        if name.startswith('_'):
            return super().__getattribute__(name)
        # Mock - return 0 for any field access
        return 0
    
    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith('_'):
            super().__setattr__(name, value)
        # Mock - ignore field writes
        pass
