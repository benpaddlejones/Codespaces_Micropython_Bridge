"""MicroPython `uselect` module emulator - wraps standard Python select."""
from select import select, poll as _poll, POLLIN, POLLOUT, POLLERR, POLLHUP

__all__ = ["select", "poll", "POLLIN", "POLLOUT", "POLLERR", "POLLHUP"]


class poll:
    """
    MicroPython-compatible poll object.
    
    Provides a subset of select.poll() functionality.
    """
    
    def __init__(self):
        """Create an empty poll object backed by CPython's `select.poll`."""
        self._poll = _poll()
        self._fds = {}
    
    def register(self, obj, eventmask: int = POLLIN | POLLOUT):
        """
        Register an object for polling.
        
        Args:
            obj: Object with a fileno() method, or an integer fd
            eventmask: Events to poll for
        """
        if hasattr(obj, 'fileno'):
            fd = obj.fileno()
        else:
            fd = obj
        self._fds[fd] = obj
        self._poll.register(fd, eventmask)
    
    def unregister(self, obj):
        """
        Unregister an object from polling.
        """
        if hasattr(obj, 'fileno'):
            fd = obj.fileno()
        else:
            fd = obj
        if fd in self._fds:
            del self._fds[fd]
        self._poll.unregister(fd)
    
    def modify(self, obj, eventmask: int):
        """
        Modify the event mask for a registered object.
        """
        if hasattr(obj, 'fileno'):
            fd = obj.fileno()
        else:
            fd = obj
        self._poll.modify(fd, eventmask)
    
    def poll(self, timeout: int = -1):
        """Poll for events.

        Args:
            timeout: Timeout in milliseconds (-1 for blocking, 0 for
                non-blocking).

        Returns:
            List of ``(object, event_mask)`` tuples for ready descriptors.
        """
        if timeout == -1:
            cpython_timeout = None
        else:
            # MicroPython's poll.poll(timeout) takes milliseconds, and so
            # does CPython's select.poll.poll(timeout). Pass through
            # unchanged (the previous implementation divided by 1000 and
            # produced wildly-wrong waits).
            cpython_timeout = int(timeout)

        results = self._poll.poll(cpython_timeout)
        # Convert fd back to original object
        return [(self._fds.get(fd, fd), event) for fd, event in results]

    def ipoll(self, timeout: int = -1, flags: int = 0):
        """Iterating poll - yields events one at a time.

        This is more memory-efficient than ``poll()`` on real MicroPython
        because it avoids allocating a list.

        Args:
            timeout: Timeout in milliseconds (-1 for blocking).
            flags: Reserved for compatibility; ignored in the mock.

        Yields:
            ``(object, event_mask)`` tuples for ready descriptors.
        """
        for item in self.poll(timeout):
            yield item
