"""MicroPython ``vfs`` module emulator (v1.20+).

Provides ``mount`` / ``umount`` and stub block-device-backed filesystem
classes (``VfsFat``, ``VfsLfs2``) sufficient for tests that exercise the
filesystem-management API surface.

See: https://docs.micropython.org/en/latest/library/vfs.html
"""
from __future__ import annotations

from typing import Any, Dict, Tuple

import state

# Module-level registry of currently mounted filesystems. Keys are mount
# points, values are ``(fsobj, readonly)`` tuples.
_mounts: Dict[str, Tuple[Any, bool]] = {}


def mount(fsobj: Any, mount_point: str, *, readonly: bool = False) -> None:
    """Mount a filesystem object at ``mount_point``.

    Args:
        fsobj: Filesystem object exposing the VFS protocol.
        mount_point: Absolute mount point path (e.g. ``"/sd"``).
        readonly: When true, mount as read-only.

    Raises:
        OSError: When ``mount_point`` is already mounted.
    """
    if mount_point in _mounts:
        raise OSError(17, "EEXIST")
    _mounts[mount_point] = (fsobj, readonly)
    state.emit_event(
        "vfs",
        {"op": "mount", "mount_point": mount_point, "readonly": readonly},
    )


def umount(mount_point: str) -> None:
    """Unmount the filesystem mounted at ``mount_point``.

    Args:
        mount_point: Mount point previously passed to :func:`mount`.

    Raises:
        OSError: When ``mount_point`` is not currently mounted.
    """
    if mount_point not in _mounts:
        raise OSError(2, "ENOENT")
    del _mounts[mount_point]
    state.emit_event("vfs", {"op": "umount", "mount_point": mount_point})


class _VfsBase:
    """Shared stub behaviour for VFS classes.

    The emulator does not implement real block-device filesystems; instead
    every method records its invocation and returns benign defaults.
    """

    def __init__(self, block_device: Any) -> None:
        """Store the backing block device reference.

        Args:
            block_device: Object implementing the MicroPython block-device
                protocol (``readblocks``/``writeblocks``/``ioctl``).
        """
        self.block_device = block_device
        self._cwd = "/"

    @classmethod
    def mkfs(cls, block_device: Any) -> None:
        """Format ``block_device`` with a fresh filesystem.

        Args:
            block_device: Backing block device.
        """
        state.emit_event("vfs", {"op": "mkfs", "fs": cls.__name__})

    def statvfs(self, path: str) -> Tuple[int, int, int, int, int, int, int, int, int, int]:
        """Return a ``statvfs`` 10-tuple for ``path``.

        Args:
            path: Path inside the filesystem.

        Returns:
            A 10-tuple of zeros mirroring the layout of the real ``statvfs``.
        """
        return (0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

    def chdir(self, path: str) -> None:
        """Change the current working directory of the filesystem.

        Args:
            path: Target directory path.
        """
        self._cwd = path

    def getcwd(self) -> str:
        """Return the current working directory.

        Returns:
            The stored cwd path.
        """
        return self._cwd


class VfsFat(_VfsBase):
    """Stub FAT filesystem backed by an arbitrary block device."""


class VfsLfs2(_VfsBase):
    """Stub LittleFS v2 filesystem backed by an arbitrary block device."""

    def __init__(
        self,
        block_device: Any,
        readsize: int = 32,
        progsize: int = 32,
        lookahead: int = 32,
        mtime: bool = True,
    ) -> None:
        """Store LittleFS-specific tuning parameters.

        Args:
            block_device: Backing block device.
            readsize: Read buffer size in bytes.
            progsize: Program (write) buffer size in bytes.
            lookahead: Lookahead buffer size in bytes.
            mtime: When true, store modification timestamps.
        """
        super().__init__(block_device)
        self.readsize = readsize
        self.progsize = progsize
        self.lookahead = lookahead
        self.mtime = mtime


__all__ = ["mount", "umount", "VfsFat", "VfsLfs2"]
