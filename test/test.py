"""
Launcher Library Test Suite
============================
Tests the lib/launcher package: error guidance, source utilities,
traceback parsing, code context display, logging, file listing, and
the main exception handler.

Run via the emulator runner so MicroPython mock modules are available:
    python3 .extension/emulator/mock/runner.py test/test.py

If a test fails, fix the launcher code — do NOT modify this test to hide failures.
"""

import sys
import os
import io

# Ensure workspace root is on the path so we can import lib.launcher and config
_workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _workspace_root not in sys.path:
    sys.path.insert(0, _workspace_root)

# Track test results
_passed = 0
_failed = 0
_errors = []


def run_test(name, test_fn):
    """Run a single test and track results."""
    global _passed, _failed
    print("\n" + "=" * 60)
    print("TEST: {}".format(name))
    print("=" * 60)
    try:
        test_fn()
        print("  PASSED: {}".format(name))
        _passed += 1
    except Exception as e:
        print("  FAILED: {}".format(name))
        print("   Error: {}".format(e))
        _failed += 1
        _errors.append((name, str(e)))


# =============================================================================
# errors MODULE TESTS
# =============================================================================

def test_get_guidance_known_types():
    """Test that get_guidance returns messages for all known error types."""
    from lib.launcher.errors import get_guidance, ERROR_GUIDANCE

    known_types = [
        "IMPORT ERROR", "NAME ERROR", "SYNTAX ERROR", "TYPE ERROR",
        "VALUE ERROR", "OS ERROR", "RUNTIME ERROR", "UNEXPECTED ERROR",
    ]

    for error_type in known_types:
        msgs = get_guidance(error_type)
        assert isinstance(msgs, list), \
            "get_guidance('{}') should return a list".format(error_type)
        assert len(msgs) > 0, \
            "get_guidance('{}') should return at least one message".format(error_type)
        for msg in msgs:
            assert isinstance(msg, str), \
                "Each guidance message should be a string"
    print("  All known error types return guidance messages")


def test_get_guidance_unknown_type():
    """Test that get_guidance returns UNEXPECTED ERROR for unknown types."""
    from lib.launcher.errors import get_guidance, ERROR_GUIDANCE

    msgs = get_guidance("TOTALLY UNKNOWN ERROR TYPE")
    expected = ERROR_GUIDANCE.get("UNEXPECTED ERROR", [])
    assert msgs == expected, \
        "Unknown error type should fall back to UNEXPECTED ERROR guidance"
    print("  Unknown error type falls back correctly")


def test_error_guidance_content():
    """Test that error guidance messages contain meaningful content."""
    from lib.launcher.errors import ERROR_GUIDANCE

    for error_type, messages in ERROR_GUIDANCE.items():
        assert len(messages) >= 2, \
            "'{}' should have at least 2 guidance lines, got {}".format(
                error_type, len(messages))
        for msg in messages:
            assert len(msg) > 10, \
                "'{}' guidance messages should be meaningful (>10 chars)".format(
                    error_type)
    print("  All guidance messages have meaningful content")


def test_get_guidance_case_sensitive_returns_unexpected():
    """get_guidance is case-sensitive: 'name error' falls back to UNEXPECTED."""
    from lib.launcher.errors import get_guidance, ERROR_GUIDANCE

    msgs = get_guidance("name error")
    assert msgs == ERROR_GUIDANCE["UNEXPECTED ERROR"], \
        "Lowercase 'name error' should fall back to UNEXPECTED ERROR"
    print("  Case-sensitive lookup falls back correctly")


def test_get_guidance_partial_match_returns_unexpected():
    """get_guidance does not partial-match: 'NAME' returns UNEXPECTED."""
    from lib.launcher.errors import get_guidance, ERROR_GUIDANCE

    msgs = get_guidance("NAME")
    assert msgs == ERROR_GUIDANCE["UNEXPECTED ERROR"], \
        "Partial key 'NAME' should fall back to UNEXPECTED ERROR"
    print("  Partial key falls back correctly")


# =============================================================================
# source MODULE TESTS
# =============================================================================

def test_get_script_path_default():
    """Test get_script_path with default config."""
    from lib.launcher.source import get_script_path
    import config

    path = get_script_path()
    assert path.endswith(".py"), "Script path should end with .py"
    assert config.FILE_NAME in path, \
        "Script path should contain the configured FILE_NAME"
    assert config.SCRIPT_DIRECTORY in path, \
        "Script path should contain SCRIPT_DIRECTORY"
    print("  Default path: {}".format(path))


def test_get_script_path_custom():
    """Test get_script_path with a custom module path."""
    from lib.launcher.source import get_script_path

    path = get_script_path("my_module")
    assert path.endswith("my_module.py"), \
        "Path should end with my_module.py, got {}".format(path)

    # When given a dotted name without slash, dots become path separators
    # e.g., "my_module.py" → "my_module/py.py" (dots treated as module separators)
    # This is by design — use module names, not filenames
    path_dotted = get_script_path("subpkg.my_module")
    assert "subpkg/my_module" in path_dotted, \
        "Dotted module name should convert to path"
    print("  Custom paths resolve correctly")


def test_get_script_path_with_dots():
    """Test get_script_path converts dots to slashes."""
    from lib.launcher.source import get_script_path

    path = get_script_path("subdir.my_module")
    assert "subdir/my_module" in path, \
        "Dots should be converted to slashes for module paths"
    print("  Dot-separated paths converted: {}".format(path))


def test_build_candidate_paths():
    """Test build_candidate_paths returns multiple candidates."""
    from lib.launcher.source import build_candidate_paths

    candidates = build_candidate_paths("test_file.py")
    assert isinstance(candidates, list), "Should return a list"
    assert len(candidates) >= 1, "Should have at least one candidate"
    assert "test_file.py" in candidates, \
        "Original filename should be in candidates"
    print("  Candidates for 'test_file.py': {}".format(candidates))


def test_build_candidate_paths_absolute():
    """Test build_candidate_paths with absolute path."""
    from lib.launcher.source import build_candidate_paths

    candidates = build_candidate_paths("/absolute/path/file.py")
    assert "/absolute/path/file.py" in candidates, \
        "Absolute path should be in candidates"
    print("  Absolute path candidates: {}".format(candidates))


def test_build_candidate_paths_empty():
    """Test build_candidate_paths with empty/None input."""
    from lib.launcher.source import build_candidate_paths

    candidates = build_candidate_paths("")
    assert isinstance(candidates, list), "Should return a list for empty string"
    assert len(candidates) == 0, \
        "Empty string should produce empty candidates, got {}".format(candidates)

    candidates_none = build_candidate_paths(None)
    assert isinstance(candidates_none, list), "Should return a list for None"
    assert len(candidates_none) == 0, "None should produce empty candidates"
    print("  Edge cases handled correctly")


def test_build_candidate_paths_no_duplicates():
    """Test that build_candidate_paths removes duplicates."""
    from lib.launcher.source import build_candidate_paths

    candidates = build_candidate_paths("test.py")
    assert len(candidates) == len(set(candidates)), \
        "Candidates should have no duplicates: {}".format(candidates)
    print("  No duplicates in candidate list")


def test_load_source_lines_existing_file():
    """Test load_source_lines with a file that exists."""
    from lib.launcher.source import load_source_lines

    # config.py should exist at project root (runner chdirs to workspace root)
    lines, resolved = load_source_lines("config.py")
    assert lines is not None, \
        "config.py should be loadable from workspace root"
    assert isinstance(lines, list), "Lines should be a list"
    assert len(lines) > 0, "config.py should have lines"
    assert resolved is not None, "Resolved path should not be None"
    assert "config.py" in resolved, \
        "Resolved path should contain config.py, got {}".format(resolved)
    # Verify content looks like the real config.py
    content = "".join(lines)
    assert "FILE_NAME" in content, \
        "config.py should contain FILE_NAME setting"
    print("  Loaded {} lines from {}".format(len(lines), resolved))


def test_load_source_lines_nonexistent():
    """Test load_source_lines with a file that does not exist."""
    from lib.launcher.source import load_source_lines

    lines, resolved = load_source_lines("nonexistent_file_xyz.py")
    assert lines is None, "Should return None for nonexistent file"
    print("  Nonexistent file returns None correctly")


# =============================================================================
# traceback MODULE TESTS
# =============================================================================

def test_extract_traceback_frames():
    """Test extract_traceback_frames parses traceback text."""
    from lib.launcher.traceback import extract_traceback_frames

    trace_text = (
        'Traceback (most recent call last):\n'
        '  File "main.py", line 5, in <module>\n'
        '  File "/py_scripts/v01.py", line 12, in my_func\n'
        'NameError: name "x" is not defined\n'
    )

    frames = extract_traceback_frames(trace_text)
    assert isinstance(frames, list), "Should return a list"
    assert len(frames) == 2, \
        "Should extract 2 frames, got {}".format(len(frames))
    assert frames[0] == ("main.py", 5), \
        "First frame should be ('main.py', 5), got {}".format(frames[0])
    assert frames[1] == ("/py_scripts/v01.py", 12), \
        "Second frame should be ('/py_scripts/v01.py', 12), got {}".format(
            frames[1])
    print("  Parsed 2 frames correctly")


def test_extract_traceback_frames_empty():
    """Test extract_traceback_frames with empty/None input."""
    from lib.launcher.traceback import extract_traceback_frames

    assert extract_traceback_frames("") == [], "Empty string should return []"
    assert extract_traceback_frames(None) == [], "None should return []"
    print("  Empty/None input handled correctly")


def test_extract_traceback_frames_no_line():
    """Test extract_traceback_frames with missing line number."""
    from lib.launcher.traceback import extract_traceback_frames

    trace_text = (
        'Traceback (most recent call last):\n'
        '  File "test.py", line abc, in <module>\n'
    )
    frames = extract_traceback_frames(trace_text)
    # Should handle gracefully — line number will be None
    assert len(frames) == 1, "Should still extract 1 frame"
    assert frames[0][0] == "test.py", "Filename should be extracted"
    assert frames[0][1] is None, "Line number should be None for non-integer"
    print("  Non-integer line number handled")


def test_parse_location_from_trace_text():
    """Test parse_location_from_trace_text returns last frame."""
    from lib.launcher.traceback import parse_location_from_trace_text

    trace_text = (
        'Traceback (most recent call last):\n'
        '  File "main.py", line 5, in <module>\n'
        '  File "/py_scripts/v01.py", line 42, in run\n'
        'ValueError: invalid literal\n'
    )

    filename, line_no = parse_location_from_trace_text(trace_text)
    assert filename == "/py_scripts/v01.py", \
        "Should return last frame filename, got {}".format(filename)
    assert line_no == 42, \
        "Should return last frame line number, got {}".format(line_no)
    print("  Last frame extracted: {}:{}".format(filename, line_no))


def test_parse_location_from_trace_text_empty():
    """Test parse_location_from_trace_text with empty input."""
    from lib.launcher.traceback import parse_location_from_trace_text

    filename, line_no = parse_location_from_trace_text("")
    assert filename is None, "Empty trace should return None filename"
    assert line_no is None, "Empty trace should return None line"
    print("  Empty trace returns (None, None)")


def test_parse_location_from_args_basic():
    """Test parse_location_from_args with different exception types."""
    from lib.launcher.traceback import parse_location_from_args

    # NameError — no location info in args, should return (None, None)
    try:
        raise NameError("x is not defined")
    except NameError as e:
        filename, line = parse_location_from_args(e)
        assert filename is None, \
            "NameError has no file info in args, expected None got {}".format(filename)
        assert line is None, \
            "NameError has no line info in args, expected None got {}".format(line)
        print("  NameError args parsed: ({}, {})".format(filename, line))

    # Exception with no args
    e = Exception()
    filename, line = parse_location_from_args(e)
    assert filename is None, "No-args exception filename should be None"
    assert line is None, "No-args exception line should be None"
    print("  No-args exception: (None, None)")


def test_set_launcher_filename():
    """Test set_launcher_filename and filtering."""
    from lib.launcher import traceback as tb

    old_value = tb.LAUNCHER_FILENAME
    tb.set_launcher_filename("test_launcher.py")
    assert tb.LAUNCHER_FILENAME == "test_launcher.py", \
        "LAUNCHER_FILENAME should be set"

    # Restore
    tb.LAUNCHER_FILENAME = old_value
    print("  Launcher filename set and restored")


