"""
Pytest fixtures for testing the launcher error harness under CPython.

The launcher targets MicroPython, so these fixtures stub the MicroPython-only
modules (machine, utime, uio, uos, sys.print_exception) and build a fresh,
isolated `config` module + temp filesystem per test. Tests always import the
CANONICAL launcher from .extension/project/lib/launcher (the source of truth).
"""

import io
import os
import sys
import types

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAUNCHER_LIB = os.path.join(REPO_ROOT, ".extension", "project", "lib")

# MicroPython has no .pyc cache; CPython's would serve stale student code in
# rerun tests (same file size + same mtime-second defeats invalidation).
sys.dont_write_bytecode = True

# Modules we stub/inject per test and must clean out of sys.modules.
STUB_MODULE_NAMES = ("config", "utime", "uio", "uos", "machine")


def _purge_launcher_modules():
    """Remove launcher (and stub) modules so each test gets a fresh import."""
    for name in list(sys.modules):
        if name == "launcher" or name.startswith("launcher."):
            del sys.modules[name]
    for name in STUB_MODULE_NAMES:
        sys.modules.pop(name, None)


def _make_machine_stub():
    machine = types.ModuleType("machine")

    class Pin:
        IN = 0
        OUT = 1
        PULL_UP = 2
        IRQ_FALLING = 4
        IRQ_RISING = 8

        def __init__(self, *args, **kwargs):
            pass

        def irq(self, *args, **kwargs):
            pass

    machine.Pin = Pin
    return machine


class LauncherEnv:
    """A fresh, isolated launcher environment on a temp filesystem."""

    def __init__(self, tmp_path, localtime=True):
        self.tmp = str(tmp_path)
        self.script_dir = os.path.join(self.tmp, "py_scripts")
        self.lib_dir = os.path.join(self.tmp, "lib")
        os.makedirs(self.script_dir, exist_ok=True)
        os.makedirs(self.lib_dir, exist_ok=True)
        self.log_path = os.path.join(self.tmp, "error_log.txt")
        self._script_names = set()

        _purge_launcher_modules()
        sys.modules.pop("v01", None)

        # config stub mirroring .extension/project/config.py
        config = types.ModuleType("config")
        config.FILE_NAME = "v01"
        config.SCRIPT_DIRECTORY = self.script_dir
        config.LIB_DIRECTORY = self.lib_dir
        config.CONTEXT_RADIUS = 2
        config.LOG_FILE = self.log_path
        config.MAX_LOG_BYTES = 12 * 1024
        config.STOP_PIN_NUMBER = 4
        sys.modules["config"] = config
        self.config = config

        # MicroPython module stubs
        utime = types.ModuleType("utime")
        if localtime:
            utime.localtime = lambda: (2026, 7, 5, 2, 30, 15, 5, 186)
        sys.modules["utime"] = utime

        sys.modules["uio"] = io

        uos = types.ModuleType("uos")
        uos.listdir = os.listdir
        sys.modules["uos"] = uos

        sys.modules["machine"] = _make_machine_stub()

        # MicroPython's sys.print_exception shim
        import traceback as pytb

        self._added_print_exception = not hasattr(sys, "print_exception")
        sys.print_exception = lambda e, f=sys.stdout: pytb.print_exception(
            type(e), e, e.__traceback__, file=f
        )

        if LAUNCHER_LIB not in sys.path:
            sys.path.insert(0, LAUNCHER_LIB)

        import launcher  # noqa: F401  (fresh import against the stubs above)
        from launcher import errors, handler, logging as launcher_logging
        from launcher import traceback as launcher_tb

        self.launcher = launcher
        self.errors = errors
        self.handler = handler
        self.logging = launcher_logging
        self.tb = launcher_tb

    def write_script(self, code, name="v01"):
        path = os.path.join(self.script_dir, name + ".py")
        with open(path, "w") as f:
            f.write(code)
        # Evict any cached import of this module so the new code runs.
        self._script_names.add(name)
        sys.modules.pop(name, None)
        return path

    def run(self):
        """Invoke the launcher exactly as main.py does."""
        self.launcher.run()

    def read_log(self):
        try:
            with open(self.log_path) as f:
                return f.read()
        except OSError:
            return None

    def write_log(self, text):
        with open(self.log_path, "w") as f:
            f.write(text)

    def cleanup(self):
        _purge_launcher_modules()
        sys.modules.pop("v01", None)
        for name in self._script_names:
            sys.modules.pop(name, None)
        while self.script_dir in sys.path:
            sys.path.remove(self.script_dir)
        if self._added_print_exception and hasattr(sys, "print_exception"):
            del sys.print_exception


@pytest.fixture
def make_env(tmp_path):
    """Factory for LauncherEnv instances (supports localtime=False)."""
    created = []

    def factory(localtime=True):
        env = LauncherEnv(tmp_path, localtime=localtime)
        created.append(env)
        return env

    yield factory
    for env in created:
        env.cleanup()


@pytest.fixture
def env(make_env):
    """A default launcher environment."""
    return make_env()
