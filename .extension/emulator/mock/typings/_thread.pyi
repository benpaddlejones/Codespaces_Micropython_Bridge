"""Type stubs for MicroPython _thread module."""
from typing import Any, Callable, Optional, Tuple

class LockType:
    """Thread lock."""
    def acquire(self, waitflag: int = ..., timeout: float = ...) -> bool: ...
    def release(self) -> None: ...
    def locked(self) -> bool: ...
    def __enter__(self) -> bool: ...
    def __exit__(self, *args: Any) -> None: ...

def start_new_thread(
    function: Callable[..., Any],
    args: Tuple[Any, ...],
    kwargs: Optional[dict[str, Any]] = ...,
) -> int:
    """Start a new thread."""
    ...

def exit() -> None:
    """Exit the current thread."""
    ...

def allocate_lock() -> LockType:
    """Allocate a new lock object."""
    ...

def get_ident() -> int:
    """Return current thread identifier."""
    ...

def stack_size(size: int = ...) -> int:
    """Get or set thread stack size."""
    ...
