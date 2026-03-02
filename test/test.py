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

    # context module
    run_test("context.get_error_location", test_get_error_location)
    run_test("context.print_code_context", test_print_code_context_no_crash)
    run_test("context.print_code_context (override)", test_print_code_context_override)
    run_test("context.print_code_context (None line)", test_print_code_context_none_line)

    # files module
    run_test("files.list_directory (valid)", test_list_directory_valid)
    run_test("files.list_directory (invalid)", test_list_directory_invalid)
    run_test("files.print_available_files", test_print_available_files_no_crash)

    # logging module
    run_test("logging.open_log_file", test_open_log_file)
    run_test("logging.log_exception", test_log_exception)

    # handler module
    run_test("handler.handle_exception", test_handle_exception_no_crash)
    run_test("handler.handle_exception (SyntaxError)", test_handle_exception_syntax_error)

    # launcher __init__
    run_test("launcher.run exists", test_run_function_exists)
    run_test("launcher exports", test_exports)

    # config module
    run_test("config values", test_config_values)

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
