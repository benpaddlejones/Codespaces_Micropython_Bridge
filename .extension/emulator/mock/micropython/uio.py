"""MicroPython `uio` module emulator - wraps standard Python io."""
from io import StringIO, BytesIO, IOBase, FileIO

__all__ = ["StringIO", "BytesIO", "IOBase", "FileIO", "open"]

# uio.open is the same as built-in open
open = open
