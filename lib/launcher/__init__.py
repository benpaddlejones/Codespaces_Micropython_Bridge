"""
Launcher Package
MicroPython script launcher with comprehensive error handling.

This package provides:
- Error guidance and messages
- Source file loading
- Traceback parsing
- Code context display
- Error logging

Usage:
    from launcher import run
    run()

Configuration is in config.py (next to main.py)
"""

import config
from . import traceback as tb
from .handler import handle_exception


def run():
    """
    Run the configured script with exception handling.

    The script name is configured in config.FILE_NAME.
    """
    import sys
    from machine import Pin
    import micropython

    # Validate config values early to give clear errors
    if not isinstance(config.FILE_NAME, str) or not config.FILE_NAME:
        raise ValueError("config.FILE_NAME must be a non-empty string")
    if not isinstance(config.STOP_PIN_NUMBER, int):
        raise TypeError("config.STOP_PIN_NUMBER must be an integer")
    if not isinstance(config.CONTEXT_RADIUS, int) or config.CONTEXT_RADIUS < 0:
        raise ValueError("config.CONTEXT_RADIUS must be a non-negative integer")

    # Set launcher filename for traceback filtering
    if "__file__" in globals():
        tb.set_launcher_filename(__file__)

    # Add script directory to path
    sys.path.append(config.SCRIPT_DIRECTORY)

    # Setup stop pin interrupt.
    # Raising exceptions directly in an IRQ handler is unsafe on real
    # MicroPython (limited stack, potential state corruption).  Instead,
    # use micropython.schedule() to defer the raise to a safe context.
    stop_pin = Pin(config.STOP_PIN_NUMBER, Pin.IN, Pin.PULL_UP)

    def _raise_keyboard_interrupt(_):
        """Scheduled helper that raises KeyboardInterrupt in a safe context."""
        raise KeyboardInterrupt("Stop pin button pressed")

    def callback(stop_pin):
        """IRQ handler that defers the KeyboardInterrupt via micropython.schedule."""
        micropython.schedule(_raise_keyboard_interrupt, None)

    stop_pin.irq(trigger=Pin.IRQ_FALLING, handler=callback)

    # Error type to title mapping
    _ERROR_TITLES = {
        ImportError: "IMPORT ERROR",
        NameError: "NAME ERROR",
        SyntaxError: "SYNTAX ERROR",
        TypeError: "TYPE ERROR",
        ValueError: "VALUE ERROR",
        OSError: "OS ERROR",
        RuntimeError: "RUNTIME ERROR",
    }

    # Run the script with exception handling
    try:
        __import__(config.FILE_NAME)
    except KeyboardInterrupt:
        print("KEYBOARD INTERRUPT")
    except Exception as e:
        title = _ERROR_TITLES.get(type(e), "UNEXPECTED ERROR")
        handle_exception(title, e)


# Export main components
__all__ = ["run", "config", "handle_exception"]