def test_get_traceback_location():
    """Test get_traceback_location extracts location from exception."""
    from lib.launcher.traceback import get_traceback_location

    try:
        raise ValueError("test error")
    except ValueError as e:
        filename, line_no = get_traceback_location(e)
        # Should find this file and a valid line number
        assert filename is not None, \
            "Should extract filename from ValueError traceback"
        assert isinstance(filename, str), \
            "Filename should be a string, got {}".format(type(filename))
        assert line_no is not None, \
            "Should extract line number from ValueError traceback"
        assert isinstance(line_no, int) and line_no > 0, \
            "Line number should be a positive int, got {}".format(line_no)
        print("  Traceback location: {}:{}".format(filename, line_no))


def test_get_syntax_error_details():
    """Test get_syntax_error_details with SyntaxError."""
    from lib.launcher.traceback import get_syntax_error_details

    # Non-SyntaxError should return all None
    e = ValueError("not a syntax error")
    f, l, c, s = get_syntax_error_details(e)
    assert f is None and l is None and c is None and s is None, \
        "Non-SyntaxError should return all None"

    # SyntaxError with details tuple
    try:
        compile("def foo(\n", "test_file.py", "exec")
    except SyntaxError as e:
        f, l, c, s = get_syntax_error_details(e)
        assert f == "test_file.py", \
            "Filename should be test_file.py, got {}".format(f)
        assert l == 1, \
            "Line should be 1, got {}".format(l)
        assert isinstance(c, int) and c > 0, \
            "Column should be a positive int, got {}".format(c)
        assert isinstance(s, str) and len(s) > 0, \
            "Source line should be a non-empty string, got {}".format(repr(s))
        print("  Syntax error details: file={}, line={}, col={}, src={}".format(
            f, l, c, repr(s)))


def test_capture_trace_text():
    """Test capture_trace_text captures exception trace as string."""
    from lib.launcher.traceback import capture_trace_text

    try:
        raise RuntimeError("capture me")
    except RuntimeError as e:
        text = capture_trace_text(e)
        assert isinstance(text, str), "Should return a string"
        assert "RuntimeError" in text, \
            "Trace text should contain 'RuntimeError'"
        assert "capture me" in text, \
            "Trace text should contain the message"
        print("  Captured trace ({} chars)".format(len(text)))


def test_get_traceback_location_no_active_exception():
    """get_traceback_location returns (None, None) when there's no traceback."""
    from lib.launcher.traceback import get_traceback_location

    e = Exception("no traceback attached")
    filename, line_no = get_traceback_location(e)
    assert filename is None, \
        "Expected None filename, got {}".format(filename)
    assert line_no is None, "Expected None line_no, got {}".format(line_no)
    print("  No-traceback exception returns (None, None)")


def test_extract_traceback_frames_mixed_noise():
    """extract_traceback_frames ignores junk lines and parses valid frames."""
    from lib.launcher.traceback import extract_traceback_frames

    text = (
        "garbage line one\n"
        "  -- not a frame --\n"
        '  File "foo.py", line 12, in bar\n'
        "trailing noise here\n"
    )
    frames = extract_traceback_frames(text)
    assert len(frames) == 1, \
        "Expected exactly 1 frame, got {}".format(frames)
    assert frames[0] == ("foo.py", 12), \
        "Expected ('foo.py', 12), got {}".format(frames[0])
    print("  Noise lines ignored; one valid frame parsed")


def test_parse_location_from_args_integer_only():
    """parse_location_from_args returns (None, int) when args is a single int."""
    from lib.launcher.traceback import parse_location_from_args

    e = NameError(42)
    filename, line_no = parse_location_from_args(e)
    assert filename is None, "Expected None filename, got {}".format(filename)
    assert line_no == 42, "Expected line 42, got {}".format(line_no)
    print("  Single-int arg treated as line number")


def test_parse_location_from_args_micropython_tuple():
    """parse_location_from_args extracts file/line from MicroPython SyntaxError tuple."""
    from lib.launcher.traceback import parse_location_from_args

    e = SyntaxError()
    e.args = ("syntax error", ("file.py", 3, 1, "code"))
    filename, line_no = parse_location_from_args(e)
    assert filename == "file.py", \
        "Expected 'file.py', got {}".format(filename)
    assert line_no == 3, "Expected line 3, got {}".format(line_no)
    print("  MicroPython-style SyntaxError tuple parsed")


# =============================================================================
# context MODULE TESTS
# =============================================================================

def test_get_error_location():
    """Test get_error_location combines traceback and arg info."""
    from lib.launcher.context import get_error_location
    from lib.launcher import traceback as tb

    try:
        raise TypeError("wrong type")
    except TypeError as e:
        filename, line_no = get_error_location(e, tb)
        assert filename is not None, \
            "Should return a filename (possibly fallback)"
        assert isinstance(filename, str) and len(filename) > 0, \
            "Filename should be a non-empty string, got {}".format(repr(filename))
        assert line_no is not None, \
            "Should return a line number"
        assert isinstance(line_no, int) and line_no > 0, \
            "Line number should be a positive int, got {}".format(line_no)
        print("  Error location: {}:{}".format(filename, line_no))


def test_print_code_context_no_crash():
    """Test that print_code_context does not crash."""
    from lib.launcher.context import print_code_context
    from lib.launcher import traceback as tb

    # Create an exception with location info
    try:
        raise ValueError("test context display")
    except ValueError as e:
        # This should print context without crashing
        print_code_context(e, tb)
        print("  print_code_context executed without error")


def test_print_code_context_override():
    """Test print_code_context with override_location."""
    from lib.launcher.context import print_code_context
    from lib.launcher import traceback as tb

    try:
        raise ValueError("test override")
    except ValueError as e:
        # With a non-existent file — should handle gracefully
        print_code_context(
            e, tb, override_location=("nonexistent_xyz.py", 5))
        print("  Override location handled gracefully")


def test_print_code_context_none_line():
    """Test print_code_context when line number is None."""
    from lib.launcher.context import print_code_context
    from lib.launcher import traceback as tb

    try:
        raise ValueError("no line info")
    except ValueError as e:
        print_code_context(e, tb, override_location=("some_file.py", None))
        print("  None line number handled gracefully")


def test_print_code_context_empty_file_message():
    """_display_context prints an 'empty' message for empty source lists."""
    from lib.launcher.context import _display_context

    output = _capture_stdout(
        _display_context, [], "/tmp/empty.py", "/tmp/empty.py", 1, 2
    )
    assert "is empty" in output, \
        "Expected empty-file message, got: {}".format(output)
    print("  Empty-file message printed")


def test_print_code_context_line_out_of_range_message():
    """_display_context reports when line is outside the file range."""
    from lib.launcher.context import _display_context

    lines = ["a\n", "b\n", "c\n"]
    output = _capture_stdout(
        _display_context, lines, "/tmp/three.py", "/tmp/three.py", 99, 2
    )
    assert "outside the range" in output, \
        "Expected out-of-range message, got: {}".format(output)
    assert "1-3" in output, "Expected range 1-3 in message, got: {}".format(output)
    print("  Out-of-range message printed")


def test_print_code_context_custom_radius_limits_window():
    """_display_context honors the context_radius window size."""
    from lib.launcher.context import _display_context

    lines = ["line {}\n".format(i) for i in range(1, 21)]
    output = _capture_stdout(
        _display_context, lines, "/tmp/big.py", "/tmp/big.py", 10, 1
    )
    assert " 009:" in output, "Expected line 009 in output, got: {}".format(output)
    assert " 010:" in output, "Expected line 010 in output, got: {}".format(output)
    assert " 011:" in output, "Expected line 011 in output, got: {}".format(output)
    assert " 008:" not in output, "Line 008 should be outside radius=1 window"
    assert " 012:" not in output, "Line 012 should be outside radius=1 window"
    print("  Radius=1 window shows only lines 9-11")


def test_try_trace_frames_fallback_uses_alternate_frame():
    """_try_trace_frames_fallback loads source from an alternate frame."""
    from lib.launcher.context import _try_trace_frames_fallback

    alt_path = _tmp_path("_tmp_alt_source.py")
    with open(alt_path, "w") as fh:
        fh.write("alpha\nbeta\ngamma\n")
    try:
        alt_lines, resolved, new_line, fallback = _capture_stdout_and_return(
            _try_trace_frames_fallback, [(alt_path, 2)], "missing.py", 99
        )
        assert alt_lines is not None, "Expected lines from alternate file"
        assert resolved == alt_path or (resolved and resolved.endswith(alt_path)), \
            "Expected resolved path to be alt file, got {}".format(resolved)
        assert new_line == 2, \
            "Expected line updated to 2 from alt frame, got {}".format(new_line)
        assert fallback is True, "Expected fallback_display=True"
        print("  Fallback to alternate frame succeeded")
    finally:
        try:
            os.remove(alt_path)
        except OSError:
            pass


def test_try_trace_frames_fallback_skips_same_filename():
    """_try_trace_frames_fallback skips frames matching the unresolved file."""
    from lib.launcher.context import _try_trace_frames_fallback

    alt_lines, resolved, new_line, fallback = _try_trace_frames_fallback(
        [("same.py", 1)], "same.py", 99
    )
    assert alt_lines is None, "Should not return lines for same filename"
    assert resolved is None, "Should not return resolved path for same filename"
    assert new_line == 99, "Line number should be unchanged, got {}".format(new_line)
    assert fallback is False, "fallback_display should be False"
    print("  Same-filename frames are skipped")


# =============================================================================
# files MODULE TESTS
# =============================================================================

def test_list_directory_valid():
    """Test list_directory with a valid directory."""
    from lib.launcher.files import list_directory

    entries = list_directory(".")
    assert entries is not None, "Current directory should be listable"
    assert isinstance(entries, list), "Should return a list"
    assert len(entries) > 0, "Current directory should have entries"
    print("  Listed {} entries in '.'".format(len(entries)))


def test_list_directory_invalid():
    """Test list_directory with an invalid directory."""
    from lib.launcher.files import list_directory

    entries = list_directory("/nonexistent_dir_xyz")
    assert entries is None, "Nonexistent directory should return None"
    print("  Nonexistent directory returns None")


def test_print_available_files_no_crash():
    """Test that print_available_files runs without crashing."""
    from lib.launcher.files import print_available_files

    # Should print file listings without error
    print_available_files()
    print("  print_available_files executed without error")


# =============================================================================
# logging MODULE TESTS
# =============================================================================

def test_open_log_file():
    """Test open_log_file returns a file handle for fresh log."""
    from lib.launcher.logging import open_log_file
    import config

    # Use a writable path for testing
    original_log = config.LOG_FILE
    config.LOG_FILE = "error_log_test.txt"

    # Clean up any existing log file to ensure fresh state
    try:
        os.remove(config.LOG_FILE)
    except OSError:
        pass

    try:
        handle = open_log_file()
        assert handle is not None, \
            "open_log_file should return a file handle when no log exists"
        assert hasattr(handle, "write"), "Should return a writable file handle"
        assert hasattr(handle, "close"), "Should return a closeable file handle"
        handle.close()
        print("  Log file opened successfully")
    finally:
        # Clean up
        try:
            os.remove(config.LOG_FILE)
        except OSError:
            pass
        config.LOG_FILE = original_log


def test_log_exception():
    """Test log_exception writes to log file."""
    from lib.launcher.logging import log_exception
    import config

    # Use a writable path for testing
    original_log = config.LOG_FILE
    config.LOG_FILE = "error_log_test.txt"

    # Clean up any existing log file
    try:
        os.remove(config.LOG_FILE)
    except OSError:
        pass

    try:
        try:
            raise ValueError("logged error")
        except ValueError as e:
            log_exception(
                "VALUE ERROR", e, "Traceback: test\n",
                location_override=("test_file.py", 10))

        # Verify the log file was created with correct content
        with open(config.LOG_FILE, "r") as f:
            content = f.read()
        assert len(content) > 0, "Log file should not be empty"
        assert "VALUE ERROR" in content, "Log should contain error type"
        assert "test_file.py" in content, "Log should contain filename"
        assert "10" in content, "Log should contain line number"
        assert "Traceback" in content, "Log should contain traceback text"
        print("  Exception logged successfully ({} chars)".format(len(content)))
    finally:
        # Clean up
        try:
            os.remove(config.LOG_FILE)
        except OSError:
            pass
        config.LOG_FILE = original_log


