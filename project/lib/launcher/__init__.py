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

    # Set launcher filename for traceback filtering
    if "__file__" in globals():
        tb.set_launcher_filename(__file__)

    # Add script directory to path
    sys.path.append(config.SCRIPT_DIRECTORY)

    # Setup stop pin interrupt
    stop_pin = Pin(config.STOP_PIN_NUMBER, Pin.IN, Pin.PULL_UP)

    def callback(stop_pin):
        """Handle stop-pin IRQ by raising KeyboardInterrupt.

        Args:
            stop_pin: The Pin instance that triggered the interrupt.

        Raises:
            KeyboardInterrupt: Always raised to stop the running script.
        """
        raise KeyboardInterrupt("Stop pin button pressed")

    stop_pin.irq(trigger=Pin.IRQ_FALLING, handler=callback)

    # Run the script with exception handling
    try:
        # Force a fresh load so reruns execute updated student code.
        sys.modules.pop(config.FILE_NAME, None)
        __import__(config.FILE_NAME)
    except KeyboardInterrupt:
        print("KEYBOARD INTERRUPT")
    except ImportError as e:
        handle_exception("IMPORT ERROR", e)
    except NameError as e:
        handle_exception("NAME ERROR", e)
    except SyntaxError as e:
        handle_exception("SYNTAX ERROR", e)
    except TypeError as e:
        handle_exception("TYPE ERROR", e)
    except ValueError as e:
        handle_exception("VALUE ERROR", e)
    except OSError as e:
        handle_exception("OS ERROR", e)
    except RuntimeError as e:
        handle_exception("RUNTIME ERROR", e)
    except Exception as e:
        handle_exception("UNEXPECTED ERROR", e)


# Export main components
__all__ = ["run", "config", "handle_exception"]
