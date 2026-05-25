"""MicroPython ``framebuf`` module emulator.

Provides a ``FrameBuffer`` class that records drawing operations via the
shared :mod:`state` event channel rather than rasterising real pixels. This
is enough for tests and the webview's display-mirroring use cases.

See: https://docs.micropython.org/en/latest/library/framebuf.html
"""
from __future__ import annotations

from typing import Optional, Sequence

import state

# Pixel-format constants. Values mirror the MicroPython C source so that
# user code comparing against literal numbers behaves identically.
MONO_VLSB = 0
RGB565 = 1
GS4_HMSB = 2
MONO_HLSB = 3
MONO_HMSB = 4
GS2_HMSB = 5
GS8 = 6


class FrameBuffer:
    """In-memory framebuffer compatible with MicroPython's ``framebuf``.

    The constructor signature and method surface match MicroPython exactly;
    method bodies record their invocation via ``state.emit_event`` so that
    tests and the bridge UI can observe draw calls without needing real
    pixel buffers.
    """

    def __init__(
        self,
        buffer: "bytearray | memoryview",
        width: int,
        height: int,
        format: int,
        stride: Optional[int] = None,
    ) -> None:
        """Create a framebuffer view over ``buffer``.

        Args:
            buffer: Backing byte buffer (kept by reference).
            width: Width in pixels.
            height: Height in pixels.
            format: One of the ``MONO_*`` / ``RGB565`` / ``GS*`` constants.
            stride: Row stride in pixels; defaults to ``width``.
        """
        self.buffer = buffer
        self.width = width
        self.height = height
        self.format = format
        self.stride = stride if stride is not None else width
        state.emit_event(
            "framebuf",
            {
                "op": "init",
                "width": width,
                "height": height,
                "format": format,
                "stride": self.stride,
            },
        )

    def fill(self, c: int) -> None:
        """Fill the entire framebuffer with colour ``c``.

        Args:
            c: Colour value in the framebuffer's native format.
        """
        state.emit_event("framebuf", {"op": "fill", "c": c})

    def pixel(self, x: int, y: int, c: Optional[int] = None) -> Optional[int]:
        """Get or set a single pixel.

        Args:
            x: Pixel x coordinate.
            y: Pixel y coordinate.
            c: Colour to set; if ``None``, the pixel value is returned.

        Returns:
            The pixel value when ``c`` is ``None``; otherwise ``None``.
        """
        if c is None:
            state.emit_event("framebuf", {"op": "pixel_get", "x": x, "y": y})
            return 0
        state.emit_event("framebuf", {"op": "pixel_set", "x": x, "y": y, "c": c})
        return None

    def hline(self, x: int, y: int, w: int, c: int) -> None:
        """Draw a horizontal line of width ``w`` starting at ``(x, y)``.

        Args:
            x: Start x coordinate.
            y: Start y coordinate.
            w: Line width in pixels.
            c: Colour value.
        """
        state.emit_event("framebuf", {"op": "hline", "x": x, "y": y, "w": w, "c": c})

    def vline(self, x: int, y: int, h: int, c: int) -> None:
        """Draw a vertical line of height ``h`` starting at ``(x, y)``.

        Args:
            x: Start x coordinate.
            y: Start y coordinate.
            h: Line height in pixels.
            c: Colour value.
        """
        state.emit_event("framebuf", {"op": "vline", "x": x, "y": y, "h": h, "c": c})

    def line(self, x1: int, y1: int, x2: int, y2: int, c: int) -> None:
        """Draw a line from ``(x1, y1)`` to ``(x2, y2)``.

        Args:
            x1: Start x coordinate.
            y1: Start y coordinate.
            x2: End x coordinate.
            y2: End y coordinate.
            c: Colour value.
        """
        state.emit_event(
            "framebuf",
            {"op": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "c": c},
        )

    def rect(self, x: int, y: int, w: int, h: int, c: int, f: bool = False) -> None:
        """Draw a rectangle outline (or filled when ``f`` is true).

        Args:
            x: Top-left x coordinate.
            y: Top-left y coordinate.
            w: Width in pixels.
            h: Height in pixels.
            c: Colour value.
            f: When true, fill the rectangle.
        """
        state.emit_event(
            "framebuf",
            {"op": "rect", "x": x, "y": y, "w": w, "h": h, "c": c, "f": bool(f)},
        )

    def fill_rect(self, x: int, y: int, w: int, h: int, c: int) -> None:
        """Draw a filled rectangle.

        Args:
            x: Top-left x coordinate.
            y: Top-left y coordinate.
            w: Width in pixels.
            h: Height in pixels.
            c: Colour value.
        """
        state.emit_event(
            "framebuf",
            {"op": "fill_rect", "x": x, "y": y, "w": w, "h": h, "c": c},
        )

    def text(self, s: str, x: int, y: int, c: int = 1) -> None:
        """Draw a string in the built-in 8x8 font.

        Args:
            s: Text to draw.
            x: Top-left x coordinate.
            y: Top-left y coordinate.
            c: Colour value.
        """
        state.emit_event("framebuf", {"op": "text", "s": s, "x": x, "y": y, "c": c})

    def scroll(self, xstep: int, ystep: int) -> None:
        """Scroll the contents by ``(xstep, ystep)`` pixels.

        Args:
            xstep: Horizontal scroll amount; positive scrolls right.
            ystep: Vertical scroll amount; positive scrolls down.
        """
        state.emit_event("framebuf", {"op": "scroll", "xstep": xstep, "ystep": ystep})

    def blit(
        self,
        fbuf: "FrameBuffer",
        x: int,
        y: int,
        key: int = -1,
        palette: Optional["FrameBuffer"] = None,
    ) -> None:
        """Blit another framebuffer onto this one.

        Args:
            fbuf: Source framebuffer.
            x: Destination x coordinate.
            y: Destination y coordinate.
            key: Colour treated as transparent (``-1`` disables keying).
            palette: Optional palette framebuffer for format conversion.
        """
        state.emit_event(
            "framebuf",
            {"op": "blit", "x": x, "y": y, "key": key, "has_palette": palette is not None},
        )

    def poly(
        self,
        x: int,
        y: int,
        coords: Sequence[int],
        c: int,
        f: bool = False,
    ) -> None:
        """Draw a closed polygon.

        Args:
            x: Origin x offset added to each vertex.
            y: Origin y offset added to each vertex.
            coords: Flat sequence of ``[x0, y0, x1, y1, ...]`` vertices.
            c: Colour value.
            f: When true, fill the polygon.
        """
        state.emit_event(
            "framebuf",
            {"op": "poly", "x": x, "y": y, "n": len(coords) // 2, "c": c, "f": bool(f)},
        )

    def ellipse(
        self,
        x: int,
        y: int,
        xr: int,
        yr: int,
        c: int,
        f: bool = False,
        m: int = 0xF,
    ) -> None:
        """Draw an ellipse centred at ``(x, y)``.

        Args:
            x: Centre x coordinate.
            y: Centre y coordinate.
            xr: X radius.
            yr: Y radius.
            c: Colour value.
            f: When true, fill the ellipse.
            m: Quadrant mask (low 4 bits select which quadrants are drawn).
        """
        state.emit_event(
            "framebuf",
            {
                "op": "ellipse",
                "x": x,
                "y": y,
                "xr": xr,
                "yr": yr,
                "c": c,
                "f": bool(f),
                "m": m,
            },
        )


class FrameBuffer1(FrameBuffer):
    """Backwards-compatible alias defaulting to ``MONO_VLSB`` format."""

    def __init__(
        self,
        buffer: "bytearray | memoryview",
        width: int,
        height: int,
        stride: Optional[int] = None,
    ) -> None:
        """Create a 1-bit framebuffer.

        Args:
            buffer: Backing byte buffer.
            width: Width in pixels.
            height: Height in pixels.
            stride: Row stride in pixels; defaults to ``width``.
        """
        super().__init__(buffer, width, height, MONO_VLSB, stride)


__all__ = [
    "FrameBuffer",
    "FrameBuffer1",
    "MONO_VLSB",
    "MONO_HLSB",
    "MONO_HMSB",
    "RGB565",
    "GS2_HMSB",
    "GS4_HMSB",
    "GS8",
]
