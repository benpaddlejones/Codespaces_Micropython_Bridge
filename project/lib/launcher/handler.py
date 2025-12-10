"""
"""Exception Handler Module
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


def handle_exception(title, error):
    """
    Handle and report an exception with full context.

    Args:
        title: Error type title (e.g., "IMPORT ERROR")
        error: The exception
    """
    print(title)

    # Print guidance messages
    messages = get_guidance(title)
    for line in messages:
        print(line)

    # Show available files for import errors
    if title == "IMPORT ERROR":
        print_available_files()

    # Get error location
    filename, line_no = get_error_location(error, tb)

    # Capture traceback
    trace_text = tb.capture_trace_text(error)
    trace_frames = tb.extract_traceback_frames(trace_text)

    # Try to get better location from trace frames
    parsed_filename, parsed_line = trace_frames[-1] if trace_frames else (None, None)

    if parsed_filename or parsed_line:
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
            if parsed_filename:
                filename = parsed_filename
            if parsed_line:
                line_no = parsed_line
        else:
            if not filename and parsed_filename:
                filename = parsed_filename
            if not line_no and parsed_line:
                line_no = parsed_line

    # Print location
    if filename or line_no:
        print("Location: {}:{}".format(filename or "unknown", line_no or "?"))

    # Print timestamp
    print(
        "Timestamp: {}".format(
            utime.localtime() if hasattr(utime, "localtime") else "unknown"
        )
    )

    # Print code context
    print_code_context(
        error, tb, override_location=(filename, line_no), trace_frames=trace_frames
    )

    # Print traceback
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
