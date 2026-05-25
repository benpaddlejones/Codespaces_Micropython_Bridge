"""Entry point for executing user MicroPython scripts inside the emulator."""
from __future__ import annotations

import argparse
import importlib
import importlib.util
import json
import os
import runpy
import sys
import traceback
from pathlib import Path
from typing import Dict

# Capture references to CPython stdlib modules BEFORE any sys.path mutation
# adds the mock directory. Once the mock dir is on sys.path, names that
# collide with stdlib modules (asyncio, errno, platform) would resolve to
# the local mock file and produce a circular self-import while the mock is
# still being initialised. Each captured module is stashed under a
# ``_real_<name>`` sentinel so the mock can delegate to the canonical
# implementation.
import asyncio as _REAL_ASYNCIO
import errno as _REAL_ERRNO
import platform as _REAL_PLATFORM
sys.modules['_real_asyncio'] = _REAL_ASYNCIO
sys.modules['_real_errno'] = _REAL_ERRNO
sys.modules['_real_platform'] = _REAL_PLATFORM

import state

EVENT_PREFIX = "__EMU__"

# Emulated MicroPython version. Surfaced through `micropython.__version__` and
# `micropython.MICROPYTHON_VERSION` so user code can branch on a target
# release (e.g. `if version >= (1, 23, 0): ...`).
MICROPYTHON_VERSION = (1, 23, 0)

# Project markers to search for when finding workspace root
PROJECT_MARKERS = [
    "config.py",      # MicroPython launcher config
    "main.py",        # Common entry point
    ".micropico",     # Pico Bridge marker file
    "py_scripts",     # Scripts directory
    "boot.py",        # MicroPython boot file
]


# Mock module injection map.
#
# Each entry is `(mock_filename_stem, [sys.modules names to install])`.
# - Loading order matters: later entries may `import` earlier ones, so list
#   foundational mocks first.
# - The mock file is loaded ONCE under its primary stem, then registered in
#   `sys.modules` under every name in the alias list.
# - For `u`-prefixed mocks the alias gives the modern, non-prefixed name
#   (`os`, `socket`, `time`, ...). This is safe because every `u*` mock starts
#   with `from <real_cpython_module> import *`, so the mock is a *superset* of
#   the real CPython module plus MicroPython extensions.
# - Genuinely new modules (asyncio, framebuf, vfs, ...) are only listed once.
_MOCK_MODULE_ALIASES = [
    # Built-in C modules that can only be replaced via sys.modules
    ("gc", ["gc"]),
    ("micropython", ["micropython"]),

    # u-prefixed mocks exposed under both names (load `utime` first; `time.py`
    # below depends on it).
    ("utime", ["utime", "time"]),
    ("uos", ["uos", "os"]),
    ("usocket", ["usocket", "socket"]),
    ("ujson", ["ujson", "json"]),
    ("ure", ["ure", "re"]),
    ("uselect", ["uselect", "select"]),
    ("uhashlib", ["uhashlib", "hashlib"]),
    ("ubinascii", ["ubinascii", "binascii"]),
    ("ustruct", ["ustruct", "struct"]),
    ("uio", ["uio", "io"]),
    ("uzlib", ["uzlib", "zlib"]),
    ("ucollections", ["ucollections", "collections"]),

    # New modules introduced in modern MicroPython (v1.20+). Each loads only
    # if the mock file is present, so removing one of these files is safe.
    ("asyncio", ["asyncio", "uasyncio"]),
    ("framebuf", ["framebuf"]),
    ("deflate", ["deflate"]),
    ("vfs", ["vfs"]),
    ("errno", ["errno"]),
    ("platform", ["platform"]),
]


