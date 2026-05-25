"""MicroPython ``errno`` module emulator.

Re-exports the POSIX errno constants that MicroPython itself documents,
plus the standard ``errorcode`` mapping so user code that does
``errno.errorcode[err]`` keeps working.

See: https://docs.micropython.org/en/latest/library/errno.html
"""
from __future__ import annotations

# The mock loads under sys.modules['errno'], shadowing CPython's errno.
# The runner pre-stashes the real module under '_real_errno' so we can
# pull the canonical constants here without a circular import.
import _real_errno as _errno

EPERM = _errno.EPERM
ENOENT = _errno.ENOENT
EIO = _errno.EIO
EBADF = _errno.EBADF
EAGAIN = _errno.EAGAIN
ENOMEM = _errno.ENOMEM
EACCES = _errno.EACCES
EEXIST = _errno.EEXIST
ENODEV = _errno.ENODEV
EINVAL = _errno.EINVAL
ENOSPC = _errno.ENOSPC
EOPNOTSUPP = _errno.EOPNOTSUPP
EADDRINUSE = _errno.EADDRINUSE
ECONNABORTED = _errno.ECONNABORTED
ECONNRESET = _errno.ECONNRESET
ENOBUFS = _errno.ENOBUFS
ENOTCONN = _errno.ENOTCONN
ETIMEDOUT = _errno.ETIMEDOUT
ECONNREFUSED = _errno.ECONNREFUSED
EHOSTUNREACH = _errno.EHOSTUNREACH
EALREADY = _errno.EALREADY
EINPROGRESS = _errno.EINPROGRESS
ECANCELED = _errno.ECANCELED

# Mirror CPython's ``errorcode`` mapping (int -> symbolic name).
errorcode = dict(_errno.errorcode)


__all__ = [
    "EPERM",
    "ENOENT",
    "EIO",
    "EBADF",
    "EAGAIN",
    "ENOMEM",
    "EACCES",
    "EEXIST",
    "ENODEV",
    "EINVAL",
    "ENOSPC",
    "EOPNOTSUPP",
    "EADDRINUSE",
    "ECONNABORTED",
    "ECONNRESET",
    "ENOBUFS",
    "ENOTCONN",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "EALREADY",
    "EINPROGRESS",
    "ECANCELED",
    "errorcode",
]
