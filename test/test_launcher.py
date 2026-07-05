"""
Extensive tests for the launcher error harness
(.extension/project/lib/launcher - the canonical copy).

The launcher's purpose is to turn MicroPython's vague errors into accurate,
helpful reports for students. These tests validate:

1. Every exception type routes to the right handler with its own guidance.
2. The output is student-first: real message leads, then location, code
   context, guidance, filtered traceback, readable timestamp.
3. Locations are accurate and never fabricated (errno != line number).
4. The code context window highlights the right line.
5. Vague OSError codes are translated to plain English.
6. The crash mailbox (error_log.txt) captures unattended boot crashes,
   replays them on the next run, and re-arms itself.
7. The three launcher copies in the repo stay in sync.
"""

import os

import pytest

from conftest import LAUNCHER_LIB, REPO_ROOT


def run_and_capture(env, capsys, code):
    """Write the student script, run the launcher, return captured stdout."""
    env.write_script(code)
    env.run()
    return capsys.readouterr().out


# =============================================================================
# 1. Error routing: each exception type gets its own title and guidance
# =============================================================================

ERROR_CASES = [
    # (student code, expected title, fragment of the real error message)
    ("import not_a_real_module", "IMPORT ERROR", "not_a_real_module"),
    ("print(led)", "NAME ERROR", "led"),
    ("x = (\n", "SYNTAX ERROR", None),
    ("'abc'.fly()", "ATTRIBUTE ERROR", "fly"),
    ("[1, 2, 3][10]", "INDEX ERROR", "out of range"),
    ("{'a': 1}['missing']", "KEY ERROR", "missing"),
    ("print(1 / 0)", "ZERO DIVISION ERROR", "division"),
    ("print(1 + 'a')", "TYPE ERROR", None),
    ("int('abc')", "VALUE ERROR", "abc"),
    ("raise MemoryError('allocation failed')", "MEMORY ERROR", None),
    ("raise OSError(5)", "OS ERROR", None),
    ("raise RuntimeError('motor jammed')", "RUNTIME ERROR", "motor jammed"),
    ("raise Exception('mystery failure')", "UNEXPECTED ERROR", "mystery failure"),
]


class TestErrorRouting:
    @pytest.mark.parametrize(
        "code,title,fragment", ERROR_CASES, ids=[c[1] for c in ERROR_CASES]
    )
    def test_title_leads_output(self, make_env, capsys, code, title, fragment):
        env = make_env()
        out = run_and_capture(env, capsys, code)
        first_line = out.splitlines()[0]
        assert first_line.startswith(title), (
            "The error title must be the first thing a student reads, got: "
            + first_line
        )

    @pytest.mark.parametrize(
        "code,title,fragment",
        [c for c in ERROR_CASES if c[2]],
        ids=[c[1] for c in ERROR_CASES if c[2]],
    )
    def test_real_error_message_is_prominent(
        self, make_env, capsys, code, title, fragment
    ):
        env = make_env()
        out = run_and_capture(env, capsys, code)
        first_line = out.splitlines()[0]
        assert fragment in first_line, (
            "MicroPython's own message (the most specific clue) must be on "
            "the first line, not buried in the traceback"
        )

    @pytest.mark.parametrize(
        "code,title,fragment", ERROR_CASES, ids=[c[1] for c in ERROR_CASES]
    )
    def test_every_error_has_a_next_step(self, make_env, capsys, code, title, fragment):
        env = make_env()
        out = run_and_capture(env, capsys, code)
        assert "Next step:" in out, "Students always need an actionable next step"

    def test_keyboard_interrupt_is_calm(self, env, capsys):
        out = run_and_capture(env, capsys, "raise KeyboardInterrupt('stop')")
        assert "KEYBOARD INTERRUPT" in out
        assert "Traceback" not in out, "Stopping a program is not an error"

    def test_unexpected_error_guidance_addresses_student(self, env, capsys):
        out = run_and_capture(env, capsys, "raise Exception('odd')")
        assert "needs its own handler" not in out, (
            "Guidance must talk to the student, not the launcher maintainer"
        )


# =============================================================================
# 2. Output structure: concrete first, advice second
# =============================================================================


