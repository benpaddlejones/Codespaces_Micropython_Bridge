"""Type stubs for MicroPython sys module."""
from typing import Any, List, Tuple, Optional

# Module attributes
argv: List[str]
byteorder: str
implementation: Tuple[str, Tuple[int, int, int], int]
maxsize: int
modules: dict[str, Any]
path: List[str]
platform: str
ps1: str
ps2: str
stderr: Any
stdin: Any
stdout: Any
version: str
version_info: Tuple[int, int, int]

def exit(retval: int = ...) -> None:
    """Terminate the current program with the given exit code."""
    ...

def atexit(func: Optional[Any] = ...) -> Optional[Any]:
    """Register cleanup function to call on exit."""
    ...

def print_exception(exc: BaseException, file: Any = ...) -> None:
    """Print exception with traceback to a file-like object."""
    ...
