"""Type stubs for MicroPython select module."""
from typing import Any, List, Optional, Tuple

POLLIN: int
POLLOUT: int
POLLERR: int
POLLHUP: int

def select(
    rlist: List[Any],
    wlist: List[Any],
    xlist: List[Any],
    timeout: Optional[float] = ...,
) -> Tuple[List[Any], List[Any], List[Any]]:
    """Wait until objects are ready for I/O."""
    ...

class poll:
    """Poll object for I/O multiplexing."""
    
    def __init__(self) -> None: ...
    
    def register(self, obj: Any, eventmask: int = ...) -> None:
        """Register object for polling."""
        ...
    
    def unregister(self, obj: Any) -> None:
        """Unregister object from polling."""
        ...
    
    def modify(self, obj: Any, eventmask: int) -> None:
        """Modify event mask for registered object."""
        ...
    
    def poll(self, timeout: int = ...) -> List[Tuple[Any, int]]:
        """Wait for events."""
        ...
    
    def ipoll(self, timeout: int = ..., flags: int = ...) -> Any:
        """Iterate over poll events."""
        ...
