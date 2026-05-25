"""MicroPython ``deflate`` module emulator (v1.21+).

Wraps CPython's :mod:`zlib` to provide ``DeflateIO`` for streaming
compression and decompression in the same format families MicroPython
exposes (raw, zlib, gzip, auto-detect).

See: https://docs.micropython.org/en/latest/library/deflate.html
"""
from __future__ import annotations

import zlib as _zlib
from typing import Any, Optional

import state

# Format selectors mapped to the ``wbits`` values the underlying ``zlib``
# decompressor accepts. ``AUTO`` lets ``zlib`` auto-detect zlib vs gzip.
AUTO = 0
RAW = -15
ZLIB = 15
GZIP = 31


class DeflateIO:
    """Stream wrapper providing ``read``/``write`` over a compressed stream.

    A read from a ``DeflateIO`` returns decompressed bytes pulled from the
    underlying stream; a write feeds raw bytes through a compressor before
    forwarding them. This matches the bidirectional API documented for
    MicroPython v1.21+.
    """

    def __init__(
        self,
        stream: Any,
        format: int = AUTO,
        wbits: int = 0,
        close: bool = False,
    ) -> None:
        """Wrap ``stream`` for compression and/or decompression.

        Args:
            stream: Underlying stream with ``read`` / ``write`` methods.
            format: One of ``AUTO``, ``RAW``, ``ZLIB``, ``GZIP``.
            wbits: Optional override for the window-bits value; ``0`` keeps
                the value implied by ``format``.
            close: When true, ``close()`` also closes the underlying stream.
        """
        self._stream = stream
        self._format = format
        self._wbits = wbits if wbits else format
        self._close_underlying = close
        self._decomp: Optional[Any] = None
        self._comp: Optional[Any] = None
        self._closed = False

    def _ensure_decomp(self) -> Any:
        """Lazily build the decompressor object.

        Returns:
            The ``zlib.decompressobj`` instance, created on first read.
        """
        if self._decomp is None:
            wbits = self._wbits if self._wbits else 15
            self._decomp = _zlib.decompressobj(wbits)
        return self._decomp

    def _ensure_comp(self) -> Any:
        """Lazily build the compressor object.

        Returns:
            The ``zlib.compressobj`` instance, created on first write.
        """
        if self._comp is None:
            self._comp = _zlib.compressobj()
        return self._comp

    def read(self, size: int = -1) -> bytes:
        """Read decompressed bytes from the underlying stream.

        Args:
            size: Maximum number of bytes to read; ``-1`` reads to EOF.

        Returns:
            A ``bytes`` object of up to ``size`` decompressed bytes.
        """
        raw = self._stream.read() if size < 0 else self._stream.read(size)
        if not raw:
            state.emit_event("deflate", {"op": "read", "n": 0})
            return b""
        out = self._ensure_decomp().decompress(raw)
        state.emit_event("deflate", {"op": "read", "n": len(out)})
        return out

    def readinto(self, buf: bytearray) -> int:
        """Read decompressed bytes into ``buf``.

        Args:
            buf: Pre-allocated buffer to fill.

        Returns:
            Number of bytes written into ``buf``.
        """
        data = self.read(len(buf))
        n = len(data)
        buf[:n] = data
        return n

    def write(self, data: bytes) -> int:
        """Compress ``data`` and forward it to the underlying stream.

        Args:
            data: Raw bytes to compress.

        Returns:
            Number of input bytes consumed.
        """
        chunk = self._ensure_comp().compress(bytes(data))
        if chunk:
            self._stream.write(chunk)
        state.emit_event("deflate", {"op": "write", "n": len(data)})
        return len(data)

    def close(self) -> None:
        """Flush any pending compressor output and release resources."""
        if self._closed:
            return
        if self._comp is not None:
            tail = self._comp.flush()
            if tail:
                self._stream.write(tail)
        if self._close_underlying:
            closer = getattr(self._stream, "close", None)
            if closer is not None:
                closer()
        self._closed = True
        state.emit_event("deflate", {"op": "close"})


__all__ = ["DeflateIO", "AUTO", "RAW", "ZLIB", "GZIP"]
