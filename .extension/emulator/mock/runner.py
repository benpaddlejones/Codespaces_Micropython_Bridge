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
    
    # Inject our mock modules into sys.modules for built-in modules that can't
    # be overridden via path manipulation (like gc which is a C module)
    _inject_mock_modules(micropython_path)
    
    # Patch built-in modules with MicroPython-specific functions
    # sys.print_exception is MicroPython-specific
    import traceback as _traceback
    def print_exception(exc, file=None):
        if file is None:
            file = sys.stdout
        _traceback.print_exception(type(exc), exc, exc.__traceback__, file=file)
    sys.print_exception = print_exception


def _inject_mock_modules(micropython_path: Path) -> None:
    """
    Inject mock modules into sys.modules to override built-in C modules.
    
    Some Python modules (like gc) are implemented in C and cannot be
    overridden via sys.path manipulation. We must explicitly import our
    mock versions and inject them into sys.modules.
    """
    # First, save references to the real built-in modules before replacing them
    # This allows our mocks to delegate to the real implementations
    import gc as _real_gc
    
    # Store the real module for our mock to use
    sys.modules['_real_gc'] = _real_gc
    
    # List of modules we need to inject (modules that shadow built-ins)
    modules_to_inject = [
        "gc",           # Built-in garbage collector
        "micropython",  # MicroPython-specific module (as package)
    ]
    
    for module_name in modules_to_inject:
        module_file = micropython_path / f"{module_name}.py"
        if module_file.exists():
            spec = importlib.util.spec_from_file_location(
                module_name, str(module_file)
            )
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = module
                spec.loader.exec_module(module)


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
