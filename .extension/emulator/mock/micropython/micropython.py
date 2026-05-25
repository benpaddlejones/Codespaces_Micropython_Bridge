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


class RingIO:
    """Fixed-size byte ring buffer with stream-style ``read``/``write``.

    Introduced in MicroPython v1.23 (``micropython.RingIO``). Reads block
    semantics are non-blocking and return however many bytes are available.
    """

    def __init__(self, size: int) -> None:
        """Create an empty ring buffer with the given capacity.

        Args:
            size: Maximum number of bytes the buffer can hold.
        """
        self._size = int(size)
        self._buf = bytearray()

    def any(self) -> int:
        """Return the number of bytes currently available to read.

        Returns:
            Count of buffered bytes.
        """
        return len(self._buf)

    def read(self, nbytes: int = -1) -> bytes:
        """Read up to ``nbytes`` bytes from the buffer.

        Args:
            nbytes: Maximum bytes to read; ``-1`` returns everything
                currently buffered.

        Returns:
            The bytes read (may be shorter than ``nbytes``).
        """
        if nbytes < 0 or nbytes >= len(self._buf):
            out = bytes(self._buf)
            self._buf = bytearray()
            return out
        out = bytes(self._buf[:nbytes])
        del self._buf[:nbytes]
        return out

    def readinto(self, buf, nbytes: int = -1) -> int:
        """Read bytes into ``buf``.

        Args:
            buf: Pre-allocated buffer to fill.
            nbytes: Maximum bytes to read; ``-1`` fills as much of ``buf``
                as possible.

        Returns:
            Number of bytes written into ``buf``.
        """
        limit = len(buf) if nbytes < 0 else min(len(buf), nbytes)
        data = self.read(limit)
        n = len(data)
        buf[:n] = data
        return n

    def readline(self) -> bytes:
        """Read up to and including the next newline.

        Returns:
            The bytes up to and including ``\\n``, or whatever is buffered
            if no newline is present.
        """
        try:
            idx = self._buf.index(b"\n")
        except ValueError:
            return self.read(-1)
        return self.read(idx + 1)

    def write(self, data) -> int:
        """Append ``data`` to the buffer, dropping the oldest bytes if full.

        Args:
            data: Bytes to write.

        Returns:
            Number of bytes accepted (always ``len(data)``).
        """
        self._buf.extend(bytes(data))
        if len(self._buf) > self._size:
            overflow = len(self._buf) - self._size
            del self._buf[:overflow]
        return len(data)

    def close(self) -> None:
        """Discard buffered data and reset the ring buffer."""
        self._buf = bytearray()
