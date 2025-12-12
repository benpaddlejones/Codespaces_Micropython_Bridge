"""MicroPython `uselect` module emulator - wraps standard Python select."""
from select import select, poll as _poll, POLLIN, POLLOUT, POLLERR, POLLHUP

__all__ = ["select", "poll", "POLLIN", "POLLOUT", "POLLERR", "POLLHUP"]


class poll:
    """
    MicroPython-compatible poll object.
    
    Provides a subset of select.poll() functionality.
    """
    
    def __init__(self):
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
        """
        Poll for events.
        
        Args:
            timeout: Timeout in milliseconds (-1 for blocking)
        
        Returns:
            List of (object, event) tuples
        """
        if timeout == -1:
            timeout = None
        elif timeout >= 0:
            timeout = timeout / 1000.0  # Convert ms to seconds
        
        results = self._poll.poll(timeout)
        # Convert fd back to original object
        return [(self._fds.get(fd, fd), event) for fd, event in results]
    
    def ipoll(self, timeout: int = -1, flags: int = 0):
        """
        Iterating poll - yields events one at a time.
        
        This is more memory-efficient than poll() for MicroPython.
        """
        for item in self.poll(timeout):
            yield item