def test_open_log_file_rotates_at_threshold():
    """open_log_file truncates the log file when it exceeds MAX_LOG_BYTES."""
    from lib.launcher.logging import open_log_file
    import config as cfg

    log_path = _tmp_path("_tmp_log_rotate.txt")
    saved_log = cfg.LOG_FILE
    saved_max = cfg.MAX_LOG_BYTES
    cfg.LOG_FILE = log_path
    cfg.MAX_LOG_BYTES = 50
    try:
        with open(log_path, "w") as fh:
            fh.write("X" * 200)
        assert os.path.getsize(log_path) >= cfg.MAX_LOG_BYTES, \
            "Pre-existing log should exceed MAX_LOG_BYTES"

        handle = open_log_file()
        try:
            assert handle is not None, "open_log_file should return a handle"
        finally:
            handle.close()

        size_after = os.path.getsize(log_path)
        assert size_after == 0, \
            "Log should be truncated after rotation, got {} bytes".format(size_after)
        print("  Log rotated (truncated) at threshold")
    finally:
        cfg.LOG_FILE = saved_log
        cfg.MAX_LOG_BYTES = saved_max
        try:
            os.remove(log_path)
        except OSError:
            pass


def test_open_log_file_append_below_threshold():
    """open_log_file appends to an existing log below MAX_LOG_BYTES."""
    from lib.launcher.logging import open_log_file
    import config as cfg

    log_path = _tmp_path("_tmp_log_append.txt")
    saved_log = cfg.LOG_FILE
    saved_max = cfg.MAX_LOG_BYTES
    cfg.LOG_FILE = log_path
    cfg.MAX_LOG_BYTES = 10000
    try:
        with open(log_path, "w") as fh:
            fh.write("first entry\n")

        handle = open_log_file()
        try:
            handle.write("second entry\n")
        finally:
            handle.close()

        with open(log_path, "r") as fh:
            content = fh.read()
        assert "first entry" in content, \
            "Existing log content should be preserved, got: {}".format(content)
        assert "second entry" in content, \
            "New content should be appended, got: {}".format(content)
        print("  Log appended below threshold")
    finally:
        cfg.LOG_FILE = saved_log
        cfg.MAX_LOG_BYTES = saved_max
        try:
            os.remove(log_path)
        except OSError:
            pass


def test_log_exception_uses_location_callback_when_no_override():
    """log_exception falls through to '?:?' when no callback or override is given."""
    from lib.launcher.logging import log_exception
    import config as cfg

    log_path = _tmp_path("_tmp_log_nocb.txt")
    saved_log = cfg.LOG_FILE
    cfg.LOG_FILE = log_path
    try:
        try:
            os.remove(log_path)
        except OSError:
            pass
        log_exception("RUNTIME ERROR", RuntimeError("x"), "Trace: nothing\n")
        with open(log_path, "r") as fh:
            content = fh.read()
        assert "Source: ?:?" in content, \
            "Expected 'Source: ?:?' when no location info, got: {}".format(content)
        print("  Missing location written as '?:?'")
    finally:
        cfg.LOG_FILE = saved_log
        try:
            os.remove(log_path)
        except OSError:
            pass


def test_log_exception_unknown_time_when_no_localtime():
    """log_exception writes 'UNKNOWN-TIME' when utime.localtime is unavailable."""
    from lib.launcher.logging import log_exception
    import config as cfg
    import utime

    log_path = _tmp_path("_tmp_log_notime.txt")
    saved_log = cfg.LOG_FILE
    cfg.LOG_FILE = log_path
    saved_localtime = utime.localtime
    try:
        try:
            os.remove(log_path)
        except OSError:
            pass
        del utime.localtime
        log_exception("RUNTIME ERROR", RuntimeError("y"), "Trace: y\n")
        with open(log_path, "r") as fh:
            content = fh.read()
        assert "UNKNOWN-TIME" in content, \
            "Expected 'UNKNOWN-TIME' sentinel, got: {}".format(content)
        print("  UNKNOWN-TIME sentinel written")
    finally:
        utime.localtime = saved_localtime
        cfg.LOG_FILE = saved_log
        try:
            os.remove(log_path)
        except OSError:
            pass


# =============================================================================
# handler MODULE TESTS
# =============================================================================

def test_handle_exception_no_crash():
    """Test that handle_exception runs without crashing for each error type."""
    from lib.launcher.handler import handle_exception
    import config

    # Clean up log file
    try:
        os.remove(config.LOG_FILE)
    except OSError:
        pass

    error_types = [
        ("IMPORT ERROR", ImportError("no module named 'xyz'")),
        ("NAME ERROR", NameError("name 'x' is not defined")),
        ("TYPE ERROR", TypeError("unsupported operand")),
        ("VALUE ERROR", ValueError("invalid literal")),
        ("OS ERROR", OSError("file not found")),
        ("RUNTIME ERROR", RuntimeError("something went wrong")),
        ("UNEXPECTED ERROR", Exception("mystery error")),
    ]

    for title, error in error_types:
        try:
            handle_exception(title, error)
            print("  {} handled without crash".format(title))
        except Exception as e:
            raise AssertionError(
                "handle_exception crashed on {}: {}".format(title, e))

    # Clean up
    try:
        os.remove(config.LOG_FILE)
    except OSError:
        pass


def test_handle_exception_syntax_error():
    """Test handle_exception with a SyntaxError (special handling)."""
    from lib.launcher.handler import handle_exception
    import config

    # Clean up log file
    try:
        os.remove(config.LOG_FILE)
    except OSError:
        pass

    try:
        compile("def foo(\n", "<test>", "exec")
    except SyntaxError as e:
        try:
            handle_exception("SYNTAX ERROR", e)
            print("  SYNTAX ERROR handled without crash")
        except Exception as ex:
            raise AssertionError(
                "handle_exception crashed on SyntaxError: {}".format(ex))

    # Clean up
    try:
        os.remove(config.LOG_FILE)
    except OSError:
        pass


# -----------------------------------------------------------------------------
# Helpers for the additional edge-case tests below
# -----------------------------------------------------------------------------

def _capture_stdout(fn, *args, **kwargs):
    """Run fn with sys.stdout redirected to a StringIO; return captured text.

    Args:
        fn: Callable to invoke.
        *args: Positional arguments forwarded to fn.
        **kwargs: Keyword arguments forwarded to fn.

    Returns:
        str: Everything fn wrote to stdout.
    """
    buf = io.StringIO()
    saved = sys.stdout
    sys.stdout = buf
    try:
        fn(*args, **kwargs)
    finally:
        sys.stdout = saved
    return buf.getvalue()


def _capture_stdout_and_return(fn, *args, **kwargs):
    """Like _capture_stdout but returns the function's return value.

    Args:
        fn: Callable to invoke.
        *args: Positional arguments forwarded to fn.
        **kwargs: Keyword arguments forwarded to fn.

    Returns:
        Whatever fn returned (stdout is discarded).
    """
    buf = io.StringIO()
    saved = sys.stdout
    sys.stdout = buf
    try:
        return fn(*args, **kwargs)
    finally:
        sys.stdout = saved


def _tmp_path(suffix):
    """Build an absolute path inside the test directory for temp files.

    Args:
        suffix: Filename suffix (including extension) for the temp file.

    Returns:
        str: Absolute filesystem path that does not yet need to exist.
    """
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), suffix)


# -----------------------------------------------------------------------------
# handler MODULE — additional edge tests
# -----------------------------------------------------------------------------

def test_handler_reconcile_location_prefers_parsed_when_args_missing():
    """_reconcile_location uses the parsed frame when args lack info."""
    from lib.launcher.handler import _reconcile_location

    filename, line_no = _reconcile_location(
        "RUNTIME ERROR", None, None, [("foo.py", 7)]
    )
    assert filename == "foo.py", "Expected foo.py, got {}".format(filename)
    assert line_no == 7, "Expected line 7, got {}".format(line_no)
    print("  Parsed frame used when args are empty")


def test_handler_reconcile_location_ignores_launcher_frame():
    """_reconcile_location keeps args location when parsed points to launcher."""
    from lib.launcher.handler import _reconcile_location
    from lib.launcher import traceback as tb

    saved = tb.LAUNCHER_FILENAME
    tb.set_launcher_filename("launcher.py")
    try:
        filename, line_no = _reconcile_location(
            "RUNTIME ERROR", "user.py", 5, [("launcher.py", 99)]
        )
    finally:
        tb.LAUNCHER_FILENAME = saved

    assert filename == "user.py", \
        "Expected user.py preserved, got {}".format(filename)
    assert line_no == 5, "Expected line 5 preserved, got {}".format(line_no)
    print("  Launcher frame ignored; args preserved")


def test_handler_reconcile_location_syntax_error_prefers_parsed():
    """_reconcile_location prefers the parsed frame for SYNTAX ERROR."""
    from lib.launcher.handler import _reconcile_location

    filename, line_no = _reconcile_location(
        "SYNTAX ERROR", "other.py", 1, [("script.py", 10)]
    )
    assert filename == "script.py", \
        "Expected script.py, got {}".format(filename)
    assert line_no == 10, "Expected line 10, got {}".format(line_no)
    print("  SYNTAX ERROR prefers parsed frame")


def test_handler_format_timestamp_without_localtime():
    """_format_timestamp returns the 'unknown' sentinel when localtime is gone."""
    from lib.launcher import handler as handler_mod
    import utime

    saved = utime.localtime
    try:
        del utime.localtime
        stamp = handler_mod._format_timestamp()
    finally:
        utime.localtime = saved

    assert stamp == "unknown", \
        "Expected 'unknown' sentinel, got {!r}".format(stamp)
    print("  Timestamp falls back to 'unknown'")


def test_handle_exception_import_error_lists_files():
    """handle_exception(IMPORT ERROR) prints the available-files heading."""
    from lib.launcher.handler import handle_exception
    import config as cfg

    log_path = _tmp_path("_tmp_log_import.txt")
    saved_log = cfg.LOG_FILE
    cfg.LOG_FILE = log_path
    try:
        output = _capture_stdout(
            handle_exception, "IMPORT ERROR", ImportError("no module foo")
        )
        assert "Available Files" in output, \
            "Expected 'Available Files' heading, got: {}".format(output[:200])
        print("  IMPORT ERROR lists available files")
    finally:
        cfg.LOG_FILE = saved_log
        try:
            os.remove(log_path)
        except OSError:
            pass


def test_handle_exception_writes_log_entry():
    """handle_exception writes the error title and message to LOG_FILE."""
    from lib.launcher.handler import handle_exception
    import config as cfg

    log_path = _tmp_path("_tmp_log_handler.txt")
    saved_log = cfg.LOG_FILE
    cfg.LOG_FILE = log_path
    try:
        try:
            os.remove(log_path)
        except OSError:
            pass
        _capture_stdout(handle_exception, "RUNTIME ERROR", RuntimeError("boom"))
        with open(log_path, "r") as fh:
            content = fh.read()
        assert "RUNTIME ERROR" in content, \
            "Log missing RUNTIME ERROR: {}".format(content)
        assert "boom" in content, "Log missing 'boom': {}".format(content)
        print("  Log entry written with title and message")
    finally:
        cfg.LOG_FILE = saved_log
        try:
            os.remove(log_path)
        except OSError:
            pass


# =============================================================================
# launcher __init__ MODULE TESTS
# =============================================================================

def test_run_function_exists():
    """Test that the run function is importable."""
    from lib.launcher import run
    assert callable(run), "run should be callable"
    print("  run() is importable and callable")


def test_exports():
    """Test that __all__ exports are available."""
    import lib.launcher as launcher
    assert hasattr(launcher, "run"), "Should export run"
    assert hasattr(launcher, "handle_exception"), \
        "Should export handle_exception"
    print("  All exports available")


