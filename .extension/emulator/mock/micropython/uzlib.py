"""MicroPython `uzlib` module emulator - wraps standard Python zlib."""
from zlib import decompress as _decompress, compress as _compress

__all__ = ["decompress", "DecompIO"]


def decompress(data: bytes, wbits: int = 0, bufsize: int = 0) -> bytes:
    """
    Decompress data using zlib/gzip/raw deflate.
    
    Args:
        data: Compressed data
        wbits: Window size bits (negative for raw deflate)
        bufsize: Initial output buffer size (ignored in mock)
    
    Returns:
        Decompressed data
    """
    # MicroPython uses different wbits conventions
    # wbits < 0 means raw deflate
    # wbits = 0 means auto-detect
    # wbits > 0 means zlib header
    if wbits < 0:
        wbits = -wbits
    elif wbits == 0:
        wbits = 15  # Default
    return _decompress(data, wbits)


class DecompIO:
    """
    Streaming decompression wrapper.
    
    This allows decompressing data as a file-like stream.
    """
    
    def __init__(self, stream, wbits: int = 0):
        """
        Create a decompression stream.
        
        Args:
            stream: Input stream with compressed data
            wbits: Window size bits
        """
        self._stream = stream
        self._wbits = wbits
        self._buffer = b""
        self._finished = False
    
    def read(self, size: int = -1) -> bytes:
        """Read and decompress data from the stream."""
        if self._finished:
            return b""
        
        # Read all remaining data and decompress
        data = self._stream.read()
        if data:
            try:
                self._buffer = decompress(data, self._wbits)
            except Exception:
                self._buffer = b""
        
        self._finished = True
        
        if size < 0:
            return self._buffer
        else:
            result = self._buffer[:size]
            self._buffer = self._buffer[size:]
            return result
    
    def readinto(self, buf: bytearray) -> int:
        """Read decompressed data into a buffer."""
        data = self.read(len(buf))
        buf[:len(data)] = data
        return len(data)
