"""Mock micropython module for MicroPython emulation.

This module provides MicroPython-specific functions that don't exist
in standard Python.
"""
from typing import Any, Callable


def const(value: int) -> int:
    """
    Declare a constant integer value.
    
    In real MicroPython, this is an optimization hint to the compiler.
    In our mock, we simply return the value unchanged.
    """
    return value


def native(func: Callable) -> Callable:
    """
    Decorator to compile a function to native machine code.
    
    In our mock, this is a no-op decorator.
    """
    return func


def viper(func: Callable) -> Callable:
    """
    Decorator to compile a function using the Viper emitter.
    
    In our mock, this is a no-op decorator.
    """
    return func


def alloc_emergency_exception_buf(size: int) -> None:
    """
    Allocate RAM for emergency exception buffer.
    
    This allows exceptions to be raised in low-memory situations.
    In our mock, this is a no-op.
    """
    pass


def opt_level(level: int = None) -> int:
    """
    Get or set the optimization level for compilation.
    
    Args:
        level: If provided, set the level (0-3); otherwise query it
        
    Returns:
        Current optimization level
    """
    # Mock - always return 0 (no optimization)
    return 0


def mem_info(verbose: bool = False) -> None:
    """
    Print information about current memory allocation.
    
    In our mock, this prints a simulated memory report.
    """
    print("stack: 1984 out of 7936")
    print("GC: total: 192512, used: 10240, free: 182272")
    if verbose:
        print(" No. of 1-blocks: 64, 2-blocks: 24, max blk sz: 128")


def qstr_info(verbose: bool = False) -> None:
    """
    Print information about currently interned strings.
    """
    print("qstr pool: n_pool=1, n_qstr=97, n_str_data_bytes=1552, n_total_bytes=4016")


def stack_use() -> int:
    """
    Return the current stack usage in bytes.
    """
    return 1984


def heap_lock() -> None:
    """
    Lock the heap to prevent allocation.
    """
    pass


def heap_unlock() -> int:
    """
    Unlock the heap to allow allocation.
    
    Returns:
        The lock depth after unlocking.
    """
    return 0


def kbd_intr(chr: int) -> None:
    """
    Set the character that triggers a KeyboardInterrupt.
    
    Args:
        chr: Character code (-1 to disable)
    """
    pass


def schedule(func: Callable, arg: Any) -> None:
    """
    Schedule a function to be called later.
    
    This schedules the function to be called "soon" from the main loop.
    In our mock, we call it immediately.
    
    Args:
        func: Function to call
        arg: Argument to pass to the function
    """
    func(arg)