class TestOutputStructure:
    def test_section_ordering(self, env, capsys):
        out = run_and_capture(env, capsys, "x = 1\ny = 2\nprint(led)\n")
        positions = [
            out.index("NAME ERROR:"),
            out.index("Location:"),
            out.index("--- Code Context"),
            out.index("Next step:"),
            out.index("--- Traceback ---"),
            out.index("Timestamp:"),
        ]
        assert positions == sorted(positions), (
            "Expected order: message, location, context, guidance, "
            "traceback, timestamp"
        )

    def test_timestamp_is_human_readable(self, env, capsys):
        out = run_and_capture(env, capsys, "print(led)")
        assert "Timestamp: 2026-07-05 02:30:15" in out

    def test_timestamp_without_rtc(self, make_env, capsys):
        env = make_env(localtime=False)
        out = run_and_capture(env, capsys, "print(led)")
        assert "Timestamp: UNKNOWN-TIME" in out
        assert "Timestamp: (" not in out, "Never show a raw time tuple"

    def test_traceback_hides_launcher_plumbing(self, env, capsys):
        out = run_and_capture(env, capsys, "print(led)")
        trace_section = out.split("--- Traceback ---", 1)[1]
        assert "lib/launcher" not in trace_section, (
            "Students should read their own call chain, not launcher internals"
        )
        assert "v01.py" in trace_section

    def test_import_error_lists_available_files(self, env, capsys):
        env.write_script("print('helper')", name="my_helper")
        out = run_and_capture(env, capsys, "import not_a_real_module")
        assert "--- Available Files ---" in out
        assert "my_helper.py" in out, (
            "Listing real files helps students spot typos in module names"
        )

    def test_import_guidance_has_no_stale_line_reference(self, env, capsys):
        out = run_and_capture(env, capsys, "import not_a_real_module")
        assert "line 7" not in out
        assert "config.py" in out


# =============================================================================
# 3. Location accuracy
# =============================================================================


class TestLocationAccuracy:
    def test_name_error_location(self, env, capsys):
        out = run_and_capture(env, capsys, "x = 1\ny = 2\nprint(led)\n")
        assert "v01.py:3" in out

    def test_syntax_error_location(self, env, capsys):
        out = run_and_capture(env, capsys, "x = 1\ndef broken(\n")
        loc_line = [l for l in out.splitlines() if l.startswith("Location:")][0]
        assert "v01.py" in loc_line

    def test_error_inside_helper_module(self, env, capsys):
        env.write_script("def explode():\n    return 1 / 0\n", name="helper")
        out = run_and_capture(env, capsys, "import helper\nhelper.explode()\n")
        assert "helper.py:2" in out, "Location must point into the helper module"

    def test_errno_is_not_reported_as_line_number(self, env, capsys):
        out = run_and_capture(env, capsys, "raise OSError(5)")
        loc_lines = [l for l in out.splitlines() if l.startswith("Location:")]
        for line in loc_lines:
            assert not line.endswith(":5") or "v01.py" in line, (
                "OSError(5)'s errno must never be shown as 'line 5'"
            )

    def test_parse_location_ignores_oserror_int_args(self, env):
        try:
            raise OSError(5)
        except OSError as e:
            e.__traceback__ = None
            assert self._parse(env, e) == (None, None)

    def test_parse_location_still_reads_int_for_other_errors(self, env):
        err = ValueError(42)
        assert self._parse(env, err) == (None, 42)

    @staticmethod
    def _parse(env, err):
        return env.tb.parse_location_from_args(err)


# =============================================================================
# 4. Code context display
# =============================================================================


class TestCodeContext:
    def test_error_line_is_marked(self, env, capsys):
        out = run_and_capture(env, capsys, "x = 1\ny = 2\nprint(led)\nz = 4\n")
        assert ">> 003: print(led)" in out
        assert "   002: y = 2" in out

    def test_context_window_respects_radius(self, env, capsys):
        code = "\n".join("x{} = {}".format(i, i) for i in range(1, 10)) + "\nprint(led)\n"
        out = run_and_capture(env, capsys, code)
        # Error on line 10 with radius 2: lines 8-10 visible, line 5 not.
        assert ">> 010: print(led)" in out
        assert "008:" in out
        assert "005:" not in out.split("--- Code Context", 1)[1].split("---", 1)[0]

    def test_unreadable_file_is_explained(self, env, capsys):
        try:
            exec(compile("print(led)", "/nonexistent/ghost.py", "exec"), {})
        except NameError as e:
            env.handler.handle_exception("NAME ERROR", e)
        out = capsys.readouterr().out
        assert "--- Code Context" in out
        assert "Unable to open" in out or "Showing context from" in out


