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
        state.emit("neopixel_init", {"pin": str(pin), "n": n, "bpp": bpp})
    
    def __len__(self) -> int:
        return self.n
    
    def __getitem__(self, index: int):
        if 0 <= index < self.n:
            return self._pixels[index]
        raise IndexError("NeoPixel index out of range")
    
    def __setitem__(self, index: int, value: tuple):
        if 0 <= index < self.n:
            # Validate tuple size
            if len(value) != self.bpp:
                raise ValueError(f"Expected {self.bpp} values, got {len(value)}")
            self._pixels[index] = tuple(value)
        else:
            raise IndexError("NeoPixel index out of range")
    
    def fill(self, color: tuple):
        """Fill all pixels with the same color."""
        if len(color) != self.bpp:
            raise ValueError(f"Expected {self.bpp} values, got {len(color)}")
        for i in range(self.n):
            self._pixels[i] = tuple(color)
    
    def write(self):
        """Write pixel data to the strip."""
        # Emit state change for visualization
        state.emit("neopixel_write", {
            "pin": str(self.pin),
            "pixels": [list(p) for p in self._pixels]
        })
