"""Type stubs for MicroPython collections module."""
from typing import Any, Dict, Iterator, Optional, Tuple, TypeVar

K = TypeVar("K")
V = TypeVar("V")

class OrderedDict(Dict[K, V]):
    """Dictionary that remembers insertion order."""
    
    def __init__(self, items: Optional[Any] = ...) -> None: ...
    def popitem(self, last: bool = ...) -> Tuple[K, V]: ...
    def move_to_end(self, key: K, last: bool = ...) -> None: ...

def namedtuple(
    name: str,
    fields: str,
) -> type:
    """Create a namedtuple class."""
    ...

class deque:
    """Double-ended queue."""
    
    def __init__(
        self,
        iterable: Any = ...,
        maxlen: Optional[int] = ...,
    ) -> None: ...
    
    def __len__(self) -> int: ...
    
    def __bool__(self) -> bool: ...
    
    def __iter__(self) -> Iterator[Any]: ...
    
    def append(self, x: Any) -> None:
        """Add to right end."""
        ...
    
    def appendleft(self, x: Any) -> None:
        """Add to left end."""
        ...
    
    def pop(self) -> Any:
        """Remove from right end."""
        ...
    
    def popleft(self) -> Any:
        """Remove from left end."""
        ...