def test_run_invokes_handle_exception_on_failure():
    """run() routes script exceptions through handle_exception."""
    import lib.launcher as launcher
    import config as cfg

    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_dir = os.path.join(workspace_root, "py_scripts")
    script_name = "_tmp_run_target_test"
    script_path = os.path.join(script_dir, script_name + ".py")

    with open(script_path, "w") as fh:
        fh.write('raise RuntimeError("from run test")\n')

    calls = []

    def fake_handle_exception(title, error):
        """Record invocations of handle_exception for assertion."""
        calls.append((title, error))

    saved_handle = launcher.handle_exception
    saved_file = cfg.FILE_NAME
    saved_dir = cfg.SCRIPT_DIRECTORY
    saved_modules = sys.modules.pop(script_name, None)
    try:
        launcher.handle_exception = fake_handle_exception
        cfg.FILE_NAME = script_name
        cfg.SCRIPT_DIRECTORY = script_dir
        _capture_stdout(launcher.run)
    finally:
        launcher.handle_exception = saved_handle
        cfg.FILE_NAME = saved_file
        cfg.SCRIPT_DIRECTORY = saved_dir
        sys.modules.pop(script_name, None)
        if saved_modules is not None:
            sys.modules[script_name] = saved_modules
        try:
            os.remove(script_path)
        except OSError:
            pass

    assert len(calls) == 1, \
        "Expected handle_exception called once, got {}".format(len(calls))
    title, error = calls[0]
    assert title == "RUNTIME ERROR", \
        "Expected title 'RUNTIME ERROR', got {}".format(title)
    assert isinstance(error, RuntimeError), \
        "Expected RuntimeError, got {}".format(type(error))
    print("  run() routed RuntimeError to handle_exception")


# =============================================================================
# config MODULE TESTS
# =============================================================================


# =============================================================================
# state MODULE TESTS (mock emulator)
# =============================================================================

def test_state_set_reporter_dedupes():
    """Registering the same reporter twice should only invoke it once per event."""
    import state
    state.reset()
    calls = []

    def reporter(event):
        """Record received events for assertion."""
        calls.append(event)

    try:
        state.set_reporter(reporter)
        state.set_reporter(reporter)  # duplicate registration
        calls.clear()
        state.emit_event("ping", {"x": 1})
        assert len(calls) == 1, \
            "Duplicate reporter should be deduped; got {} calls".format(len(calls))
    finally:
        state.clear_reporters()
    print("  Duplicate reporter registration is deduped")


def test_state_clear_reporters_silences_emits():
    """After clear_reporters(), reporters should no longer receive events."""
    import state
    state.reset()
    calls = []

    def reporter(event):
        """Record received events for assertion."""
        calls.append(event)

    try:
        state.set_reporter(reporter)
        state.clear_reporters()
        calls.clear()
        state.emit_event("ping", {"x": 1})
        assert len(calls) == 0, \
            "Cleared reporters should not receive events; got {}".format(calls)
    finally:
        state.clear_reporters()
    print("  clear_reporters silences subsequent emits")


def test_state_reset_emits_reset_event_and_clears_pins():
    """reset() should clear pin state and emit an event of type 'reset'."""
    import state
    state.reset()
    calls = []

    def reporter(event):
        """Record received events for assertion."""
        calls.append(event)

    try:
        state.set_reporter(reporter)
        state.register_pin("7", "OUT", initial=1)
        calls.clear()
        state.reset()
        assert state.snapshot() == [], \
            "reset() should clear pins; snapshot={}".format(state.snapshot())
        reset_events = [e for e in calls if e.get("type") == "reset"]
        assert len(reset_events) >= 1, \
            "reset() should emit a 'reset' event; got {}".format(calls)
    finally:
        state.clear_reporters()
    print("  reset() clears pins and emits 'reset' event")


def test_state_register_and_get_pin():
    """register_pin then get_pin_value/snapshot should reflect the registered pin."""
    import state
    state.reset()
    try:
        state.register_pin("0", "OUT", initial=1)
        assert state.get_pin_value("0") == 1, \
            "get_pin_value should return 1; got {}".format(state.get_pin_value("0"))
        snap = state.snapshot()
        ids = [p["identifier"] for p in snap]
        assert "0" in ids, "snapshot should contain pin '0'; got {}".format(ids)
    finally:
        state.clear_reporters()
    print("  register_pin/get_pin_value/snapshot agree")


def test_state_update_pin_emits_event_with_payload():
    """update_pin should emit a pin_update event with pin and value keys."""
    import state
    state.reset()
    calls = []

    def reporter(event):
        """Record received events for assertion."""
        calls.append(event)

    try:
        state.set_reporter(reporter)
        state.register_pin("2", "OUT", initial=1)
        calls.clear()
        state.update_pin("2", value=0)
        updates = [e for e in calls if e.get("type") == "pin_update"]
        assert len(updates) >= 1, \
            "Expected a pin_update event; got {}".format(calls)
        evt = updates[0]
        assert evt.get("pin") == "2", "Expected pin='2'; got {}".format(evt)
        assert evt.get("value") == 0, "Expected value=0; got {}".format(evt)
    finally:
        state.clear_reporters()
    print("  update_pin emits pin_update with pin and value")


def test_state_update_pin_throttle_suppresses_duplicate():
    """Two immediate update_pin calls should be throttled to a single emit."""
    import state
    state.reset()
    calls = []

    def reporter(event):
        """Record received events for assertion."""
        calls.append(event)

    try:
        state.set_reporter(reporter)
        state.register_pin("3", "OUT", initial=0)
        calls.clear()
        # Two updates back-to-back; throttle window is 1ms so the second is dropped
        state.update_pin("3", value=1)
        state.update_pin("3", value=1)
        updates = [e for e in calls if e.get("type") == "pin_update"]
        assert len(updates) == 1, \
            "Expected throttle to collapse to 1 pin_update; got {}".format(len(updates))
    finally:
        state.clear_reporters()
    print("  update_pin throttle suppresses immediate duplicate emit")


def test_state_adc_set_get_clamp_and_clear():
    """ADC values clamp to [0, 65535] and clear_adc_value resets to None."""
    import state
    state.reset()
    try:
        state.set_adc_value("0", 70000)
        assert state.get_adc_value("0") == 65535, \
            "High clamp expected 65535; got {}".format(state.get_adc_value("0"))
        state.set_adc_value("0", -10)
        assert state.get_adc_value("0") == 0, \
            "Low clamp expected 0; got {}".format(state.get_adc_value("0"))
        state.clear_adc_value("0")
        assert state.get_adc_value("0") is None, \
            "After clear expected None; got {}".format(state.get_adc_value("0"))
    finally:
        state.clear_reporters()
    print("  ADC set/get clamp and clear work as expected")


def test_state_i2c_register_device_and_response():
    """Registered I2C devices with explicit responses return that data."""
    import state
    state.reset()
    try:
        state.set_i2c_auto_respond(True)
        state.register_i2c_device(0, 0x68)
        state.set_i2c_response(0, 0x68, b"\x68", memaddr=0x75)
        devices = state.get_i2c_devices(0)
        assert 0x68 in devices, \
            "Bus 0 should list device 0x68; got {}".format(devices)
        resp = state.get_i2c_response(0, 0x68, nbytes=1, memaddr=0x75)
        assert resp == b"\x68", \
            "Expected b'\\x68'; got {}".format(resp)
    finally:
        state.clear_reporters()
    print("  I2C register + set_i2c_response returns configured bytes")


def test_state_i2c_auto_respond_disabled():
    """With auto_respond disabled and no response set, returns zero bytes."""
    import state
    state.reset()
    try:
        state.set_i2c_auto_respond(False)
        resp = state.get_i2c_response(0, 0x42, nbytes=3, memaddr=0x10)
        assert resp == b"\x00\x00\x00", \
            "Expected zero-filled fallback; got {}".format(resp)
    finally:
        state.clear_reporters()
        state.set_i2c_auto_respond(True)
    print("  auto_respond disabled returns zero-filled bytes")


def test_state_emit_helpers_payload_shapes():
    """PWM and NeoPixel emit helpers produce events with the documented shape."""
    import state
    state.reset()
    calls = []

    def reporter(event):
        """Record received events for assertion."""
        calls.append(event)

    try:
        state.set_reporter(reporter)
        calls.clear()
        state.emit_pwm_init("0", 5000, 32768)
        state.emit_pwm_freq("0", 1000)
        state.emit_pwm_duty("0", 16384)
        state.emit_pwm_deinit("0")
        state.emit_neopixel_init("4", 8)
        state.emit_neopixel_write([(255, 0, 0)])

        by_type = {e["type"]: e for e in calls if "type" in e}

        assert "pwm_init" in by_type, "missing pwm_init event"
        pi = by_type["pwm_init"]
        assert pi.get("pin") == "0" and pi.get("freq") == 5000 \
            and pi.get("duty") == 32768, "pwm_init payload wrong: {}".format(pi)

        assert "pwm_freq" in by_type, "missing pwm_freq event"
        assert by_type["pwm_freq"].get("freq") == 1000, \
            "pwm_freq payload wrong: {}".format(by_type["pwm_freq"])

        assert "pwm_duty" in by_type, "missing pwm_duty event"
        assert by_type["pwm_duty"].get("duty") == 16384, \
            "pwm_duty payload wrong: {}".format(by_type["pwm_duty"])

        assert "pwm_deinit" in by_type, "missing pwm_deinit event"
        assert by_type["pwm_deinit"].get("pin") == "0", \
            "pwm_deinit payload wrong: {}".format(by_type["pwm_deinit"])

        assert "neopixel_init" in by_type, "missing neopixel_init event"
        npi = by_type["neopixel_init"]
        assert npi.get("pin") == "4" and npi.get("n") == 8, \
            "neopixel_init payload wrong: {}".format(npi)

        assert "neopixel_write" in by_type, "missing neopixel_write event"
        assert "pixels" in by_type["neopixel_write"], \
            "neopixel_write missing 'pixels': {}".format(by_type["neopixel_write"])
    finally:
        state.clear_reporters()
    print("  PWM and NeoPixel emit helpers have expected payload shapes")


# =============================================================================
# runner MODULE TESTS (mock emulator)
# =============================================================================

def test_runner_find_workspace_root_returns_path():
    """find_workspace_root walks up to the project root containing markers."""
    import runner
    from pathlib import Path
    # Use this test file's path so the search finds the real workspace root
    result = runner.find_workspace_root(Path(__file__).resolve())
    result_str = str(result)
    assert result.exists(), \
        "find_workspace_root result must exist; got {}".format(result_str)
    assert result_str.endswith("Codespaces_Micropython_Bridge"), \
        "Expected workspace folder name suffix; got {}".format(result_str)
    print("  find_workspace_root returns the project root path")


def test_runner_configure_paths_inserts_mock_directory():
    """configure_paths should add the mock directory onto sys.path."""
    import runner
    from pathlib import Path
    mock_root = Path(__file__).resolve().parent.parent / ".extension" / "emulator" / "mock"
    workspace_root = Path(__file__).resolve().parent.parent
    saved_path = list(sys.path)
    saved_env = os.environ.get("MICROPYTHON_TYPINGS")
    try:
        runner.configure_paths(mock_root, Path(__file__).resolve(), workspace_root)
        assert str(mock_root) in sys.path, \
            "Expected mock_root on sys.path; got {}".format(sys.path[:5])
    finally:
        sys.path[:] = saved_path
        if saved_env is None:
            os.environ.pop("MICROPYTHON_TYPINGS", None)
        else:
            os.environ["MICROPYTHON_TYPINGS"] = saved_env
    print("  configure_paths inserts the mock directory onto sys.path")


def test_runner_configure_paths_sets_typings_env():
    """configure_paths should set the MICROPYTHON_TYPINGS environment variable."""
    import runner
    from pathlib import Path
    mock_root = Path(__file__).resolve().parent.parent / ".extension" / "emulator" / "mock"
    workspace_root = Path(__file__).resolve().parent.parent
    saved_path = list(sys.path)
    saved_env = os.environ.get("MICROPYTHON_TYPINGS")
    try:
        # Force the env var to be unset so setdefault() will assign it
        os.environ.pop("MICROPYTHON_TYPINGS", None)
        runner.configure_paths(mock_root, Path(__file__).resolve(), workspace_root)
        assert "MICROPYTHON_TYPINGS" in os.environ, \
            "Expected MICROPYTHON_TYPINGS to be set after configure_paths"
        assert os.environ["MICROPYTHON_TYPINGS"].endswith("typings"), \
            "Expected typings path; got {}".format(os.environ["MICROPYTHON_TYPINGS"])
    finally:
        sys.path[:] = saved_path
        if saved_env is None:
            os.environ.pop("MICROPYTHON_TYPINGS", None)
        else:
            os.environ["MICROPYTHON_TYPINGS"] = saved_env
    print("  configure_paths sets MICROPYTHON_TYPINGS env var")


