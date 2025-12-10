"""
"""Code Context Display Module
Handles displaying code context around error locations.
"""

import config
from .source import load_source_lines, get_script_path
from .traceback import get_syntax_error_details


def get_error_location(error, traceback_module):
    """
    Get the filename and line number for an error.

    Args:
        error: The exception
        traceback_module: The traceback module for location extraction

    Returns:
        tuple: (filename, line_number)
    """
    tb_filename, tb_line = traceback_module.get_traceback_location(error)
    arg_filename, arg_line = traceback_module.parse_location_from_args(error)

    filename = arg_filename or tb_filename or get_script_path()
    line_no = tb_line or arg_line

    return filename, line_no


def print_code_context(
    error, traceback_module, override_location=None, trace_frames=None
):
    """
    Print code context around the error location.

    Args:
        error: The exception
        traceback_module: The traceback module
        override_location: Optional (filename, line_no) override
        trace_frames: List of traceback frames for fallback
    """
    context_radius = config.CONTEXT_RADIUS

    if override_location:
        filename, line_no = override_location
    else:
        filename, line_no = get_error_location(error, traceback_module)

    if line_no is None:
        print("--- Code Context ---")
        print("No line information reported for this exception.")
        return

    resolved_filename = filename
    lines, resolved_path = load_source_lines(resolved_filename)
    fallback_display = False

    # Try fallback if source not found
    if not lines and not resolved_filename:
        resolved_filename = get_script_path()
        lines, resolved_path = load_source_lines(resolved_filename)

    if not lines:
        # Try syntax error source
        syntax_filename, syntax_line, syntax_column, syntax_source = (
            get_syntax_error_details(error)
        )

        if syntax_source:
            _print_syntax_error_context(
                resolved_filename,
                syntax_filename,
                line_no,
                syntax_line,
                syntax_column,
                syntax_source,
            )
            return

        # Try trace frames fallback
        if trace_frames:
            lines, resolved_path, line_no, fallback_display = (
                _try_trace_frames_fallback(trace_frames, resolved_filename, line_no)
            )

        # Try script path fallback
        if not lines:
            fallback_path = get_script_path()
            fallback_lines, fallback_resolved = load_source_lines(fallback_path)

            if fallback_lines:
                print("--- Code Context ---")
                print(
                    "Unable to open {}. Showing context from {} instead.".format(
                        resolved_filename or "dynamic source", fallback_path
                    )
                )
                lines = fallback_lines
                resolved_path = fallback_resolved or fallback_path
                fallback_display = True
            else:
                path_to_show = resolved_path or resolved_filename or fallback_path
                print("--- Code Context ---")
                print(
                    "Unable to open {} to display source context.".format(path_to_show)
                )
                return

    # Display the context
    _display_context(lines, resolved_path, resolved_filename, line_no, context_radius)


def _print_syntax_error_context(
    resolved_filename,
    syntax_filename,
    line_no,
    syntax_line,
    syntax_column,
    syntax_source,
):
    """Print context for syntax errors with source line available."""
    target_filename = resolved_filename or syntax_filename or "dynamic source"
    target_line = line_no or syntax_line or "?"
    line_label_value = syntax_line or line_no

    if isinstance(line_label_value, int) and line_label_value >= 0:
        line_label = "{:03}".format(line_label_value)
    else:
        line_label = "???"

    prefix = ">> {}: ".format(line_label)
    print("--- Code Context ({}:{}) ---".format(target_filename, target_line))
    print("{}{}".format(prefix, syntax_source.rstrip("\n")))

    if isinstance(syntax_column, int) and syntax_column > 0:
        caret_padding = " " * (len(prefix) + syntax_column - 1)
        print("{}^".format(caret_padding))


def _try_trace_frames_fallback(trace_frames, resolved_filename, line_no):
    """Try to find source from trace frames as fallback."""
    for idx in range(len(trace_frames) - 1, -1, -1):
        alt_filename, alt_line = trace_frames[idx]

        if not alt_filename:
            continue
        if resolved_filename and alt_filename == resolved_filename:
            continue

        alt_lines, alt_resolved = load_source_lines(alt_filename)

        if alt_lines:
            print("--- Code Context ---")
            print(
                "Unable to open {}. Showing context from {} instead.".format(
                    resolved_filename or "dynamic source",
                    alt_resolved or alt_filename,
                )
            )

            new_line_no = line_no
            if isinstance(alt_line, int) and alt_line > 0:
                new_line_no = alt_line

            return alt_lines, alt_resolved or alt_filename, new_line_no, True

    return None, None, line_no, False


def _display_context(lines, resolved_path, resolved_filename, line_no, context_radius):
    """Display the actual code context."""
    path_to_show = resolved_path or resolved_filename or get_script_path()
    total_lines = len(lines)

    if total_lines == 0:
        print("--- Code Context ---")
        print("The file {} is empty.".format(path_to_show))
        return

    if line_no < 1 or line_no > total_lines:
        print("--- Code Context ({}:{}) ---".format(path_to_show, line_no))
        print(
            "Reported line {} is outside the range of this file (1-{}).".format(
                line_no, total_lines
            )
        )
        return

    start = max(0, line_no - 1 - context_radius)
    end = min(total_lines, line_no - 1 + context_radius + 1)

    print("--- Code Context ({}:{}) ---".format(path_to_show, line_no))

    for idx in range(start, end):
        marker = ">>" if idx == line_no - 1 else "  "
        print("{} {:03}: {}".format(marker, idx + 1, lines[idx].rstrip("\n")))
