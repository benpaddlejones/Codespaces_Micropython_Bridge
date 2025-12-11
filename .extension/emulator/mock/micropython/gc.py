"""Mock gc module for MicroPython emulation."""

import gc as _gc


def collect():
    """Run a garbage collection."""
    _gc.collect()


def enable():
    """Enable automatic garbage collection."""
    _gc.enable()


def disable():
    """Disable automatic garbage collection."""
    _gc.disable()


def isenabled() -> bool:
    """Check if automatic garbage collection is enabled."""
    return _gc.isenabled()


def mem_alloc() -> int:
    """Return the number of bytes of heap RAM that are allocated."""
    # Mock value - Python doesn't expose this directly
    return 50000


def mem_free() -> int:
    """Return the number of bytes of heap RAM that are available."""
    # Mock value - Pico has ~190KB free typically
    return 190000


def threshold(amount: int = None) -> int:
    """
    Set or query the GC allocation threshold.
    
    Args:
        amount: If provided, set the threshold; otherwise query it
        
    Returns:
        Current threshold value
    """
    if amount is not None:
        _gc.set_threshold(amount)
    thresholds = _gc.get_threshold()
    return thresholds[0] if thresholds else -1