def test_runner_inject_mock_modules_present_after_call():
    """_inject_mock_modules should place mock 'gc' and 'micropython' into sys.modules."""
    import runner
    from pathlib import Path
    mock_root = Path(__file__).resolve().parent.parent / ".extension" / "emulator" / "mock"
    micropython_path = mock_root / "micropython"
    runner._inject_mock_modules(micropython_path)
    assert "gc" in sys.modules, "Expected 'gc' in sys.modules after injection"
    assert "micropython" in sys.modules, \
        "Expected 'micropython' in sys.modules after injection"
    print("  _inject_mock_modules registers gc and micropython modules")


# =============================================================================
# META TEST: GOOGLE-STYLE DOCSTRING COVERAGE
# =============================================================================

# Directories to exclude from the docstring meta-test. Paths are relative to
# the workspace root and matched as path prefixes.
_DOCSTRING_EXCLUDE_DIRS = (
    "release",
    "notes",
    ".git",
    ".extension/.vscode-test",
    ".extension/project",        # bundled template mirror of root files
    ".extension/node_modules",
    ".extension/out",
    ".extension/dist",
    ".extension/bridge/node_modules",
)

# Markers that indicate a NON-Google docstring style. If any of these patterns
# appear in a docstring, it is rejected so contributors keep one consistent style.
# - reST/Sphinx:   :param x:, :returns:, :rtype:, :raises:
# - NumPy:         section followed by a line of dashes (Parameters\n----------)
_REST_MARKERS = (":param ", ":returns:", ":return:", ":rtype:", ":raises ", ":raises:")
_NUMPY_SECTION_HEADERS = (
    "Parameters", "Returns", "Yields", "Raises", "Other Parameters",
    "Attributes", "Methods", "See Also", "Notes", "Examples",
)


def _iter_project_python_files():
    """Yield absolute paths of Python source files to lint for docstrings.

    Walks the workspace root and skips directories listed in
    ``_DOCSTRING_EXCLUDE_DIRS`` as well as hidden ``__pycache__`` folders.

    Yields:
        str: Absolute path to a ``.py`` file inside the project.
    """
    for dirpath, dirnames, filenames in os.walk(_workspace_root):
        # Prune excluded directories in-place so os.walk skips them entirely.
        rel_dir = os.path.relpath(dirpath, _workspace_root).replace(os.sep, "/")
        if rel_dir == ".":
            rel_dir = ""
        if any(
            rel_dir == ex or rel_dir.startswith(ex + "/")
            for ex in _DOCSTRING_EXCLUDE_DIRS
        ):
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d != "__pycache__"]
        for name in filenames:
            if name.endswith(".py"):
                yield os.path.join(dirpath, name)


def _is_google_style_docstring(doc):
    """Return ``(is_google, reason)`` for a function docstring.

    A docstring is considered Google-style when it is a non-empty string that
    does not use reST/Sphinx field markers (such as colon-param or
    colon-return) and does not use NumPy-style underlined section headers
    (e.g. ``Parameters\\n----------``). A bare one-line summary is accepted.

    Args:
        doc (str | None): The docstring extracted via ``ast.get_docstring``.

    Returns:
        tuple[bool, str]: ``(True, "")`` if the docstring is Google-style;
        otherwise ``(False, reason)`` describing the first violation found.
    """
    if doc is None:
        return False, "missing docstring"
    stripped = doc.strip()
    if not stripped:
        return False, "empty docstring"
    lowered = doc.lower()
    for marker in _REST_MARKERS:
        if marker in lowered:
            return False, "uses reST/Sphinx marker '{}'".format(marker.strip())
    lines = doc.splitlines()
    for i in range(len(lines) - 1):
        header = lines[i].strip()
        if header in _NUMPY_SECTION_HEADERS:
            underline = lines[i + 1].strip()
            if underline and set(underline) <= {"-"} and len(underline) >= 3:
                return False, "uses NumPy-style header '{}'".format(header)
    return True, ""


