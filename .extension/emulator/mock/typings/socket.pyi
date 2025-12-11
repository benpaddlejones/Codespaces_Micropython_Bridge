"""Type stubs for MicroPython socket module."""
from typing import Optional, Tuple, Union

AF_INET: int
AF_INET6: int
SOCK_STREAM: int
SOCK_DGRAM: int
SOCK_RAW: int
IPPROTO_TCP: int
IPPROTO_UDP: int
IPPROTO_IP: int
SOL_SOCKET: int
SO_REUSEADDR: int
SO_BROADCAST: int
SO_KEEPALIVE: int
IP_ADD_MEMBERSHIP: int

def getaddrinfo(
    host: str,
    port: int,
    af: int = ...,
    type: int = ...,
    proto: int = ...,
    flags: int = ...,
) -> list[Tuple[int, int, int, str, Tuple[str, int]]]:
    """Get address information."""
    ...

class socket:
    """Socket object."""
    
    def __init__(
        self,
        af: int = ...,
        type: int = ...,
        proto: int = ...,
    ) -> None: ...
    
    def close(self) -> None:
        """Close the socket."""
        ...
    
    def bind(self, address: Tuple[str, int]) -> None:
        """Bind to address."""
        ...
    
    def listen(self, backlog: int = ...) -> None:
        """Listen for connections."""
        ...
    
    def accept(self) -> Tuple["socket", Tuple[str, int]]:
        """Accept a connection."""
        ...
    
    def connect(self, address: Tuple[str, int]) -> None:
        """Connect to address."""
        ...
    
    def send(self, bytes: bytes) -> int:
        """Send data."""
        ...
    
    def sendall(self, bytes: bytes) -> None:
        """Send all data."""
        ...
    
    def recv(self, bufsize: int) -> bytes:
        """Receive data."""
        ...
    
    def recvfrom(self, bufsize: int) -> Tuple[bytes, Tuple[str, int]]:
        """Receive data and sender address."""
        ...
    
    def sendto(self, bytes: bytes, address: Tuple[str, int]) -> int:
        """Send data to address."""
        ...
    
    def setsockopt(self, level: int, optname: int, value: Union[int, bytes]) -> None:
        """Set socket option."""
        ...
    
    def settimeout(self, value: Optional[float]) -> None:
        """Set timeout."""
        ...
    
    def setblocking(self, flag: bool) -> None:
        """Set blocking mode."""
        ...
    
    def makefile(self, mode: str = ..., buffering: int = ...) -> object:
        """Create file-like object from socket."""
        ...
    
    def read(self, size: int = ...) -> bytes:
        """Read data (stream mode)."""
        ...
    
    def readinto(self, buf: bytearray) -> int:
        """Read into buffer."""
        ...
    
    def readline(self) -> bytes:
        """Read a line."""
        ...
    
    def write(self, buf: bytes) -> int:
        """Write data (stream mode)."""
        ...
