"""Type stubs for MicroPython os module."""
from typing import Iterator, List, Optional, Tuple, Union

sep: str

def uname() -> Tuple[str, str, str, str, str]:
    """Return information about the underlying system/OS."""
    ...

def urandom(n: int) -> bytes:
    """Return n random bytes."""
    ...

def chdir(path: str) -> None:
    """Change current directory."""
    ...

def getcwd() -> str:
    """Get current working directory."""
    ...

def ilistdir(path: str = ...) -> Iterator[Tuple[str, int, int, int]]:
    """Return an iterator of directory entries."""
    ...

def listdir(path: str = ...) -> List[str]:
    """List directory contents."""
    ...

def mkdir(path: str) -> None:
    """Create a directory."""
    ...

def remove(path: str) -> None:
    """Remove a file."""
    ...

def rmdir(path: str) -> None:
    """Remove a directory."""
    ...

def rename(old_path: str, new_path: str) -> None:
    """Rename a file or directory."""
    ...

def stat(path: str) -> Tuple[int, int, int, int, int, int, int, int, int, int]:
    """Get file/directory status."""
    ...

def statvfs(path: str) -> Tuple[int, int, int, int, int, int, int, int, int, int]:
    """Get filesystem statistics."""
    ...

def sync() -> None:
    """Sync all filesystems."""
    ...

def dupterm(stream: Optional[object], index: int = ...) -> Optional[object]:
    """Duplicate or switch the terminal."""
    ...

def mount(fsobj: object, mount_point: str, *, readonly: bool = ...) -> None:
    """Mount a filesystem object at a mount point."""
    ...

def umount(mount_point: str) -> None:
    """Unmount a filesystem."""
    ...

class VfsFat:
    """FAT filesystem."""
    def __init__(self, block_dev: object) -> None: ...
    def mkfs(self, block_dev: object) -> None: ...

class VfsLfs2:
    """LittleFS v2 filesystem."""
    def __init__(
        self,
        block_dev: object,
        readsize: int = ...,
        progsize: int = ...,
        lookahead: int = ...,
    ) -> None: ...
    def mkfs(self, block_dev: object) -> None: ...
