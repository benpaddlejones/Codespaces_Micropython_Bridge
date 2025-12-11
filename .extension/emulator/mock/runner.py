"""Entry point for executing user MicroPython scripts inside the emulator."""
from __future__ import annotations

import argparse
import importlib
import json
import os
import runpy
import sys
import traceback
from pathlib import Path
from typing import Dict

import state

EVENT_PREFIX = "__EMU__"

# Project markers to search for when finding workspace root
PROJECT_MARKERS = [
    "config.py",      # MicroPython launcher config
    "main.py",        # Common entry point
    ".micropico",     # Pico Bridge marker file
    "py_scripts",     # Scripts directory
    "boot.py",        # MicroPython boot file
]


def find_workspace_root(script_path: Path) -> Path:
    """
    Search upward from script location for project root.
    Returns the first directory containing a project marker.
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
    """Send an event to stdout for the host extension to consume."""
    print(f"{EVENT_PREFIX}{json.dumps(event)}", flush=True)


def configure_paths(mock_root: Path, script_path: Path, workspace_root: Path) -> None:
    """Ensure our mock modules are importable ahead of user code."""
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
    
    # Patch built-in modules with MicroPython-specific functions
    # sys.print_exception is MicroPython-specific
    import traceback as _traceback
    def print_exception(exc, file=None):
        if file is None:
            file = sys.stdout
        _traceback.print_exception(type(exc), exc, exc.__traceback__, file=file)
    sys.print_exception = print_exception


def main() -> int:
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

    args = parser.parse_args()
    script_path = Path(args.script).resolve()

    if not script_path.exists():
        emit({"type": "error", "message": f"Script not found: {script_path}"})
        return 1

    mock_root = Path(__file__).resolve().parent
    
    # Determine workspace root by searching upward for project markers
    workspace_root = find_workspace_root(script_path)
    
    configure_paths(mock_root, script_path, workspace_root)

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