# =============================================================================
# 5. Errno translation (the vaguest MicroPython errors)
# =============================================================================


class TestErrnoTranslation:
    @pytest.mark.parametrize(
        "errno,name,fragment",
        [
            (2, "ENOENT", "not found"),
            (5, "EIO", "wiring"),
            (19, "ENODEV", "hardware device"),
            (22, "EINVAL", "pin numbers"),
            (110, "ETIMEDOUT", "timed out"),
        ],
    )
    def test_common_errnos_are_translated(self, make_env, capsys, errno, name, fragment):
        env = make_env()
        out = run_and_capture(env, capsys, "raise OSError({})".format(errno))
        assert "Errno {} ({})".format(errno, name) in out
        assert fragment in out

    def test_unknown_errno_has_no_hint(self, env):
        assert env.errors.get_errno_hint(OSError(9999)) is None

    def test_non_oserror_has_no_hint(self, env):
        assert env.errors.get_errno_hint(ValueError(5)) is None

    def test_oserror_with_string_arg_has_no_hint(self, env):
        assert env.errors.get_errno_hint(OSError("custom message")) is None


# =============================================================================
# 6. Traceback filtering (unit level)
# =============================================================================

RAW_TRACE = (
    "Traceback (most recent call last):\n"
    '  File "main.py", line 18, in <module>\n'
    '  File "lib/launcher/__init__.py", line 52, in run\n'
    '  File "/py_scripts/v01.py", line 3, in <module>\n'
    "NameError: name 'led' isn't defined\n"
)


class TestTracebackFiltering:
    def test_launcher_and_main_frames_removed(self, env):
        filtered = env.tb.filter_launcher_frames(RAW_TRACE)
        assert 'File "main.py"' not in filtered
        assert "lib/launcher" not in filtered
        assert "v01.py" in filtered
        assert "NameError" in filtered

    def test_header_and_trailing_newline_preserved(self, env):
        filtered = env.tb.filter_launcher_frames(RAW_TRACE)
        assert filtered.startswith("Traceback (most recent call last):")
        assert filtered.endswith("\n")

    def test_all_launcher_trace_returned_unchanged(self, env):
        raw = (
            "Traceback (most recent call last):\n"
            '  File "main.py", line 18, in <module>\n'
            "ValueError: boom\n"
        )
        assert env.tb.filter_launcher_frames(raw) == raw, (
            "If every frame is launcher plumbing the student still needs "
            "to see something"
        )

    def test_source_echo_lines_of_skipped_frames_removed(self, env):
        raw = (
            "Traceback (most recent call last):\n"
            '  File "lib/launcher/__init__.py", line 52, in run\n'
            "    __import__(config.FILE_NAME)\n"
            '  File "/py_scripts/v01.py", line 3, in <module>\n'
            "    print(led)\n"
            "NameError: name 'led' isn't defined\n"
        )
        filtered = env.tb.filter_launcher_frames(raw)
        assert "__import__" not in filtered
        assert "print(led)" in filtered

    def test_empty_input_is_safe(self, env):
        assert env.tb.filter_launcher_frames("") == ""
        assert env.tb.filter_launcher_frames(None) is None


# =============================================================================
# 7. Crash mailbox (error_log.txt lifecycle)
# =============================================================================


