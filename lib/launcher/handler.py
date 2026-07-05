"""
Exception Handler Module
Main exception handling and reporting.
"""

import sys

from .errors import get_guidance, get_errno_hint
from .files import print_available_files
from . import traceback as tb
from .context import print_code_context, get_error_location
from .logging import log_exception, format_timestamp


def _format_error_message(error):
    """Return the exception's own message text, or None if it has none."""
    try:
        text = str(error)
    except Exception:
        return None
    text = text.strip()
    return text or None


def handle_exception(title, error):
    """
    Handle and report an exception with full context.

    Output order is deliberately "concrete first, advice second":
    the error message and location, then the code context, then the
    guidance, then the traceback.

    Args:
        title: Error type title (e.g., "IMPORT ERROR")
        error: The exception
    """
    # 1. Title plus MicroPython's own message - the most specific clue the
    # student gets, so it must lead rather than hide inside the traceback.
    message = _format_error_message(error)
    if message:
        print("{}: {}".format(title, message))
    else:
        print(title)

    # Translate bare errno codes ("OSError: 5") into plain English.
    errno_hint = get_errno_hint(error)
    if errno_hint:
        print(errno_hint)

    # 2. Resolve the error location.
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

    # 3. Code context - show the student their own code.
    print_code_context(
        error, tb, override_location=(filename, line_no), trace_frames=trace_frames
    )

    # 4. Guidance - what this error type means and what to do next.
    for line in get_guidance(title):
        print(line)

    # Show available files for import errors
    if title == "IMPORT ERROR":
        print_available_files()

    # 5. Traceback, with launcher/main.py frames filtered out so the
    # student's own call chain is what they read.
    print("--- Traceback ---")
    sys.stdout.write(tb.filter_launcher_frames(trace_text))

    # 6. Timestamp (shared formatter with the log file).
    print("Timestamp: {}".format(format_timestamp()))

    # Log exception (full, unfiltered traceback for forensics)
    log_exception(
        title,
        error,
        trace_text,
        location_override=(filename, line_no),
        get_error_location=lambda e: get_error_location(e, tb),
    )
