"""Type stubs for MicroPython re module."""
from typing import Any, Iterator, List, Optional, Tuple, Union

def compile(pattern: str, flags: int = ...) -> "regex":
    """Compile a regular expression pattern."""
    ...

def match(pattern: str, string: str, flags: int = ...) -> Optional["match"]:
    """Try to apply pattern at the start of string."""
    ...

def search(pattern: str, string: str, flags: int = ...) -> Optional["match"]:
    """Scan through string looking for a match."""
    ...

def sub(
    pattern: str,
    repl: Union[str, Any],
    string: str,
    count: int = ...,
    flags: int = ...,
) -> str:
    """Replace occurrences of pattern in string."""
    ...

def split(pattern: str, string: str, maxsplit: int = ..., flags: int = ...) -> List[str]:
    """Split string by occurrences of pattern."""
    ...

class regex:
    """Compiled regular expression."""
    
    def match(self, string: str) -> Optional["match"]:
        """Match at the start of string."""
        ...
    
    def search(self, string: str) -> Optional["match"]:
        """Search for pattern in string."""
        ...
    
    def sub(self, repl: Union[str, Any], string: str, count: int = ...) -> str:
        """Replace occurrences."""
        ...
    
    def split(self, string: str, maxsplit: int = ...) -> List[str]:
        """Split string by pattern."""
        ...

class match:
    """Match object."""
    
    def group(self, index: int = ...) -> str:
        """Return matched substring or group."""
        ...
    
    def groups(self) -> Tuple[str, ...]:
        """Return all groups."""
        ...
    
    def start(self, index: int = ...) -> int:
        """Return start position of match."""
        ...
    
    def end(self, index: int = ...) -> int:
        """Return end position of match."""
        ...
    
    def span(self, index: int = ...) -> Tuple[int, int]:
        """Return (start, end) of match."""
        ...