def find_workspace_root(script_path: Path) -> Path:
    """
    Search upward from script location for the project root.

    Walks parent directories (up to 10 levels) looking for any of the
    PROJECT_MARKERS files/directories.

    Args:
        script_path: Resolved Path to the user's MicroPython script.

    Returns:
        Path: The first directory containing a project marker, or the
            script's parent directory as fallback.
    """
    current = script_path.parent
    
    # Search up to 10 levels (reasonable limit)
    for _ in range(10):
        for marker in PROJECT_MARKERS:
            marker_path = current / marker
            if marker_path.exists():
                return current
        
        parent = current.parent
        if parent == current:  # Reached filesystem root
            break
        current = parent
    
    # Fallback: use script's parent directory
    return script_path.parent


def emit(event: Dict[str, object]) -> None:
    """Send a JSON event to stdout for the VS Code extension to consume.

    Args:
        event: Dictionary with at least a "type" key, serialized as JSON
            and prefixed with EVENT_PREFIX.
    """
    print(f"{EVENT_PREFIX}{json.dumps(event)}", flush=True)


def configure_paths(mock_root: Path, script_path: Path, workspace_root: Path) -> None:
    """Configure sys.path and inject mock modules so user code resolves emulator modules.

    Prepends mock module directories to sys.path, adds workspace-relative
    MicroPython directories (py_scripts, lib), injects mock built-in modules
    into sys.modules, and patches sys.print_exception.

    Args:
        mock_root: Path to the emulator/mock directory.
        script_path: Resolved Path to the user script.
        workspace_root: Resolved Path to the project workspace root.
    """
    micropython_path = mock_root / "micropython"
    typings_path = mock_root / "typings"

    # Prepend to sys.path so user code resolves our modules first
    sys.path.insert(0, str(micropython_path))
    sys.path.insert(0, str(mock_root))
    sys.path.insert(0, str(script_path.parent))
    
    # Add common MicroPython directories relative to workspace
    # This allows imports like /py_scripts/v01 to resolve as ./py_scripts/v01
    py_scripts = workspace_root / "py_scripts"
    lib_dir = workspace_root / "lib"
    if py_scripts.exists():
        sys.path.insert(0, str(py_scripts))
    if lib_dir.exists():
        sys.path.insert(0, str(lib_dir))

    # Provide a hint for tooling that wants stub path
    os.environ.setdefault("MICROPYTHON_TYPINGS", str(typings_path))
    
    # Inject our mock modules into sys.modules for built-in modules that can't
    # be overridden via path manipulation (like gc which is a C module)
    _inject_mock_modules(micropython_path)
    
    # Patch built-in modules with MicroPython-specific functions
    # sys.print_exception is MicroPython-specific
    import traceback as _traceback
    def print_exception(exc, file=None):
        """Print an exception traceback to a file.

        Mirrors `sys.print_exception` from MicroPython, which is not
        available in CPython's `sys` module.

        Args:
            exc: The exception instance whose traceback should be printed.
            file: File-like object to write to. Defaults to `sys.stdout`.
        """
        if file is None:
            file = sys.stdout
        _traceback.print_exception(type(exc), exc, exc.__traceback__, file=file)
    sys.print_exception = print_exception


