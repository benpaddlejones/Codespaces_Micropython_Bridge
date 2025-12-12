"""MicroPython `usocket` module emulator - wraps standard Python socket."""
from socket import *

# MicroPython's usocket is compatible with Python's socket
# Re-export everything from socket

__all__ = [
    'socket', 'AF_INET', 'AF_INET6', 'SOCK_STREAM', 'SOCK_DGRAM',
    'SOCK_RAW', 'SOL_SOCKET', 'SO_REUSEADDR', 'IPPROTO_TCP',
    'getaddrinfo', 'inet_aton', 'inet_ntoa',
]
