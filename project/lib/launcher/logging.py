"""
"""Logging Module
Handles error logging to file.
"""

import utime

import config


def open_log_file():
    """
    Open the log file for writing.

    Returns:
        file handle or None if logging should be skipped
    """
    try:
        current_size = None
        try:
            with open(config.LOG_FILE, "r") as existing:
                existing.seek(0, 2)
                current_size = existing.tell()
        except OSError:
            current_size = 0

        # Skip if log already has content
        if current_size is not None and current_size > 0:
            return None

        mode = "a"
        if current_size is not None and current_size >= config.MAX_LOG_BYTES:
            mode = "w"

        return open(config.LOG_FILE, mode)
    except OSError:
        return None


def log_exception(
    title, error, trace_text, location_override=None, get_error_location=None
):
    """
    Log an exception to the error log file.

    Args:
        title: Error type title
        error: The exception
        trace_text: Traceback text
        location_override: Optional (filename, line_no) override
        get_error_location: Function to get error location if not overridden
    """
    log_handle = open_log_file()
    if not log_handle:
        return

    try:
        # Get timestamp
        timestamp = utime.localtime() if hasattr(utime, "localtime") else None
        stamp = (
            "{}-{}-{} {}:{}:{}".format(
                timestamp[0],
                timestamp[1],
                timestamp[2],
                timestamp[3],
                timestamp[4],
                timestamp[5],
            )
            if timestamp
            else "UNKNOWN-TIME"
        )

        # Get location
        if location_override:
            filename, line_no = location_override
        elif get_error_location:
            filename, line_no = get_error_location(error)
        else:
            filename, line_no = None, None

        # Write log entry
        log_handle.write("==== {} ====".format(stamp))
        log_handle.write("\nType: {}".format(title))
        log_handle.write("\nSource: {}:{}".format(filename or "?", line_no or "?"))

        message = getattr(error, "args", None)
        if message:
            log_handle.write("\nMessage: {}".format(message))

        log_handle.write("\nTraceback:\n{}".format(trace_text))
        log_handle.write("\n\n")
    finally:
        log_handle.close()