class TestCrashMailbox:
    def test_crash_is_logged(self, env, capsys):
        run_and_capture(env, capsys, "print(led)")
        log = env.read_log()
        assert log
        assert "Type: NAME ERROR" in log
        assert "v01.py:1" in log
        assert "Traceback" in log

    def test_log_keeps_full_unfiltered_traceback(self, env, capsys):
        run_and_capture(env, capsys, "print(led)")
        assert "launcher" in env.read_log(), (
            "The log is for forensics - it should keep the full traceback"
        )

    def test_first_crash_is_preserved_until_read(self, env, capsys):
        env.write_log("==== earlier ====\nType: OS ERROR\n")
        try:
            raise ValueError("later crash")
        except ValueError as e:
            env.handler.handle_exception("VALUE ERROR", e)
        capsys.readouterr()
        assert "OS ERROR" in env.read_log()
        assert "VALUE ERROR" not in env.read_log(), (
            "The unread boot crash must not be overwritten by later errors"
        )

    def test_replay_prints_and_clears(self, env, capsys):
        env.write_log("==== 2026-07-05 ====\nType: NAME ERROR\nSource: v01.py:3\n")
        env.logging.replay_and_clear_log()
        out = capsys.readouterr().out
        assert "A previous run crashed before you connected" in out
        assert "Type: NAME ERROR" in out
        assert "End of previous crash log" in out
        assert env.read_log() == "", "Mailbox must be re-armed after delivery"

    def test_replay_is_silent_with_no_log(self, env, capsys):
        env.logging.replay_and_clear_log()
        assert capsys.readouterr().out == ""

    def test_replay_is_silent_with_empty_log(self, env, capsys):
        env.write_log("")
        env.logging.replay_and_clear_log()
        assert capsys.readouterr().out == ""

    def test_boot_crash_is_replayed_on_next_run(self, env, capsys):
        # Boot run (unattended): crashes and logs.
        run_and_capture(env, capsys, "print(led)")
        assert env.read_log()
        # Student fixes nothing yet, connects, and runs again.
        out = run_and_capture(env, capsys, "print('fixed and working')")
        assert "A previous run crashed before you connected" in out
        assert "Type: NAME ERROR" in out
        assert "fixed and working" in out
        assert env.read_log() == ""

    def test_new_crash_can_be_logged_after_replay(self, env, capsys):
        run_and_capture(env, capsys, "print(led)")  # boot crash -> logged
        run_and_capture(env, capsys, "print('ok')")  # replayed -> cleared
        run_and_capture(env, capsys, "print(1 / 0)")  # new crash
        assert "ZERO DIVISION ERROR" in env.read_log()


# =============================================================================
# 8. Rerun behavior and repo hygiene
# =============================================================================


class TestRerunBehavior:
    def test_rerun_executes_updated_student_code(self, env, capsys):
        out1 = run_and_capture(env, capsys, "print('version one')")
        out2 = run_and_capture(env, capsys, "print('version two')")
        assert "version one" in out1
        assert "version two" in out2, (
            "Reruns must re-import the student's file, not the cached module"
        )


class TestCopiesInSync:
    def test_all_launcher_copies_match_canonical(self):
        canonical = LAUNCHER_LIB + "/launcher"
        mirrors = [
            os.path.join(REPO_ROOT, "lib", "launcher"),
            os.path.join(REPO_ROOT, "project", "lib", "launcher"),
        ]
        canonical_files = sorted(
            f for f in os.listdir(canonical) if f.endswith(".py")
        )
        assert canonical_files, "canonical launcher must contain modules"
        for mirror in mirrors:
            for name in canonical_files:
                with open(os.path.join(canonical, name)) as a, open(
                    os.path.join(mirror, name)
                ) as b:
                    assert a.read() == b.read(), (
                        "{}/{} has drifted from the canonical extension copy - "
                        "edit .extension/project/lib/launcher and re-sync".format(
                            mirror, name
                        )
                    )


# =============================================================================
# 9. Graded student scenarios: realistic programs of increasing complexity.
#
# Every scenario hard-asserts BOTH the reported error type AND the exact
# error line in the feedback (Location line + ">> NNN:" context marker),
# because a wrong-but-confident location is worse for a learner than none.
# =============================================================================


class Scenario:
    def __init__(self, id, files, title, err_file, line, fragment=None, extra=()):
        self.id = id
        self.files = files  # {module_name: source}
        self.title = title
        self.err_file = err_file  # file the error should be attributed to
        self.line = line  # exact line number expected in the feedback
        self.fragment = fragment  # substring of the real error message
        self.extra = extra  # additional strings that must appear in output


