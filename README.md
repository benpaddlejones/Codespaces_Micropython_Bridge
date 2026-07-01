# Codespaces ↔ MicroPython Bridge

[![Version](https://img.shields.io/badge/Version-2.3.41-green)](.extension/CHANGELOG.md)
[![MicroPython](https://img.shields.io/badge/MicroPython-1.20%2B-00b2a9?logo=python&logoColor=white)](https://micropython.org/)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-Pico%20Ready-c51a4a?logo=raspberrypi&logoColor=white)](https://www.raspberrypi.com/documentation/microcontrollers/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue)](LICENSE)

Write, test, and flash MicroPython code from a browser — no local toolchain, no USB drivers, and no hardware required to get started. The repo ships a **VS Code extension**, a **Web Serial bridge**, and a **MicroPython emulator** that runs your scripts against mock hardware so you can iterate without a board on your desk.

Target boards: **Raspberry Pi Pico / Pico W / Pico 2 / Pico 2 W**, **ESP32**, **Teensy**, and **BBC micro:bit**.

## What's in the box

| Piece                                        | What it does                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [.extension/](.extension/)                   | The **`pico-bridge` VS Code extension** — commands, status views, launcher for the bridge server.                                                                    |
| [.extension/bridge/](.extension/bridge/)     | Browser-side **Web Serial bridge** that flashes firmware, uploads files, and hosts the REPL.                                                                         |
| [.extension/emulator/](.extension/emulator/) | **MicroPython emulator** — runs your scripts against mock `machine`, `network`, `framebuf`, `asyncio`, etc. so CI and learners can use the project without hardware. |
| [py_scripts/](py_scripts/)                   | Sample scripts and the emulator test harness.                                                                                                                        |
| [emulator-demos/](emulator-demos/)           | Board-specific demos (Pico, Pico W, Pico 2 W, ESP32).                                                                                                                |
| [lib/](lib/)                                 | Reusable on-device MicroPython modules (launcher, error handling, file ops).                                                                                         |

## Quick start

### Option A — try the emulator (no hardware)

```bash
python3 .extension/emulator/mock/runner.py py_scripts/community_examples.py
```

Run the full mock test suite:

```bash
python3 .extension/emulator/mock/runner.py test/test.py
```

Run a `while True` firmware-style demo but stop it cleanly after 50 sleep cycles (handy for CI):

```bash
python3 .extension/emulator/mock/runner.py py_scripts/v01.py --max-ticks 50
# or
EMULATOR_MAX_TICKS=50 python3 .extension/emulator/mock/runner.py py_scripts/v01.py
```

### Option B — flash a real board

1. Install the **Pi Pico to Codespaces Bridge** extension in VS Code (or open this repo as a Codespace — it's pre-configured).
2. `Ctrl+Shift+P → Pico Bridge: Start Server`.
3. The browser tab that opens hosts the REPL, file uploader, and firmware tool. Web Serial → click **Connect** → pick your board.

Full extension docs: [.extension/README.md](.extension/README.md).

## Why an emulator?

Real MicroPython hardware is great, but a learner-friendly workflow needs three things the emulator gives you for free:

- **Run tests in CI.** GitHub Actions can't see your Pico. The emulator can.
- **Catch silly mistakes before flashing.** Most syntax / import / wiring-logic bugs surface immediately under the mock.
- **Teach without a hardware buy-in.** Students can do the first lessons entirely in a Codespace.

The mock surface is pinned to a real MicroPython release (currently **1.23.0**) and verified by [test/test.py](test/test.py), which contains a baseline manifest of every module and symbol that must exist for each supported MicroPython version. CI will flag the mock the moment it drifts from upstream.

## Project status

- **Mock coverage**: `machine`, `network`, `gc`, `micropython`, `utime`/`time`, `uos`/`os`, `usocket`/`socket`, `ujson`, `ure`, `uselect`, `uhashlib`, `ubinascii`, `ustruct`, `uio`, `uzlib`, `ucollections`, `asyncio`, `framebuf`, `deflate`, `vfs`, `errno`, `platform`.
- **Test suite**: 124/124 in [test/test.py](test/test.py), 31/31 in [py_scripts/mock_validation_test.py](py_scripts/mock_validation_test.py).
- **Samples**: every script in [py_scripts/](py_scripts/) and [emulator-demos/](emulator-demos/) runs cleanly under the mock (use `--max-ticks` for the firmware-style infinite loops).

See [.extension/CHANGELOG.md](.extension/CHANGELOG.md) for per-release notes.

## Contributing

```bash
cd .extension
npm install
npm run watch      # TypeScript compile + watch
npm run lint
npm run test
```

Bug reports and PRs welcome on [GitHub Issues](https://github.com/benpaddlejones/Codespaces_Micropython_Bridge/issues).

## License

[GPL-3.0](LICENSE).
