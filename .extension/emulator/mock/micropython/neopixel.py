"""Mock neopixel module for MicroPython emulation."""

import state
from machine import Pin


class NeoPixel:
    """Mock NeoPixel strip controller."""
    
    def __init__(self, pin: Pin, n: int, bpp: int = 3, timing: int = 1):
        """
        Initialize NeoPixel strip.
        
        Args:
            pin: Pin object connected to NeoPixel data line
            n: Number of LEDs in the strip
            bpp: Bytes per pixel (3 for RGB, 4 for RGBW)
            timing: Timing type (0 for 400KHz, 1 for 800KHz)
        """
        self.pin = pin
        self.n = n
        self.bpp = bpp
        self.timing = timing
        self._pixels = [(0, 0, 0) if bpp == 3 else (0, 0, 0, 0) for _ in range(n)]
        state.emit_event("neopixel_init", {"pin": pin._id, "n": n, "bpp": bpp})
    
    def __len__(self) -> int:
        """Return the number of LEDs in the strip."""
        return self.n
    
    def __getitem__(self, index: int):
        """Get the color tuple of the LED at the given index.

        Args:
            index: LED index (0-based).

        Returns:
            tuple: RGB or RGBW color tuple.

        Raises:
            IndexError: If index is out of range.
        """
        if 0 <= index < self.n:
            return self._pixels[index]
        raise IndexError("NeoPixel index out of range")
    
    def __setitem__(self, index: int, value: tuple):
        """Set the color of the LED at the given index.

        Args:
            index: LED index (0-based).
            value: RGB or RGBW color tuple.

        Raises:
            IndexError: If index is out of range.
            ValueError: If tuple size doesn't match bpp.
        """
        if 0 <= index < self.n:
            # Validate tuple size
            if len(value) != self.bpp:
                raise ValueError(f"Expected {self.bpp} values, got {len(value)}")
            self._pixels[index] = tuple(value)
        else:
            raise IndexError("NeoPixel index out of range")
    
    def fill(self, color: tuple):
        """Fill all pixels with the same color.

        Args:
            color: RGB or RGBW color tuple.

        Raises:
            ValueError: If tuple size doesn't match bpp.
        """
        if len(color) != self.bpp:
            raise ValueError(f"Expected {self.bpp} values, got {len(color)}")
        for i in range(self.n):
            self._pixels[i] = tuple(color)
    
    def write(self):
        """Write pixel data to the strip."""
        # Emit state change for visualization
        state.emit_event("neopixel_write", {
            "pin": self.pin._id,
            "pixels": [list(p) for p in self._pixels]
        })