def _collect_docstring_violations():
    """Scan the project and return a list of docstring violations.

    Each violation is a tuple ``(relative_path, line, qualname, reason)``.
    Functions and methods are detected via ``ast`` so that decorators,
    overloads, and nested definitions are covered.

    Returns:
        list[tuple[str, int, str, str]]: All discovered violations.
    """
    import ast

    violations = []
    for path in _iter_project_python_files():
        try:
            with open(path, "r", encoding="utf-8") as handle:
                source = handle.read()
        except (OSError, UnicodeDecodeError) as exc:
            violations.append((
                os.path.relpath(path, _workspace_root),
                0, "<file>", "could not read: {}".format(exc),
            ))
            continue
        try:
            tree = ast.parse(source, filename=path)
        except SyntaxError as exc:
            violations.append((
                os.path.relpath(path, _workspace_root),
                exc.lineno or 0, "<module>",
                "syntax error: {}".format(exc.msg),
            ))
            continue

        # Build a parent map so we can compute dotted qualified names.
        parents = {}
        for node in ast.walk(tree):
            for child in ast.iter_child_nodes(node):
                parents[child] = node

        def qualname(node):
            """Return the dotted qualified name for a function/class node."""
            parts = [node.name]
            cur = parents.get(node)
            while isinstance(cur, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                parts.append(cur.name)
                cur = parents.get(cur)
            return ".".join(reversed(parts))

        rel = os.path.relpath(path, _workspace_root)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                doc = ast.get_docstring(node, clean=False)
                ok, reason = _is_google_style_docstring(doc)
                if not ok:
                    violations.append((rel, node.lineno, qualname(node), reason))
    return violations


def test_all_functions_have_google_docstrings():
    """Meta test: every function in the project has a Google-style docstring.

    Walks the workspace, parses each ``.py`` file with ``ast``, and asserts
    that every ``def``/``async def`` (including methods and nested functions)
    declares a non-empty docstring that does not use reST or NumPy style.

    Raises:
        AssertionError: If any function is missing a docstring or uses a
            disallowed docstring style. The message lists every offender.
    """
    violations = _collect_docstring_violations()
    if violations:
        lines = [
            "  {}:{}  {}  -- {}".format(path, line, name, reason)
            for path, line, name, reason in violations
        ]
        raise AssertionError(
            "Found {} function(s) without a Google-style docstring:\n{}".format(
                len(violations), "\n".join(lines)
            )
        )
    print("  All project functions have Google-style docstrings")


# =============================================================================
# config MODULE TESTS
# =============================================================================

def test_config_values():
    """Test that config module has all required settings."""
    import config

    assert hasattr(config, "FILE_NAME"), "config should have FILE_NAME"
    assert isinstance(config.FILE_NAME, str), "FILE_NAME should be a string"
    assert len(config.FILE_NAME) > 0, "FILE_NAME should not be empty"

    assert hasattr(config, "SCRIPT_DIRECTORY"), \
        "config should have SCRIPT_DIRECTORY"
    assert hasattr(config, "LIB_DIRECTORY"), \
        "config should have LIB_DIRECTORY"
    assert hasattr(config, "CONTEXT_RADIUS"), \
        "config should have CONTEXT_RADIUS"
    assert isinstance(config.CONTEXT_RADIUS, int), \
        "CONTEXT_RADIUS should be an int"
    assert config.CONTEXT_RADIUS >= 0, \
        "CONTEXT_RADIUS should be non-negative"

    assert hasattr(config, "LOG_FILE"), "config should have LOG_FILE"
    assert hasattr(config, "MAX_LOG_BYTES"), "config should have MAX_LOG_BYTES"
    assert isinstance(config.MAX_LOG_BYTES, int), \
        "MAX_LOG_BYTES should be an int"
    assert config.MAX_LOG_BYTES > 0, "MAX_LOG_BYTES should be positive"

    assert hasattr(config, "STOP_PIN_NUMBER"), \
        "config should have STOP_PIN_NUMBER"
    assert isinstance(config.STOP_PIN_NUMBER, int), \
        "STOP_PIN_NUMBER should be an int"
    print("  All config values present and valid")


# =============================================================================
# MOCK MICROPYTHON MODULE TESTS
# =============================================================================

def test_machine_pin_value_roundtrip():
    """Setting a Pin's value should round-trip when reading it back."""
    import machine
    p = machine.Pin(2, machine.Pin.OUT)
    p.value(1)
    assert p.value() == 1, "Pin value should read back as 1 after setting to 1"
    p.value(0)
    assert p.value() == 0, "Pin value should read back as 0 after setting to 0"
    print("  Pin.value() round-trips set values")


def test_machine_pin_on_off_toggle():
    """on/off/toggle should update Pin.value() correctly."""
    import machine
    p = machine.Pin(2, machine.Pin.OUT)
    p.off()
    assert p.value() == 0, "off() should set pin to 0"
    p.on()
    assert p.value() == 1, "on() should set pin to 1"
    p.toggle()
    assert p.value() == 0, "toggle() from 1 should yield 0"
    p.toggle()
    assert p.value() == 1, "toggle() from 0 should yield 1"
    print("  on/off/toggle update pin value correctly")


def test_machine_pin_irq_registers_callback():
    """Pin.irq() should accept a handler and trigger without raising."""
    import machine
    p = machine.Pin(3, machine.Pin.IN)

    def handler(pin):
        """Dummy IRQ handler used to verify registration succeeds."""
        return None

    p.irq(trigger=machine.Pin.IRQ_FALLING, handler=handler)
    assert p._irq_handler is handler, "Pin should store the registered IRQ handler"
    assert p._irq_trigger == machine.Pin.IRQ_FALLING, \
        "Pin should store the registered IRQ trigger"
    print("  Pin.irq stores handler and trigger")


def test_machine_pwm_init_freq_duty():
    """PWM.freq() and PWM.duty_u16() should read back values just set."""
    import machine
    pwm = machine.PWM(machine.Pin(4))
    pwm.freq(2000)
    pwm.duty_u16(32768)
    assert pwm.freq() == 2000, "PWM frequency should read back as 2000"
    assert pwm.duty_u16() == 32768, "PWM duty_u16 should read back as 32768"
    print("  PWM freq/duty_u16 round-trip correctly")


def test_machine_pwm_duty_u16_clamps_high():
    """duty_u16() should clamp values above 65535 down to 65535."""
    import machine
    pwm = machine.PWM(machine.Pin(5))
    pwm.duty_u16(99999)
    assert pwm.duty_u16() == 65535, \
        "duty_u16 should clamp values >65535 to 65535"
    print("  PWM duty_u16 clamps high values to 65535")


def test_machine_adc_read_u16_in_range():
    """ADC.read_u16() should return an int in the 0..65535 range."""
    import machine
    adc = machine.ADC(machine.Pin(26))
    value = adc.read_u16()
    assert isinstance(value, int), "read_u16 should return an int"
    assert 0 <= value <= 65535, \
        "read_u16 should return a value within 0..65535, got {}".format(value)
    print("  ADC.read_u16 returns int in 0..65535")


def test_machine_adc_set_simulated_value():
    """set_simulated_value() should make read_u16() return the configured value."""
    import machine
    adc = machine.ADC(machine.Pin(27))
    adc.set_simulated_value(12345)
    assert adc.read_u16() == 12345, \
        "read_u16 should return the previously set simulated value"
    print("  ADC.set_simulated_value controls read_u16 output")


def test_machine_i2c_scan_returns_registered_addresses():
    """I2C.scan() should include any address registered via register_device()."""
    import machine
    import state
    state.reset()
    i2c = machine.I2C(0)
    i2c.register_device(0x42)
    addresses = i2c.scan()
    assert isinstance(addresses, list), "scan() should return a list"
    assert 0x42 in addresses, \
        "scan() should include the registered device address 0x42"
    print("  I2C.scan includes registered device addresses")


def test_machine_i2c_writeto_readfrom_mem():
    """writeto_mem should not raise and readfrom_mem returns nbytes of data."""
    import machine
    import state
    state.reset()
    i2c = machine.I2C(0)
    i2c.register_device(0x42)
    # The mock writeto_mem only emits an event (no real backing store).
    # Use state.set_i2c_response to define what readfrom_mem returns.
    state.set_i2c_response(0, 0x42, b"\xDE\xAD\xBE\xEF", memaddr=0x10)
    i2c.writeto_mem(0x42, 0x10, b"\xDE\xAD\xBE\xEF")
    data = i2c.readfrom_mem(0x42, 0x10, 4)
    assert isinstance(data, bytes), "readfrom_mem should return bytes"
    assert len(data) == 4, "readfrom_mem should return the requested nbytes"
    assert data == b"\xDE\xAD\xBE\xEF", \
        "readfrom_mem should return the configured response bytes"
    print("  I2C writeto_mem + readfrom_mem return configured response")


def test_machine_spi_write_readinto():
    """SPI.write_readinto should populate the read buffer without erroring."""
    import machine
    spi = machine.SPI(0)
    write_buf = bytes([1, 2, 3, 4])
    read_buf = bytearray(4)
    spi.write_readinto(write_buf, read_buf)
    assert len(read_buf) == 4, "read buffer should remain its original length"
    # Mock readinto fills the buffer with zeros.
    assert all(b == 0 for b in read_buf), \
        "Mock SPI read_buf should be zero-filled, got {}".format(list(read_buf))
    print("  SPI.write_readinto fills read buffer (zeros in mock)")


def test_machine_uart_loopback_write_read():
    """UART with loopback enabled should echo writes back through read()."""
    import machine
    uart = machine.UART(0, baudrate=115200)
    machine.UART.enable_loopback(True)
    uart.write(b"hi")
    data = uart.read(2)
    assert data == b"hi", \
        "UART loopback read should return what was just written, got {!r}".format(data)
    print("  UART loopback echoes write back to read")


def test_machine_timer_init_callback_recorded():
    """Timer.init then deinit should run without raising and store callback."""
    import machine
    t = machine.Timer()

    def cb(timer):
        """Dummy Timer callback used to verify registration succeeds."""
        return None

    t.init(period=10, mode=machine.Timer.PERIODIC, callback=cb)
    assert t._callback is cb, "Timer should record the registered callback"
    t.deinit()
    assert t._callback is None, "deinit() should clear the timer callback"
    print("  Timer.init records callback; deinit clears it")


def test_machine_rtc_datetime_roundtrip():
    """RTC.datetime() should return an 8-tuple matching what was set."""
    import machine
    rtc = machine.RTC()
    dt = (2025, 1, 2, 3, 4, 5, 6, 0)
    rtc.datetime(dt)
    got = rtc.datetime()
    assert isinstance(got, tuple), "RTC.datetime() should return a tuple"
    assert len(got) == 8, \
        "RTC.datetime() should return an 8-tuple, got len={}".format(len(got))
    assert got == dt, "RTC.datetime() should round-trip the set value"
    print("  RTC.datetime() round-trips an 8-tuple")


def test_machine_wdt_feed_no_crash():
    """WDT.feed() should run without raising."""
    import machine
    wdt = machine.WDT(timeout=1000)
    wdt.feed()
    print("  WDT.feed() ran without error")


def test_machine_unique_id_returns_bytes():
    """machine.unique_id() should return a non-empty bytes value."""
    import machine
    uid = machine.unique_id()
    assert isinstance(uid, bytes), "unique_id() should return bytes"
    assert len(uid) > 0, "unique_id() should be non-empty"
    print("  unique_id() returns non-empty bytes")


def test_machine_freq_set_and_get():
    """machine.freq() should return an int and accept a setter argument."""
    import machine
    original = machine.freq()
    assert isinstance(original, int), "freq() should return an int"
    machine.freq(125_000_000)
    assert machine.freq() == 125_000_000, \
        "freq() should return the most-recently-set value"
    machine.freq(original)  # restore
    print("  machine.freq get/set works")


def test_machine_reset_raises_systemexit():
    """machine.reset() should raise SystemExit (ending emulation)."""
    import machine
    raised = False
    try:
        machine.reset()
    except SystemExit:
        raised = True
    assert raised, "machine.reset() should raise SystemExit"
    print("  machine.reset() raises SystemExit")


def test_utime_ticks_diff_basic():
    """utime.ticks_diff(100, 90) should equal 10."""
    import utime
    assert utime.ticks_diff(100, 90) == 10, \
        "ticks_diff(100, 90) should be 10"
    print("  utime.ticks_diff basic arithmetic works")


def test_utime_ticks_add_wraps_or_adds():
    """utime.ticks_add(0, 50) should equal 50 within the 30-bit range."""
    import utime
    assert utime.ticks_add(0, 50) == 50, "ticks_add(0, 50) should be 50"
    print("  utime.ticks_add returns expected sum")


def test_utime_localtime_returns_8_tuple():
    """utime.localtime() should return an 8-tuple."""
    import utime
    t = utime.localtime()
    assert isinstance(t, tuple), "localtime() should return a tuple"
    assert len(t) == 8, "localtime() should return an 8-tuple, got {}".format(len(t))
    print("  utime.localtime() returns an 8-tuple")


def test_utime_sleep_ms_zero_noop():
    """utime.sleep_ms(0) should return quickly without raising."""
    import utime
    import time as _t
    start = _t.time()
    utime.sleep_ms(0)
    elapsed = _t.time() - start
    assert elapsed < 0.1, "sleep_ms(0) should be fast, took {}s".format(elapsed)
    print("  utime.sleep_ms(0) is a fast no-op")


def test_neopixel_setitem_getitem_roundtrip():
    """NeoPixel __setitem__/__getitem__ should round-trip color tuples."""
    import neopixel
    import machine
    np = neopixel.NeoPixel(machine.Pin(6), 8)
    np[0] = (10, 20, 30)
    assert np[0] == (10, 20, 30), \
        "NeoPixel index 0 should read back the tuple just written"
    print("  NeoPixel set/get round-trip works")


def test_neopixel_fill_then_write():
    """NeoPixel.fill + write should set all pixels and emit a write event."""
    import neopixel
    import machine
    import state
    state.reset()
    events = []

    def reporter(event):
        """Capture emitted events for assertion."""
        events.append(event)

    try:
        state.set_reporter(reporter)
        np = neopixel.NeoPixel(machine.Pin(6), 4)
        np.fill((1, 2, 3))
        np.write()
        assert np[0] == (1, 2, 3), "fill should set pixel 0"
        assert np[3] == (1, 2, 3), "fill should set the last pixel"
        types = [e.get("type") for e in events]
        assert "neopixel_write" in types, \
            "write() should emit a neopixel_write event, got {}".format(types)
    finally:
        state.clear_reporters()
    print("  NeoPixel fill+write updates pixels and emits event")


def test_neopixel_index_out_of_range_raises():
    """Accessing a NeoPixel index out of range should raise IndexError."""
    import neopixel
    import machine
    np = neopixel.NeoPixel(machine.Pin(6), 8)
    raised = False
    try:
        _ = np[100]
    except IndexError:
        raised = True
    assert raised, "NeoPixel[100] should raise IndexError on an 8-pixel strip"
    print("  NeoPixel out-of-range read raises IndexError")


def test_network_wlan_connect_isconnected_disconnect():
    """WLAN.connect should set isconnected True; disconnect should clear it."""
    import network
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect("ssid", "pwd")
    assert wlan.isconnected() is True, \
        "isconnected() should be True after connect()"
    wlan.disconnect()
    assert wlan.isconnected() is False, \
        "isconnected() should be False after disconnect()"
    print("  WLAN connect/isconnected/disconnect work")


def test_network_wlan_scan_returns_list():
    """WLAN.scan() should return a list of network tuples."""
    import network
    wlan = network.WLAN(network.STA_IF)
    results = wlan.scan()
    assert isinstance(results, list), "scan() should return a list"
    print("  WLAN.scan returns a list")


def test_network_hostname_get_and_set():
    """network.hostname() should echo its argument and default to 'micropython'.

    Note: the mock is stateless; calling hostname() with no arg always
    returns the literal 'micropython' rather than the most-recently-set value.
    """
    import network
    assert network.hostname() == "micropython", \
        "Default hostname should be 'micropython'"
    assert network.hostname("test-host") == "test-host", \
        "hostname(name) should echo back the supplied name"
    print("  network.hostname returns default and echoes argument")


def test_rp2_statemachine_put_get_roundtrip():
    """StateMachine.put should not raise; get returns 0 in the mock."""
    import rp2

    def prog():
        """Placeholder PIO program for StateMachine construction."""
        return None

    sm = rp2.StateMachine(0, prog, freq=2000)
    sm.active(1)
    sm.put(123)
    value = sm.get()
    assert value == 0, \
        "Mock StateMachine.get() always returns 0, got {}".format(value)
    print("  rp2.StateMachine put/get run (mock get is always 0)")


def test_rp2_bootsel_button_returns_int():
    """rp2.bootsel_button() should return an int (0 in mock)."""
    import rp2
    val = rp2.bootsel_button()
    assert isinstance(val, int), "bootsel_button() should return an int"
    print("  rp2.bootsel_button returns int")


def test_micropython_const_returns_value():
    """micropython.const(x) should return x unchanged."""
    import micropython
    assert micropython.const(42) == 42, "const(42) should return 42"
    print("  micropython.const returns its argument")


def test_micropython_schedule_invokes_immediately():
    """micropython.schedule should invoke the callback immediately in mock."""
    import micropython
    calls = []
    micropython.schedule(lambda x: calls.append(x), 7)
    assert calls == [7], \
        "schedule() should invoke the callback with the argument, got {}".format(calls)
    print("  micropython.schedule invokes callback immediately (mock)")


def test_uctypes_sizeof_returns_int():
    """uctypes.sizeof(UINT32) should return a positive int."""
    import uctypes
    size = uctypes.sizeof(uctypes.UINT32)
    assert isinstance(size, int), "sizeof should return an int"
    assert size > 0, "sizeof(UINT32) should be > 0, got {}".format(size)
    print("  uctypes.sizeof returns positive int")


def test_uos_ilistdir_returns_iterable():
    """uos.ilistdir() should yield entries we can iterate over without error."""
    import uos
    it = uos.ilistdir(".")
    entries = []
    for i, entry in enumerate(it):
        entries.append(entry)
        if i >= 3:
            break
    assert len(entries) >= 1, "ilistdir('.') should yield at least one entry"
    for entry in entries:
        assert isinstance(entry, tuple), \
            "Each ilistdir entry should be a tuple, got {!r}".format(entry)
    print("  uos.ilistdir yields tuples")


def test_uselect_poll_register_unregister():
    """uselect.poll() should support register/unregister on an fd-like object."""
    import uselect
    import os
    p = uselect.poll()
    r_fd, w_fd = os.pipe()
    try:
        p.register(r_fd, uselect.POLLIN)
        p.unregister(r_fd)
    finally:
        os.close(r_fd)
        os.close(w_fd)
    print("  uselect.poll register/unregister works")


def test_uzlib_decompress_roundtrip():
    """uzlib.decompress should reverse a zlib-compressed payload.

    Real MicroPython exposes only `uzlib.decompress` (compression lives in the
    separate `deflate` module on v1.21+), so the compressed bytes are
    pre-computed here instead of calling a `compress` function that the mock
    deliberately does not expose.
    """
    import uzlib
    payload = b"hello micropython mock"
    # Pre-computed via CPython: zlib.compress(b"hello micropython mock").
    compressed = (
        b"x\x9c\xcbH\xcd\xc9\xc9W\xc8\xcdL.\xca/\xa8,\xc9\xc8\xcfS"
        b"\xc8\xcdO\xce\x06\x00d]\x08\xbb"
    )
    assert uzlib.decompress(compressed) == payload, \
        "uzlib.decompress should round-trip a zlib-compressed payload"
    print("  uzlib.decompress round-trips a zlib payload")


def test_uhashlib_sha256_digest_length():
    """uhashlib.sha256(b'hello').digest() should be 32 bytes long."""
    import uhashlib
    d = uhashlib.sha256(b"hello").digest()
    assert isinstance(d, bytes), "digest() should return bytes"
    assert len(d) == 32, "sha256 digest should be 32 bytes, got {}".format(len(d))
    print("  uhashlib.sha256 digest is 32 bytes")


def test_gc_collect_does_not_crash():
    """gc.collect/enable/disable/isenabled should run without raising."""
    import gc as _gc
    was_enabled = _gc.isenabled()
    _gc.collect()
    _gc.enable()
    assert _gc.isenabled() is True, "isenabled() should be True after enable()"
    _gc.disable()
    assert _gc.isenabled() is False, "isenabled() should be False after disable()"
    if was_enabled:
        _gc.enable()
    print("  gc.collect/enable/disable/isenabled run cleanly")


def test_micropython_version_sentinel():
    """micropython module exposes the documented version tuple."""
    import micropython
    assert hasattr(micropython, "MICROPYTHON_VERSION"), \
        "micropython.MICROPYTHON_VERSION should exist"
    ver = micropython.MICROPYTHON_VERSION
    assert isinstance(ver, tuple) and len(ver) == 3, \
        "MICROPYTHON_VERSION should be a 3-tuple, got {!r}".format(ver)
    assert all(isinstance(p, int) for p in ver), \
        "MICROPYTHON_VERSION parts should all be ints"
    assert ver >= (1, 23, 0), \
        "Mock targets v1.23.0+, got {}".format(ver)
    assert getattr(micropython, "__version__", None) == ver, \
        "__version__ should match MICROPYTHON_VERSION"
    print("  micropython.MICROPYTHON_VERSION = {}".format(ver))


# Pinned baseline of every module + key symbol the mock must expose to claim
# parity with a given MicroPython release. Bumping
# `runner.MICROPYTHON_VERSION` past one of these thresholds will require the
# corresponding entries to be present in the mock, which in turn requires
# real implementations under `.extension/emulator/mock/micropython/`.
#
# Source of truth: https://docs.micropython.org/en/latest/library/
# Update procedure when a new MicroPython release ships:
#   1. Skim the release notes for newly-added modules / symbols.
#   2. Add a new `((maj, min, patch), { "module": (sym, sym, ...) })` entry.
#   3. Implement any missing surface in the mock.
#   4. Bump `runner.MICROPYTHON_VERSION` and the assertion above.
_MICROPYTHON_API_BASELINE = (
    ((1, 20, 0), {
        "machine": ("Pin", "PWM", "ADC", "I2C", "SPI", "Timer", "UART",
                    "WDT", "RTC", "Signal", "SoftI2C", "SoftSPI",
                    "mem8", "mem16", "mem32"),
        "micropython": ("const", "schedule", "alloc_emergency_exception_buf",
                        "mem_info", "qstr_info", "kbd_intr"),
        "gc": ("collect", "enable", "disable", "isenabled", "mem_alloc",
               "mem_free"),
        "utime": ("sleep", "sleep_ms", "sleep_us", "ticks_ms", "ticks_us",
                  "ticks_diff", "ticks_add", "time", "localtime", "gmtime",
                  "mktime"),
        "uos": ("ilistdir", "uname"),
        "ujson": ("dumps", "loads"),
        "ure": ("compile", "match", "search"),
        "ustruct": ("pack", "unpack", "calcsize"),
        "uio": ("StringIO", "BytesIO"),
        "uhashlib": ("sha256", "sha1", "md5"),
        "ubinascii": ("hexlify", "unhexlify", "a2b_base64", "b2a_base64"),
        "uzlib": ("decompress", "DecompIO"),
        "ucollections": ("namedtuple", "OrderedDict", "deque"),
        "usocket": ("socket", "AF_INET", "SOCK_STREAM", "getaddrinfo"),
        "uselect": ("poll", "POLLIN", "POLLOUT"),
        "network": ("WLAN", "STA_IF", "AP_IF"),
        "rp2": ("StateMachine", "asm_pio"),
        "framebuf": ("FrameBuffer", "MONO_VLSB", "MONO_HLSB", "RGB565"),
        "errno": ("EACCES", "EAGAIN", "ENOENT", "EINVAL", "errorcode"),
        "platform": ("platform", "python_compiler", "libc_ver"),
        "vfs": ("mount", "umount", "VfsFat", "VfsLfs2"),
    }),
    ((1, 21, 0), {
        "deflate": ("DeflateIO", "AUTO", "RAW", "ZLIB", "GZIP"),
    }),
    ((1, 22, 0), {
        # WLAN.ipconfig() landed in 1.22.
        "network": ("WLAN",),  # surface-level marker; method checked below
    }),
    ((1, 23, 0), {
        # RingIO landed in 1.23.
        "micropython": ("RingIO",),
        # asyncio.ThreadSafeFlag is part of the v1.23 baseline.
        "asyncio": ("run", "create_task", "sleep", "sleep_ms", "wait_for",
                    "gather", "Event", "Lock", "Queue", "ThreadSafeFlag",
                    "StreamReader", "StreamWriter"),
    }),
)


def test_mock_matches_pinned_micropython_baseline():
    """Mock surface must cover every module/symbol pinned for the target version.

    Reads ``runner.MICROPYTHON_VERSION``, walks the baseline manifest above,
    and for each release ``<= target`` asserts that every module imports and
    exposes every listed symbol. This is the test to run after bumping the
    targeted MicroPython version to catch any newly-required surface that
    has not yet been added to the mock.

    Raises:
        AssertionError: If any pinned module or symbol is missing for the
            current target version.
    """
    import importlib
    import runner

    target = runner.MICROPYTHON_VERSION
    missing = []
    for version, modules in _MICROPYTHON_API_BASELINE:
        if version > target:
            continue
        for module_name, symbols in modules.items():
            try:
                mod = importlib.import_module(module_name)
            except ImportError as exc:
                missing.append("module {} (for v{}): {}".format(
                    module_name, ".".join(map(str, version)), exc))
                continue
            for sym in symbols:
                if not hasattr(mod, sym):
                    missing.append("{}.{} (required for v{})".format(
                        module_name, sym, ".".join(map(str, version))))

    # Method-level checks for surface added in specific releases.
    if target >= (1, 22, 0):
        import network as _net
        wlan = _net.WLAN(_net.STA_IF)
        if not callable(getattr(wlan, "ipconfig", None)):
            missing.append("network.WLAN.ipconfig (required for v1.22)")
    if target >= (1, 23, 0):
        import micropython as _mp
        if not hasattr(_mp, "RingIO"):
            missing.append("micropython.RingIO (required for v1.23)")

    assert not missing, (
        "Mock is missing surface required for MicroPython v{}:\n  {}".format(
            ".".join(map(str, target)),
            "\n  ".join(missing),
        )
    )
    print("  Mock covers MicroPython v{} baseline ({} module entries)".format(
        ".".join(map(str, target)),
        sum(len(m) for v, m in _MICROPYTHON_API_BASELINE if v <= target),
    ))


def test_framebuf_module_surface():
    """framebuf exposes the documented pixel-format constants and FrameBuffer."""
    import framebuf
    for name in ("MONO_VLSB", "MONO_HLSB", "MONO_HMSB",
                 "RGB565", "GS2_HMSB", "GS4_HMSB", "GS8"):
        assert hasattr(framebuf, name), "framebuf.{} missing".format(name)
    buf = bytearray(16 * 8)
    fb = framebuf.FrameBuffer(buf, 16, 8, framebuf.MONO_VLSB)
    fb.fill(0)
    fb.pixel(1, 1, 1)
    assert fb.pixel(1, 1) == 0, "mock pixel get always returns 0"
    fb.hline(0, 0, 8, 1)
    fb.vline(0, 0, 4, 1)
    fb.rect(0, 0, 4, 4, 1)
    fb.fill_rect(0, 0, 2, 2, 1)
    fb.text("hi", 0, 0, 1)
    fb.scroll(1, 0)
    fb.ellipse(4, 4, 2, 2, 1)
    fb.poly(0, 0, (0, 0, 2, 0, 1, 2), 1, f=True)
    fb1 = framebuf.FrameBuffer1(bytearray(8), 8, 8)
    assert fb1.format == framebuf.MONO_VLSB
    print("  framebuf surface works")


def test_deflate_round_trip_via_deflateio():
    """DeflateIO can compress and decompress through a stream."""
    import deflate
    import uio
    sink = uio.BytesIO()
    writer = deflate.DeflateIO(sink)
    writer.write(b"abc" * 20)
    writer.close()
    compressed = sink.getvalue()
    assert compressed, "compressor should emit some bytes"
    source = uio.BytesIO(compressed)
    reader = deflate.DeflateIO(source)
    out = reader.read()
    reader.close()
    assert out == b"abc" * 20, \
        "DeflateIO round-trip should restore the original bytes"
    print("  deflate.DeflateIO round-trips data")


def test_vfs_mount_umount_tracks_state():
    """vfs.mount/umount maintain the mount registry and surface errors."""
    import vfs
    class _FakeBlock:
        """Minimal stub object passed as a filesystem to mount."""
    fs = _FakeBlock()
    vfs.mount(fs, "/tmpmount")
    try:
        try:
            vfs.mount(fs, "/tmpmount")
        except OSError:
            pass
        else:
            raise AssertionError("mount should raise OSError on duplicate")
    finally:
        vfs.umount("/tmpmount")
    try:
        vfs.umount("/tmpmount")
    except OSError:
        pass
    else:
        raise AssertionError("umount should raise OSError when not mounted")
    lfs = vfs.VfsLfs2(_FakeBlock(), readsize=64)
    assert lfs.readsize == 64, "VfsLfs2 should remember kwargs"
    assert len(lfs.statvfs("/")) == 10, "statvfs returns a 10-tuple"
    print("  vfs.mount / umount / VfsLfs2 work")


def test_errno_constants_present():
    """errno exposes the documented POSIX constants and errorcode mapping."""
    import errno
    for name in ("EACCES", "EAGAIN", "EBADF", "ENOENT", "EINVAL",
                 "ECONNREFUSED", "ETIMEDOUT"):
        assert hasattr(errno, name), "errno.{} missing".format(name)
        assert isinstance(getattr(errno, name), int)
    assert errno.errorcode[errno.ENOENT] == "ENOENT"
    print("  errno surface complete")


def test_platform_surface_minimal():
    """platform mock exposes the three documented MicroPython callables."""
    import platform
    assert callable(platform.platform)
    assert callable(platform.python_compiler)
    assert callable(platform.libc_ver)
    assert isinstance(platform.platform(), str)
    print("  platform mock callables available")


def test_asyncio_module_surface():
    """asyncio mock exposes ThreadSafeFlag and MicroPython helpers."""
    import asyncio
    for name in ("run", "create_task", "sleep", "sleep_ms", "gather",
                 "wait_for", "Event", "Lock", "Queue", "StreamReader",
                 "StreamWriter", "ThreadSafeFlag", "CancelledError"):
        assert hasattr(asyncio, name), "asyncio.{} missing".format(name)
    flag = asyncio.ThreadSafeFlag()
    flag.set()
    flag.clear()
    print("  asyncio surface present")


def test_micropython_ringio_round_trip():
    """RingIO buffers writes, reads them back, and drops oldest on overflow."""
    import micropython
    ring = micropython.RingIO(8)
    assert ring.any() == 0
    ring.write(b"abcd")
    assert ring.any() == 4
    assert ring.read(2) == b"ab"
    ring.write(b"efghij")  # exceeds capacity -> drop oldest
    assert ring.any() == 8
    tail = ring.read()
    assert tail.endswith(b"j"), "newest byte should still be present"
    assert len(tail) == 8
    print("  micropython.RingIO behaves correctly")


def test_machine_signal_inverts_pin_level():
    """machine.Signal forwards value() through optional inversion."""
    import machine
    pin = machine.Pin(2, machine.Pin.OUT)
    sig = machine.Signal(pin, invert=True)
    sig.on()
    assert pin.value() == 0, "on() should drive pin low when inverted"
    sig.off()
    assert pin.value() == 1, "off() should drive pin high when inverted"
    assert sig.value() == 0, "logical value() reads the inverted state"
    print("  machine.Signal honours invert")


def test_machine_pin_level_irq_constants():
    """Pin.IRQ_LOW_LEVEL / IRQ_HIGH_LEVEL are exposed as ints."""
    import machine
    assert isinstance(machine.Pin.IRQ_LOW_LEVEL, int)
    assert isinstance(machine.Pin.IRQ_HIGH_LEVEL, int)
    assert machine.Pin.IRQ_LOW_LEVEL != machine.Pin.IRQ_HIGH_LEVEL
    print("  Pin level-trigger constants present")


def test_network_wlan_ipconfig_round_trip():
    """WLAN.ipconfig should round-trip addr4 / gw4 / dns updates."""
    import network
    wlan = network.WLAN(network.STA_IF)
    wlan.ipconfig(addr4=("10.0.0.5", "255.255.255.0"), gw4="10.0.0.1", dns="1.1.1.1")
    assert wlan.ipconfig("addr4") == ("10.0.0.5", "255.255.255.0")
    assert wlan.ipconfig("gw4") == "10.0.0.1"
    assert wlan.ipconfig("dns") == "1.1.1.1"
    print("  network.WLAN.ipconfig round-trips")


def test_network_wlan_config_round_trip():
    """WLAN.config should accept known keys and round-trip them."""
    import network
    wlan = network.WLAN(network.STA_IF)
    wlan.config(channel=6, txpower=10, hidden=True)
    assert wlan.config("channel") == 6
    assert wlan.config("txpower") == 10
    assert wlan.config("hidden") is True
    print("  network.WLAN.config round-trips")


def test_utime_strftime_formats_tuple():
    """utime.strftime should format an 8-tuple via CPython rules."""
    import utime
    s = utime.strftime("%Y-%m-%d", (2024, 6, 1, 12, 0, 0, 5, 153))
    assert s == "2024-06-01", "Expected 2024-06-01, got {}".format(s)
    print("  utime.strftime formats correctly")


# =============================================================================
# RUN ALL TESTS
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("LAUNCHER LIBRARY TEST SUITE")
    print("=" * 60)
    print("Testing lib/launcher package...")

    # errors module
    run_test("errors.get_guidance (known types)", test_get_guidance_known_types)
    run_test("errors.get_guidance (unknown type)", test_get_guidance_unknown_type)
    run_test("errors.guidance content", test_error_guidance_content)
    run_test("errors.get_guidance (case-sensitive)", test_get_guidance_case_sensitive_returns_unexpected)
    run_test("errors.get_guidance (partial match)", test_get_guidance_partial_match_returns_unexpected)

    # source module
    run_test("source.get_script_path (default)", test_get_script_path_default)
    run_test("source.get_script_path (custom)", test_get_script_path_custom)
    run_test("source.get_script_path (dots)", test_get_script_path_with_dots)
    run_test("source.build_candidate_paths", test_build_candidate_paths)
    run_test("source.build_candidate_paths (absolute)", test_build_candidate_paths_absolute)
    run_test("source.build_candidate_paths (empty)", test_build_candidate_paths_empty)
    run_test("source.build_candidate_paths (no dupes)", test_build_candidate_paths_no_duplicates)
    run_test("source.load_source_lines (existing)", test_load_source_lines_existing_file)
    run_test("source.load_source_lines (missing)", test_load_source_lines_nonexistent)

    # traceback module
    run_test("traceback.extract_frames", test_extract_traceback_frames)
    run_test("traceback.extract_frames (empty)", test_extract_traceback_frames_empty)
    run_test("traceback.extract_frames (no line)", test_extract_traceback_frames_no_line)
    run_test("traceback.parse_location_from_trace", test_parse_location_from_trace_text)
    run_test("traceback.parse_location_from_trace (empty)", test_parse_location_from_trace_text_empty)
    run_test("traceback.parse_location_from_args", test_parse_location_from_args_basic)
    run_test("traceback.set_launcher_filename", test_set_launcher_filename)
    run_test("traceback.get_traceback_location", test_get_traceback_location)
    run_test("traceback.get_syntax_error_details", test_get_syntax_error_details)
    run_test("traceback.capture_trace_text", test_capture_trace_text)
    run_test("traceback.get_traceback_location (no tb)", test_get_traceback_location_no_active_exception)
    run_test("traceback.extract_frames (noise)", test_extract_traceback_frames_mixed_noise)
    run_test("traceback.parse_args (int only)", test_parse_location_from_args_integer_only)
    run_test("traceback.parse_args (mpy tuple)", test_parse_location_from_args_micropython_tuple)

    # context module
    run_test("context.get_error_location", test_get_error_location)
    run_test("context.print_code_context", test_print_code_context_no_crash)
    run_test("context.print_code_context (override)", test_print_code_context_override)
    run_test("context.print_code_context (None line)", test_print_code_context_none_line)
    run_test("context._display_context (empty file)", test_print_code_context_empty_file_message)
    run_test("context._display_context (out of range)", test_print_code_context_line_out_of_range_message)
    run_test("context._display_context (custom radius)", test_print_code_context_custom_radius_limits_window)
    run_test("context._try_trace_frames_fallback (alt)", test_try_trace_frames_fallback_uses_alternate_frame)
    run_test("context._try_trace_frames_fallback (same)", test_try_trace_frames_fallback_skips_same_filename)

    # files module
    run_test("files.list_directory (valid)", test_list_directory_valid)
    run_test("files.list_directory (invalid)", test_list_directory_invalid)
    run_test("files.print_available_files", test_print_available_files_no_crash)

    # logging module
    run_test("logging.open_log_file", test_open_log_file)
    run_test("logging.log_exception", test_log_exception)
    run_test("logging.open_log_file (rotate)", test_open_log_file_rotates_at_threshold)
    run_test("logging.open_log_file (append)", test_open_log_file_append_below_threshold)
    run_test("logging.log_exception (no callback)", test_log_exception_uses_location_callback_when_no_override)
    run_test("logging.log_exception (no localtime)", test_log_exception_unknown_time_when_no_localtime)

    # handler module
    run_test("handler.handle_exception", test_handle_exception_no_crash)
    run_test("handler.handle_exception (SyntaxError)", test_handle_exception_syntax_error)
    run_test("handler._reconcile_location (parsed)", test_handler_reconcile_location_prefers_parsed_when_args_missing)
    run_test("handler._reconcile_location (launcher)", test_handler_reconcile_location_ignores_launcher_frame)
    run_test("handler._reconcile_location (syntax)", test_handler_reconcile_location_syntax_error_prefers_parsed)
    run_test("handler._format_timestamp (no localtime)", test_handler_format_timestamp_without_localtime)
    run_test("handler.handle_exception (import lists files)", test_handle_exception_import_error_lists_files)
    run_test("handler.handle_exception (writes log)", test_handle_exception_writes_log_entry)

    # launcher __init__
    run_test("launcher.run exists", test_run_function_exists)
    run_test("launcher exports", test_exports)
    run_test("launcher.run invokes handle_exception", test_run_invokes_handle_exception_on_failure)

    # config module
    run_test("config values", test_config_values)

    # state module (mock emulator)
    run_test("state.set_reporter (dedupe)", test_state_set_reporter_dedupes)
    run_test("state.clear_reporters (silence)", test_state_clear_reporters_silences_emits)
    run_test("state.reset (clears + emits)", test_state_reset_emits_reset_event_and_clears_pins)
    run_test("state.register_pin / get_pin_value", test_state_register_and_get_pin)
    run_test("state.update_pin (payload)", test_state_update_pin_emits_event_with_payload)
    run_test("state.update_pin (throttle)", test_state_update_pin_throttle_suppresses_duplicate)
    run_test("state.adc set/get/clamp/clear", test_state_adc_set_get_clamp_and_clear)
    run_test("state.i2c register + response", test_state_i2c_register_device_and_response)
    run_test("state.i2c auto-respond disabled", test_state_i2c_auto_respond_disabled)
    run_test("state.emit helpers (payloads)", test_state_emit_helpers_payload_shapes)

    # runner module (mock emulator)
    run_test("runner.find_workspace_root", test_runner_find_workspace_root_returns_path)
    run_test("runner.configure_paths (sys.path)", test_runner_configure_paths_inserts_mock_directory)
    run_test("runner.configure_paths (typings env)", test_runner_configure_paths_sets_typings_env)
    run_test("runner._inject_mock_modules", test_runner_inject_mock_modules_present_after_call)

    # mock micropython modules
    run_test("machine.Pin value roundtrip", test_machine_pin_value_roundtrip)
    run_test("machine.Pin on/off/toggle", test_machine_pin_on_off_toggle)
    run_test("machine.Pin.irq registers callback", test_machine_pin_irq_registers_callback)
    run_test("machine.PWM init freq/duty", test_machine_pwm_init_freq_duty)
    run_test("machine.PWM duty_u16 clamps high", test_machine_pwm_duty_u16_clamps_high)
    run_test("machine.ADC read_u16 in range", test_machine_adc_read_u16_in_range)
    run_test("machine.ADC set_simulated_value", test_machine_adc_set_simulated_value)
    run_test("machine.I2C scan returns registered", test_machine_i2c_scan_returns_registered_addresses)
    run_test("machine.I2C writeto/readfrom_mem", test_machine_i2c_writeto_readfrom_mem)
    run_test("machine.SPI write_readinto", test_machine_spi_write_readinto)
    run_test("machine.UART loopback write/read", test_machine_uart_loopback_write_read)
    run_test("machine.Timer init callback", test_machine_timer_init_callback_recorded)
    run_test("machine.RTC datetime roundtrip", test_machine_rtc_datetime_roundtrip)
    run_test("machine.WDT feed", test_machine_wdt_feed_no_crash)
    run_test("machine.unique_id returns bytes", test_machine_unique_id_returns_bytes)
    run_test("machine.freq set/get", test_machine_freq_set_and_get)
    run_test("machine.reset raises SystemExit", test_machine_reset_raises_systemexit)
    run_test("utime.ticks_diff basic", test_utime_ticks_diff_basic)
    run_test("utime.ticks_add", test_utime_ticks_add_wraps_or_adds)
    run_test("utime.localtime 8-tuple", test_utime_localtime_returns_8_tuple)
    run_test("utime.sleep_ms(0) noop", test_utime_sleep_ms_zero_noop)
    run_test("neopixel set/get roundtrip", test_neopixel_setitem_getitem_roundtrip)
    run_test("neopixel fill then write", test_neopixel_fill_then_write)
    run_test("neopixel index out of range", test_neopixel_index_out_of_range_raises)
    run_test("network.WLAN connect/disconnect", test_network_wlan_connect_isconnected_disconnect)
    run_test("network.WLAN.scan returns list", test_network_wlan_scan_returns_list)
    run_test("network.hostname get/set", test_network_hostname_get_and_set)
    run_test("rp2.StateMachine put/get", test_rp2_statemachine_put_get_roundtrip)
    run_test("rp2.bootsel_button returns int", test_rp2_bootsel_button_returns_int)
    run_test("micropython.const returns value", test_micropython_const_returns_value)
    run_test("micropython.schedule immediate", test_micropython_schedule_invokes_immediately)
    run_test("uctypes.sizeof int", test_uctypes_sizeof_returns_int)
    run_test("uos.ilistdir iterable", test_uos_ilistdir_returns_iterable)
    run_test("uselect.poll register/unregister", test_uselect_poll_register_unregister)
    run_test("uzlib.decompress roundtrip", test_uzlib_decompress_roundtrip)
    run_test("uhashlib.sha256 digest length", test_uhashlib_sha256_digest_length)
    run_test("gc.collect / enable / disable", test_gc_collect_does_not_crash)

    # New module surface + version sentinel
    run_test("micropython.version sentinel", test_micropython_version_sentinel)
    run_test(
        "meta.mock_matches_micropython_baseline",
        test_mock_matches_pinned_micropython_baseline,
    )
    run_test("framebuf surface", test_framebuf_module_surface)
    run_test("deflate.DeflateIO round-trip", test_deflate_round_trip_via_deflateio)
    run_test("vfs.mount/umount", test_vfs_mount_umount_tracks_state)
    run_test("errno constants", test_errno_constants_present)
    run_test("platform mock", test_platform_surface_minimal)
    run_test("asyncio surface", test_asyncio_module_surface)
    run_test("micropython.RingIO", test_micropython_ringio_round_trip)
    run_test("machine.Signal invert", test_machine_signal_inverts_pin_level)
    run_test("machine.Pin level IRQ", test_machine_pin_level_irq_constants)
    run_test("network.WLAN.ipconfig", test_network_wlan_ipconfig_round_trip)
    run_test("network.WLAN.config", test_network_wlan_config_round_trip)
    run_test("utime.strftime", test_utime_strftime_formats_tuple)

    # meta: docstring coverage across the whole project
    run_test(
        "meta.google_docstring_coverage",
        test_all_functions_have_google_docstrings,
    )

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print("  Passed: {}".format(_passed))
    print("  Failed: {}".format(_failed))

    if _errors:
        print("\nFailed tests:")
        for name, error in _errors:
            print("  - {}: {}".format(name, error))

    print("=" * 60)

    if _failed > 0:
        sys.exit(1)
