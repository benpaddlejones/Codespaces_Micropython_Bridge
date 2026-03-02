"""
Exception Handler Module
Main exception handling and reporting.
"""

import sys
import utime

import config
from .errors import get_guidance
from .files import print_available_files
from . import traceback as tb
from .context import print_code_context, get_error_location
from .logging import log_exception


def _reconcile_location(title, filename, line_no, trace_frames):
    """Reconcile error location from exception args and traceback frames.

    Priority:
    1. Parsed traceback frame (most reliable), unless it points to launcher
    2. Exception args location as fallback
    3. Fill in gaps from whichever source has data

    Args:
        title: Error type title
        filename: Filename from exception args
        line_no: Line number from exception args
        trace_frames: Parsed traceback frames list

    Returns:
        (filename, line_no) tuple
    """
    parsed_filename, parsed_line = (
        trace_frames[-1] if trace_frames else (None, None)
    )

    if not parsed_filename and not parsed_line:
        return filename, line_no

    use_parsed = False
    if not filename and not line_no:
        use_parsed = True
    elif (
        parsed_filename
        and parsed_filename not in (None, tb.LAUNCHER_FILENAME)
        and parsed_filename != filename
    ):
        use_parsed = True
    elif title == "SYNTAX ERROR" and parsed_filename:
        use_parsed = True

    if use_parsed:
        filename = parsed_filename or filename
        line_no = parsed_line or line_no
    else:
        filename = filename or parsed_filename
        line_no = line_no or parsed_line

    return filename, line_no


def _format_timestamp():
    """Get a timestamp for error reporting.

    Returns:
        tuple or str: A time tuple from utime.localtime(), or the string
            "unknown" if localtime is unavailable.
    """
    return utime.localtime() if hasattr(utime, "localtime") else "unknown"


def handle_exception(title, error):
    """
    Handle and report an exception with full context.

    Prints guidance messages, error location, code context, and full
    traceback to stdout, then logs the exception to disk.

    Args:
        title: Error type title (e.g., "IMPORT ERROR").
        error: The exception instance.
    """
    print(title)

    # Print guidance messages
    messages = get_guidance(title)
    for line in messages:
        print(line)

    # Show available files for import errors
    if title == "IMPORT ERROR":
        print_available_files()

    # Get error location and reconcile with traceback
    filename, line_no = get_error_location(error, tb)
    trace_text = tb.capture_trace_text(error)
    trace_frames = tb.extract_traceback_frames(trace_text)
    filename, line_no = _reconcile_location(
        title, filename, line_no, trace_frames
    )

    # Print location and timestamp
    if filename or line_no:
        print("Location: {}:{}".format(filename or "unknown", line_no or "?"))
    print("Timestamp: {}".format(_format_timestamp()))

    # Print code context and traceback
    print_code_context(
        error, tb, override_location=(filename, line_no),
        trace_frames=trace_frames
    )
    print("--- Traceback ---")
    sys.stdout.write(trace_text)

    # Log exception
    log_exception(
        title,
        error,
        trace_text,
        location_override=(filename, line_no),
        get_error_location=lambda e: get_error_location(e, tb),
    )
