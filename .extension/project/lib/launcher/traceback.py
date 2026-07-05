"""
Traceback Parsing Module
Handles parsing exception tracebacks and extracting location information.
"""

import sys
import uio


# Reference to the launcher filename (used to filter out launcher frames)
LAUNCHER_FILENAME = None


def set_launcher_filename(filename):
    """Set the launcher filename for filtering."""
    global LAUNCHER_FILENAME
    LAUNCHER_FILENAME = filename


def get_traceback_location(error):
    """
    Extract filename and line number from exception traceback.

    Returns the DEEPEST non-launcher frame - the line where the error
    actually happened - not the outermost call site. For an error inside
    a function, students must be pointed at the failing line in the
    function body, not at the line that called it.

    Returns:
        tuple: (filename, line_number) or (None, None)
    """
    current = getattr(error, "__traceback__", None)
    fallback = (None, None)
    best = None

    while current:
        frame = getattr(current, "tb_frame", None)
        code_obj = getattr(frame, "f_code", None)
        potential_filename = (
            getattr(code_obj, "co_filename", None) if code_obj else None
        )

        if isinstance(potential_filename, str):
            fallback = (potential_filename, current.tb_lineno)
            # Skip launcher file; keep the deepest remaining frame.
            if not LAUNCHER_FILENAME or potential_filename != LAUNCHER_FILENAME:
                best = fallback

        current = current.tb_next

    return best if best else fallback


def parse_location_from_args(error):
    """
    Parse location information from exception args.

    Returns:
        tuple: (filename, line_number) or (None, None)
    """
    args = getattr(error, "args", None)
    if not args:
        return None, None

    for arg in args:
        if isinstance(arg, tuple):
            if len(arg) >= 2 and isinstance(arg[1], int):
                potential_filename = arg[0] if isinstance(arg[0], str) else None
                return potential_filename, arg[1]

            # MicroPython SyntaxError uses (message, (filename, line, column, source))
            if (
                len(arg) >= 2
                and isinstance(arg[0], str)
                and isinstance(arg[1], tuple)
                and len(arg[1]) >= 2
                and isinstance(arg[1][0], str)
                and isinstance(arg[1][1], int)
            ):
                return arg[1][0], arg[1][1]

        if isinstance(arg, int):
            # A bare int arg is only a line number for syntax-style errors.
            # For OSError it is an errno (e.g. OSError(5)) - treating it as
            # a line number fabricates a bogus "line 5" location.
            if isinstance(error, OSError):
                continue
            return None, arg

    return None, None


def get_syntax_error_details(error):
    """
    Extract detailed syntax error information.

    Returns:
        tuple: (filename, line_no, column, source_line) or all None
    """
    if not isinstance(error, SyntaxError):
        return None, None, None, None

    args = getattr(error, "args", None)
    if not args or len(args) < 2:
        return None, None, None, None

    details = args[1]
    if not isinstance(details, tuple) or len(details) < 4:
        return None, None, None, None

    filename = details[0] if isinstance(details[0], str) else None
    line_no = details[1] if isinstance(details[1], int) else None
    column = details[2] if isinstance(details[2], int) else None
    source_line = details[3] if isinstance(details[3], str) else None

    return filename, line_no, column, source_line


def capture_trace_text(error):
    """Capture the traceback as a string."""
    buf = uio.StringIO()
    try:
        sys.print_exception(error, buf)
        return buf.getvalue()
    finally:
        buf.close()


def extract_traceback_frames(trace_text):
    """
    Extract filename/line pairs from traceback text.

    Returns:
        list: List of (filename, line_number) tuples
    """
    frames = []

    if not trace_text:
        return frames

    for raw_line in trace_text.splitlines():
        line = raw_line.strip()

        if not (line.startswith('File "') and ", line " in line):
            continue

        start = line.find('"') + 1
        end = line.find('"', start)

        if start <= 0 or end <= start:
            continue

        filename = line[start:end]

        line_marker = ", line "
        line_index = line.find(line_marker, end)

        if line_index == -1:
            frames.append((filename, None))
            continue

        line_index += len(line_marker)
        remainder = line[line_index:]

        try:
            line_no = int(remainder.split(",", 1)[0].strip())
        except ValueError:
            line_no = None

        frames.append((filename, line_no))

    return frames


def parse_location_from_trace_text(trace_text):
    """
    Parse location from traceback text.

    Returns:
        tuple: (filename, line_number) from the last frame
    """
    frames = extract_traceback_frames(trace_text)
    if frames:
        return frames[-1]
    return None, None


def _is_launcher_frame(filename):
    """Return True if a frame filename belongs to the launcher plumbing."""
    if not filename:
        return False
    if LAUNCHER_FILENAME and filename == LAUNCHER_FILENAME:
        return True
    if "lib/launcher/" in filename:
        return True
    return filename in ("main.py", "/main.py")


def filter_launcher_frames(trace_text):
    """
    Remove launcher/main.py frames from a traceback for display, so the
    student reads their own call chain instead of the launcher plumbing.

    The full unfiltered traceback is still written to the error log. If
    filtering would remove every frame (an error inside the launcher
    itself), the original text is returned unchanged.
    """
    if not trace_text:
        return trace_text

    lines = trace_text.splitlines()
    kept = []
    kept_a_frame = False
    skipping = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith('File "'):
            start = stripped.find('"') + 1
            end = stripped.find('"', start)
            frame_file = stripped[start:end] if end > start else None
            skipping = _is_launcher_frame(frame_file)
            if skipping:
                continue
            kept_a_frame = True
        elif skipping and (line.startswith("    ") or line.startswith("\t")):
            # Source-echo line belonging to a skipped frame.
            continue
        else:
            skipping = False
        kept.append(line)

    if not kept_a_frame:
        return trace_text

    return "\n".join(kept) + ("\n" if trace_text.endswith("\n") else "")
