"""Type stubs for MicroPython gc (garbage collection) module."""

def enable() -> None:
    """Enable automatic garbage collection."""
    ...

def disable() -> None:
    """Disable automatic garbage collection."""
    ...

def isenabled() -> bool:
    """Return True if automatic garbage collection is enabled."""
    ...

def collect() -> None:
    """Run a garbage collection."""
    ...

def mem_alloc() -> int:
    """Return the number of bytes of heap RAM that are allocated."""
    ...

def mem_free() -> int:
    """Return the number of bytes of heap RAM that are available."""
    ...

def threshold(amount: int = ...) -> int:
    """Get or set the additional GC allocation threshold."""
    ...
