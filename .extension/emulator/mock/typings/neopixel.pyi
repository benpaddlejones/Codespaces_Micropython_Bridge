"""Type stubs for MicroPython neopixel module."""
from typing import Tuple, Union
from machine import Pin

class NeoPixel:
    """NeoPixel/WS2812 LED strip driver."""
    
    ORDER: tuple[int, int, int, int]
    
    def __init__(
        self,
        pin: Pin,
        n: int,
        *,
        bpp: int = ...,
        timing: int = ...,
    ) -> None: ...
    
    def __len__(self) -> int: ...
    
    def __getitem__(self, index: int) -> Tuple[int, ...]: ...
    
    def __setitem__(
        self, index: int, val: Union[Tuple[int, int, int], Tuple[int, int, int, int]]
    ) -> None: ...
    
    def fill(self, color: Union[Tuple[int, int, int], Tuple[int, int, int, int]]) -> None:
        """Fill all pixels with the same color."""
        ...
    
    def write(self) -> None:
        """Write data to pixels."""
        ...