SCENARIOS = [
    # ---- Tier 1: single-statement beginner mistakes -------------------------
    Scenario(
        id="t1-name-typo",
        files={
            "v01": "led_pin = 25\n"
            "brightness = 100\n"
            "print(led_pln)\n"
        },
        title="NAME ERROR",
        err_file="v01.py",
        line=3,
        fragment="led_pln",
    ),
    Scenario(
        id="t1-string-plus-int",
        files={"v01": "age = 16\nprint('age: ' + age)\n"},
        title="TYPE ERROR",
        err_file="v01.py",
        line=2,
        fragment="concatenate",
    ),
    Scenario(
        id="t1-divide-by-zero",
        files={
            "v01": "speed = 10\n"
            "time_taken = 0\n"
            "print(speed / time_taken)\n"
        },
        title="ZERO DIVISION ERROR",
        err_file="v01.py",
        line=3,
        fragment="division by zero",
    ),
    # ---- Tier 2: control flow and loops --------------------------------------
    Scenario(
        id="t2-loop-index-off-end",
        files={
            "v01": "readings = [10, 20, 30]\n"
            "total = 0\n"
            "for i in range(5):\n"
            "    total = total + readings[i]\n"
            "print(total)\n"
        },
        title="INDEX ERROR",
        err_file="v01.py",
        line=4,
        fragment="out of range",
    ),
    Scenario(
        id="t2-dict-missing-key",
        files={
            "v01": "pins = {'led': 25, 'button': 4}\n"
            "name = 'buzzer'\n"
            "if name != 'led':\n"
            "    pin = pins[name]\n"
        },
        title="KEY ERROR",
        err_file="v01.py",
        line=4,
        fragment="buzzer",
    ),
    Scenario(
        id="t2-loop-bad-conversion",
        files={
            "v01": "data = ['10', '20', 'abc']\n"
            "total = 0\n"
            "for item in data:\n"
            "    total += int(item)\n"
        },
        title="VALUE ERROR",
        err_file="v01.py",
        line=4,
        fragment="abc",
    ),
    Scenario(
        id="t2-missing-colon",
        files={
            "v01": "count = 0\n"
            "for i in range(3)\n"
            "    count += 1\n"
        },
        title="SYNTAX ERROR",
        err_file="v01.py",
        line=2,
    ),
    Scenario(
        id="t2-missing-indent",
        files={"v01": "def blink():\nprint('blink')\n"},
        title="SYNTAX ERROR",
        err_file="v01.py",
        line=2,
        fragment="indent",
    ),
    # ---- Tier 3: functions and call chains -----------------------------------
    Scenario(
        id="t3-name-error-inside-function",
        files={
            "v01": "def read_sensor():\n"
            "    value = raw_valu * 2\n"
            "    return value\n"
            "\n"
            "reading = read_sensor()\n"
        },
        title="NAME ERROR",
        err_file="v01.py",
        line=2,
        fragment="raw_valu",
    ),
    Scenario(
        id="t3-wrong-argument-count",
        files={
            "v01": "def set_speed(left, right):\n"
            "    return left + right\n"
            "\n"
            "set_speed(50)\n"
        },
        title="TYPE ERROR",
        err_file="v01.py",
        line=4,
        fragment="set_speed",
    ),
    Scenario(
        id="t3-method-call-on-none",
        files={
            "v01": "def find_device(name):\n"
            "    if name == 'motor':\n"
            "        return [1]\n"
            "\n"
            "devices = find_device('servo')\n"
            "devices.append(2)\n"
        },
        title="ATTRIBUTE ERROR",
        err_file="v01.py",
        line=6,
        fragment="append",
    ),
    # ---- Tier 4: classes and multi-file programs ------------------------------
    Scenario(
        id="t4-misspelled-method",
        files={
            "v01": "class Robot:\n"
            "    def forward(self):\n"
            "        return 'moving'\n"
            "\n"
            "bot = Robot()\n"
            "bot.forwards()\n"
        },
        title="ATTRIBUTE ERROR",
        err_file="v01.py",
        line=6,
        fragment="forwards",
    ),
    Scenario(
        id="t4-constructor-validation",
        files={
            "v01": "class Motor:\n"
            "    def __init__(self, pin):\n"
            "        if pin > 28:\n"
            "            raise ValueError('pin {} does not exist on a Pico'"
            ".format(pin))\n"
            "        self.pin = pin\n"
            "\n"
            "m = Motor(99)\n"
        },
        title="VALUE ERROR",
        err_file="v01.py",
        line=4,
        fragment="pin 99",
    ),
    Scenario(
        id="t4-crash-inside-helper-module",
        files={
            "sensor_lib": "def average(values):\n"
            "    return sum(values) / len(values)\n",
            "v01": "import sensor_lib\n"
            "readings = []\n"
            "avg = sensor_lib.average(readings)\n",
        },
        title="ZERO DIVISION ERROR",
        err_file="sensor_lib.py",
        line=2,
        fragment="division",
        extra=("v01.py",),  # traceback must still show the student's call site
    ),
    Scenario(
        id="t4-deep-call-chain",
        files={
            "convert_lib": "def read_raw():\n"
            "    return int('not-a-number')\n"
            "\n"
            "def read_percent():\n"
            "    raw = read_raw()\n"
            "    return raw / 655\n",
            "v01": "import convert_lib\n"
            "print(convert_lib.read_percent())\n",
        },
        title="VALUE ERROR",
        err_file="convert_lib.py",
        line=2,
        fragment="not-a-number",
    ),
    # ---- Tier 5: hardware-style failures --------------------------------------
    Scenario(
        id="t5-hardware-oserror",
        files={
            "v01": "def read_temperature():\n"
            "    raise OSError(2)\n"
            "\n"
            "temp = read_temperature()\n"
        },
        title="OS ERROR",
        err_file="v01.py",
        line=2,
        extra=("Errno 2 (ENOENT)",),
    ),
    Scenario(
        id="t5-import-typo",
        files={
            "v01": "# Read the onboard sensor\n"
            "import machin\n"
            "print('ready')\n"
        },
        title="IMPORT ERROR",
        err_file="v01.py",
        line=2,
        fragment="machin",
        extra=("--- Available Files ---",),
    ),
]

