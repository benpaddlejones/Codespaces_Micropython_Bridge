"""Type stubs for MicroPython array module."""
from typing import Any, Iterable, Iterator, Optional, overload, Union

class array:
    """Efficient arrays of numeric values."""
    
    typecode: str
    
    def __init__(
        self,
        typecode: str,
        initializer: Union[bytes, Iterable[int], Iterable[float], None] = ...,
    ) -> None: ...
    
    def __len__(self) -> int: ...
    
    @overload
    def __getitem__(self, index: int) -> Union[int, float]: ...
    @overload
    def __getitem__(self, index: slice) -> "array": ...
    
    def __setitem__(self, index: int, value: Union[int, float]) -> None: ...
    
    def __iter__(self) -> Iterator[Union[int, float]]: ...
    
    def __add__(self, other: "array") -> "array": ...
    
    def __iadd__(self, other: "array") -> "array": ...
    
    def append(self, val: Union[int, float]) -> None:
        """Append a value."""
        ...
    
    def extend(self, iterable: Union["array", Iterable[Union[int, float]]]) -> None:
        """Extend array with values from iterable."""
        ...
    
    def decode(self) -> str:
        """Decode array as UTF-8 string (for byte arrays)."""
        ...
