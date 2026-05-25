"""MicroPython ``asyncio`` (uasyncio v3) module emulator.

Wraps CPython's :mod:`asyncio` and adds MicroPython-specific surface such as
``sleep_ms`` and ``ThreadSafeFlag``. Targets MicroPython v1.23.0 API.

See: https://docs.micropython.org/en/latest/library/asyncio.html
"""
from __future__ import annotations

# The mock loads under sys.modules['asyncio'], shadowing the real CPython
# asyncio. The runner pre-stashes the real module under '_real_asyncio'
# precisely so we can pull the canonical implementation here.
import _real_asyncio as _asyncio

# Re-export everything CPython's asyncio exposes so internal cross-imports
# (e.g. `from asyncio import DefaultEventLoopPolicy` inside _LoopBoundMixin)
# resolve against the mock module. The MicroPython-specific additions below
# then override or add to that surface.
from _real_asyncio import *  # noqa: F401,F403

from typing import Any, Optional

import state

run = _asyncio.run
create_task = _asyncio.create_task
sleep = _asyncio.sleep
wait_for = _asyncio.wait_for
gather = _asyncio.gather
current_task = _asyncio.current_task
get_event_loop = _asyncio.get_event_loop
open_connection = _asyncio.open_connection
start_server = _asyncio.start_server

Event = _asyncio.Event
Lock = _asyncio.Lock
Queue = _asyncio.Queue
StreamReader = _asyncio.StreamReader
StreamWriter = _asyncio.StreamWriter
CancelledError = _asyncio.CancelledError


async def sleep_ms(ms: int) -> None:
    """Sleep for the given number of milliseconds.

    MicroPython-specific helper that simply forwards to :func:`asyncio.sleep`
    after converting milliseconds to seconds.

    Args:
        ms: Number of milliseconds to sleep.
    """
    await _asyncio.sleep(max(0, ms) / 1000.0)


class ThreadSafeFlag:
    """MicroPython's ``asyncio.ThreadSafeFlag`` primitive.

    A one-shot event that can be set from any thread (including an ISR on
    real hardware) and awaited from a coroutine. ``wait()`` clears the flag
    on return, matching the MicroPython contract.
    """

    def __init__(self) -> None:
        """Create a new flag in the cleared state."""
        self._event = _asyncio.Event()

    def set(self) -> None:
        """Set the flag and wake any awaiter.

        Safe to call from synchronous code; in the emulator there is no ISR
        context to worry about.
        """
        self._event.set()
        state.emit_event("asyncio_flag", {"action": "set"})

    def clear(self) -> None:
        """Reset the flag to the unset state.

        MicroPython itself does not expose ``clear()`` publicly, but several
        community ports do; including it keeps the mock useful for tests.
        """
        self._event.clear()
        state.emit_event("asyncio_flag", {"action": "clear"})

    async def wait(self) -> None:
        """Wait until the flag is set, then clear it before returning."""
        state.emit_event("asyncio_flag", {"action": "wait"})
        await self._event.wait()
        self._event.clear()


__all__ = [
    "run",
    "create_task",
    "sleep",
    "sleep_ms",
    "wait_for",
    "gather",
    "current_task",
    "get_event_loop",
    "open_connection",
    "start_server",
    "Event",
    "Lock",
    "Queue",
    "StreamReader",
    "StreamWriter",
    "CancelledError",
    "ThreadSafeFlag",
]