SCENARIO_IDS = [s.id for s in SCENARIOS]


def run_scenario(make_env, capsys, scenario):
    env = make_env()
    for name, code in scenario.files.items():
        env.write_script(code, name=name)
    env.run()
    return capsys.readouterr().out


@pytest.mark.parametrize("scenario", SCENARIOS, ids=SCENARIO_IDS)
class TestGradedScenarios:
    def test_error_type_is_reported(self, make_env, capsys, scenario):
        out = run_scenario(make_env, capsys, scenario)
        first_line = out.splitlines()[0]
        assert first_line.startswith(scenario.title), (
            "Expected the feedback to open with '{}', got: {}".format(
                scenario.title, first_line
            )
        )
        if scenario.fragment:
            assert scenario.fragment in first_line, (
                "The real error message ('{}') must be on the first line".format(
                    scenario.fragment
                )
            )

    def test_error_line_is_reported(self, make_env, capsys, scenario):
        out = run_scenario(make_env, capsys, scenario)
        loc_lines = [l for l in out.splitlines() if l.startswith("Location:")]
        assert loc_lines, "Feedback must contain a Location line"
        expected = "{}:{}".format(scenario.err_file, scenario.line)
        assert expected in loc_lines[0], (
            "Expected error attributed to {}, got: {}".format(
                expected, loc_lines[0]
            )
        )

    def test_error_line_is_marked_in_code_context(self, make_env, capsys, scenario):
        out = run_scenario(make_env, capsys, scenario)
        marker = ">> {:03d}:".format(scenario.line)
        assert marker in out, (
            "Code context must highlight line {} with '{}'".format(
                scenario.line, marker
            )
        )

    def test_additional_feedback_is_present(self, make_env, capsys, scenario):
        out = run_scenario(make_env, capsys, scenario)
        assert "Next step:" in out
        for expected in scenario.extra:
            assert expected in out, "Missing expected feedback: " + expected
