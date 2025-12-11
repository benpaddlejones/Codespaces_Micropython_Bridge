"""Type stubs for MicroPython json module."""
from typing import Any, Optional, IO

def dumps(obj: Any, separators: Optional[tuple[str, str]] = ...) -> str:
    """Serialize object to JSON string."""
    ...

def dump(obj: Any, stream: IO[str], separators: Optional[tuple[str, str]] = ...) -> None:
    """Serialize object to JSON and write to stream."""
    ...

def loads(s: str) -> Any:
    """Deserialize JSON string to object."""
    ...

def load(stream: IO[str]) -> Any:
    """Deserialize JSON from stream."""
    ...