def _inject_mock_modules(micropython_path: Path) -> None:
    """Inject mock modules and their modern aliases into `sys.modules`.

    Some MicroPython modules cannot be resolved purely through `sys.path`
    manipulation:

    1. Built-in C modules (`gc`, `micropython`) shadow real CPython modules
       and have to be replaced explicitly.
    2. Modern MicroPython aliases every `u`-prefixed module to its non-prefixed
       name (`uos` -> `os`, `usocket` -> `socket`, ...). Without explicit
       aliasing, a user script that does `import os` would silently fall
       through to CPython's stdlib instead of the mock.
    3. Brand-new MicroPython modules (`asyncio`, `framebuf`, `deflate`,
       `vfs`, ...) only exist as mock files and need to be registered so
       `import asyncio` resolves.

    The injection follows the order defined in `_MOCK_MODULE_ALIASES`. Each
    mock module is loaded once under its primary stem (so its own internal
    `import <stem>` calls resolve to itself) and then re-published under any
    declared aliases.

    A `MICROPYTHON_VERSION` constant is also written onto the `micropython`
    mock so user code can branch on the emulated MicroPython release.

    Args:
        micropython_path: Filesystem path to the `micropython/` directory
            containing the individual mock module files.
    """
    # Preserve a reference to the real garbage collector so the gc mock can
    # delegate to it if needed.
    import gc as _real_gc
    sys.modules['_real_gc'] = _real_gc

    # `_real_asyncio` is stashed at runner-module load time (see top of file)
    # so the asyncio.py mock can delegate to the real implementation.

    # Idempotency guard. Tests (and other callers) may invoke this function
    # again after the first injection. Re-loading mocks at that point is
    # unsafe: `from zlib import compress` inside `uzlib.py` would then resolve
    # `zlib` to the previously-aliased uzlib mock (a subset of real zlib),
    # producing import failures. Detect the prior injection via the version
    # marker we set at the end and short-circuit.
    micropython_module = sys.modules.get('micropython')
    if micropython_module is not None and getattr(
        micropython_module, 'MICROPYTHON_VERSION', None
    ) is not None:
        return

    # PHASE 1 — Load every mock under its PRIMARY stem only.
    #
    # Loading is split from aliasing so that side-effecting imports inside the
    # mocks (e.g. `from socket import *` in usocket.py, which transitively
    # imports CPython `socket`, which itself imports `os`) all resolve against
    # the REAL CPython stdlib modules. If we installed `sys.modules['os'] =
    # uos_mock` before loading usocket, CPython's socket.py would then look up
    # `os._get_exports_list` on the mock and crash.
    loaded_modules = []  # list of (primary_stem, aliases, module)
    for module_stem, aliases in _MOCK_MODULE_ALIASES:
        module_file = micropython_path / f"{module_stem}.py"
        if not module_file.exists():
            continue

        spec = importlib.util.spec_from_file_location(module_stem, str(module_file))
        if not (spec and spec.loader):
            continue

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_stem] = module
        try:
            spec.loader.exec_module(module)
        except Exception:
            sys.modules.pop(module_stem, None)
            raise
        loaded_modules.append((module_stem, aliases, module))

    # PHASE 2 — Install non-primary aliases now that all mocks (and any
    # CPython stdlib they pulled in) are loaded.
    for module_stem, aliases, module in loaded_modules:
        for alias in aliases:
            if alias != module_stem:
                sys.modules[alias] = module

    # Advertise the emulated MicroPython version through the micropython mock.
    if 'micropython' in sys.modules:
        sys.modules['micropython'].__version__ = MICROPYTHON_VERSION
        sys.modules['micropython'].MICROPYTHON_VERSION = MICROPYTHON_VERSION


class _TickBudgetExceeded(SystemExit):
    """Raised when a script exceeds the configured sleep-call budget.

    Subclassing SystemExit makes the existing `except SystemExit` handler in
    main() emit a clean exit event instead of an exception.
    """


def _install_tick_budget(max_ticks: int) -> None:
    """Stop infinite-loop demo scripts after ``max_ticks`` sleep calls.

    MicroPython firmware-style scripts typically have a ``while True`` loop
    with a ``utime.sleep_ms(...)`` heartbeat. Under the emulator, that loop
    never terminates by itself. This helper wraps every sleep entry-point so
    that once the cumulative call count reaches ``max_ticks``, a clean
    SystemExit is raised — letting CI runs verify "the script ran N cycles
    without crashing" instead of having to kill the process.

    Args:
        max_ticks: Maximum number of sleep_/sleep_ms/sleep_us calls before
            the script is asked to exit.
    """
    utime = sys.modules.get('utime')
    if utime is None:
        return

    counter = {"ticks": 0}

    def _make_wrapper(original):
        """Build a tick-counting wrapper around a sleep entry point."""
        def wrapper(*args, **kwargs):
            """Increment the tick counter, then delegate to the real sleep."""
            counter["ticks"] += 1
            if counter["ticks"] >= max_ticks:
                emit({
                    "type": "tick_budget_exhausted",
                    "max_ticks": max_ticks,
                })
                raise _TickBudgetExceeded(0)
            return original(*args, **kwargs)
        wrapper.__wrapped__ = original
        wrapper.__name__ = getattr(original, "__name__", "sleep")
        return wrapper

    for name in ("sleep", "sleep_ms", "sleep_us"):
        original = getattr(utime, name, None)
        if callable(original):
            setattr(utime, name, _make_wrapper(original))

    # `time` is aliased to the same mock module, so the wrappers are already
    # visible via `time.sleep_ms` etc. No further work needed.


