"""MicroPython ``platform`` module emulator.

Real MicroPython exposes only a small subset of CPython's :mod:`platform`
module; this mock re-exports exactly that subset.

See: https://docs.micropython.org/en/latest/library/platform.html
"""
from __future__ import annotations

# The mock loads under sys.modules['platform'], shadowing CPython's
# platform module. The runner pre-stashes the real module under
# '_real_platform' so we can re-export from the canonical implementation.
import _real_platform as _platform

platform = _platform.platform
python_compiler = _platform.python_compiler
libc_ver = _platform.libc_ver


__all__ = ["platform", "python_compiler", "libc_ver"]
