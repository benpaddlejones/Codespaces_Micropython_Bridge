"""Type stubs for MicroPython micropython module."""
from typing import Any, Callable, Optional

def const(expr: int) -> int:
    """Declare constant for compiler optimization."""
    ...

def opt_level(level: Optional[int] = ...) -> int:
    """Get/set optimization level for native code compilation."""
    ...

def alloc_emergency_exception_buf(size: int) -> None:
    """Allocate RAM for emergency exception buffer."""
    ...

def mem_info(verbose: bool = ...) -> None:
    """Print information about memory allocation."""
    ...

def qstr_info(verbose: bool = ...) -> None:
    """Print information about interned strings."""
    ...

def stack_use() -> int:
    """Return amount of stack currently in use."""
    ...

def heap_lock() -> None:
    """Lock the heap."""
    ...

def heap_unlock() -> None:
    """Unlock the heap."""
    ...

def kbd_intr(chr: int) -> None:
    """Set character that raises KeyboardInterrupt."""
    ...

def schedule(func: Callable[..., Any], arg: Any) -> None:
    """Schedule a function to be run from main thread."""
    ...