def main() -> int:
    """CLI entry point: parse arguments and run a MicroPython script in the emulator.

    Returns:
        int: Exit code (0 for success, non-zero for errors).
    """
    parser = argparse.ArgumentParser(description="Run MicroPython script in emulator")
    parser.add_argument("script", help="Path to the MicroPython script to execute")
    parser.add_argument(
        "--board",
        default="pico",
        help="Board identifier (future use, defaults to pico)",
    )
    parser.add_argument(
        "--cwd",
        default=None,
        help="Working directory to execute the script from",
    )
    parser.add_argument(
        "--max-ticks",
        type=int,
        default=None,
        help=(
            "Stop the script cleanly after N calls to utime.sleep[_ms|_us]. "
            "Useful for `while True` firmware-style demos so they don't run "
            "forever in CI. Overrides the EMULATOR_MAX_TICKS env var."
        ),
    )

    args = parser.parse_args()

    # Resolve the tick budget: CLI flag > env var > unlimited.
    max_ticks = args.max_ticks
    if max_ticks is None:
        env_val = os.environ.get("EMULATOR_MAX_TICKS")
        if env_val:
            try:
                max_ticks = int(env_val)
            except ValueError:
                max_ticks = None
    script_path = Path(args.script).resolve()

    if not script_path.exists():
        emit({"type": "error", "message": f"Script not found: {script_path}"})
        return 1

    mock_root = Path(__file__).resolve().parent
    
    # Determine workspace root by searching upward for project markers
    workspace_root = find_workspace_root(script_path)
    
    configure_paths(mock_root, script_path, workspace_root)

    if max_ticks is not None and max_ticks > 0:
        _install_tick_budget(max_ticks)

    if args.cwd:
        os.chdir(args.cwd)
    else:
        os.chdir(workspace_root)

    state.clear_reporters()
    state.set_reporter(emit)
    state.reset()

    emit(
        {
            "type": "start",
            "script": str(script_path),
            "board": args.board,
        }
    )

    try:
        runpy.run_path(str(script_path), run_name="__main__")
    except SystemExit as exc:
        emit({"type": "exit", "code": int(exc.code) if exc.code else 0})
        return int(exc.code) if exc.code else 0
    except KeyboardInterrupt:
        emit({"type": "exit", "code": 130, "message": "Script interrupted by user"})
        return 130
    except ImportError as exc:
        # Provide helpful message for missing modules
        module_name = getattr(exc, 'name', str(exc))
        emit(
            {
                "type": "exception",
                "message": f"Import Error: Could not import '{module_name}'",
                "hint": "This module may not be supported in the emulator. Check if it's a MicroPython-specific module.",
                "traceback": traceback.format_exc(),
            }
        )
        return 1
    except SyntaxError as exc:
        # Provide clear syntax error message with line info
        emit(
            {
                "type": "exception",
                "message": f"Syntax Error in {exc.filename or 'script'}",
                "hint": f"Line {exc.lineno}: {exc.msg}" if exc.lineno else str(exc.msg),
                "traceback": traceback.format_exc(),
            }
        )
        return 1
    except FileNotFoundError as exc:
        emit(
            {
                "type": "exception",
                "message": f"File Not Found: {exc.filename or str(exc)}",
                "hint": "Check that the file path is correct and the file exists.",
                "traceback": traceback.format_exc(),
            }
        )
        return 1
    except Exception:
        emit(
            {
                "type": "exception",
                "message": "Unhandled exception during execution",
                "traceback": traceback.format_exc(),
            }
        )
        return 1

    emit({"type": "complete", "status": "ok"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
