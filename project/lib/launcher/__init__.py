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
from .logging import replay_and_clear_log


def run():
    """
    Run the configured script with exception handling.

    The script name is configured in config.FILE_NAME.
    """
    import sys
    from machine import Pin

    # Deliver any crash logged by a previous unattended run (the boot run
    # fires before the student can connect), then clear it. If this run is
    # attended, the student finally sees why the board "did nothing"; if it
    # is another unattended boot, the log is re-armed for this run's crash.
    replay_and_clear_log()

    # Set launcher filename for traceback filtering
    if "__file__" in globals():
        tb.set_launcher_filename(__file__)

    # Add script directory to path
    sys.path.append(config.SCRIPT_DIRECTORY)

    # Setup stop pin interrupt
    # NOTE: Raising an exception inside an IRQ handler is not guaranteed to
    # propagate to the main thread on all MicroPython ports - verify on
    # hardware; micropython.schedule() is the portable alternative.
    stop_pin = Pin(config.STOP_PIN_NUMBER, Pin.IN, Pin.PULL_UP)

    def callback(stop_pin):
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
    except AttributeError as e:
        handle_exception("ATTRIBUTE ERROR", e)
    except IndexError as e:
        handle_exception("INDEX ERROR", e)
    except KeyError as e:
        handle_exception("KEY ERROR", e)
    except ZeroDivisionError as e:
        handle_exception("ZERO DIVISION ERROR", e)
    except TypeError as e:
        handle_exception("TYPE ERROR", e)
    except ValueError as e:
        handle_exception("VALUE ERROR", e)
    except MemoryError as e:
        handle_exception("MEMORY ERROR", e)
    except OSError as e:
        handle_exception("OS ERROR", e)
    except RuntimeError as e:
        handle_exception("RUNTIME ERROR", e)
    except Exception as e:
        handle_exception("UNEXPECTED ERROR", e)


# Export main components
__all__ = ["run", "config", "handle_exception"]
