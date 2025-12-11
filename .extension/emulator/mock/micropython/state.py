"""Emulator state manager - emits events to VS Code webview via stdout."""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional

# Event prefix that the VS Code extension looks for
EVENT_PREFIX = "__EMU__"

# Global state tracking
_pin_values: Dict[str, int] = {}
_pin_modes: Dict[str, str] = {}


def emit_event(event_type: str, data: Dict[str, Any]) -> None:
    """Emit an event to the VS Code extension via stdout."""
    event = {"type": event_type, **data}
    # Print with prefix so extension can parse it
    print(f"{EVENT_PREFIX}{json.dumps(event)}", flush=True)


def register_pin(pin_id: str, mode: str, value: int = 0) -> None:
    """Register a pin with initial state."""
    _pin_values[pin_id] = value
    _pin_modes[pin_id] = mode
    emit_event("pin_register", {"pin": pin_id, "mode": mode, "value": value})


def update_pin(pin_id: str, value: int, mode: str = "digital") -> None:
    """Update pin state and emit event."""
    _pin_values[pin_id] = value
    emit_event("pin_update", {"pin": pin_id, "value": value, "mode": mode})


def get_pin_value(pin_id: str) -> int:
    """Get current pin value."""
    return _pin_values.get(pin_id, 0)


def emit_pwm_update(pin_id: str, freq: int, duty: int) -> None:
    """Emit PWM update event."""
    emit_event("pwm_update", {"pin": pin_id, "freq": freq, "duty": duty})


def emit_i2c_write(addr: int, data: bytes, memaddr: Optional[int] = None) -> None:
    """Emit I2C write event."""
    event_data = {
        "addr": addr,
        "data": list(data),
    }
    if memaddr is not None:
        event_data["memaddr"] = memaddr
    emit_event("i2c_write", event_data)


def emit_i2c_read(addr: int, data: bytes, memaddr: Optional[int] = None) -> None:
    """Emit I2C read event."""
    event_data = {
        "addr": addr,
        "data": list(data),
    }
    if memaddr is not None:
        event_data["memaddr"] = memaddr
    emit_event("i2c_read", event_data)


def emit_spi_write(data: bytes) -> None:
    """Emit SPI write event."""
    emit_event("spi_write", {"data": list(data)})


def emit_adc_read(pin_id: str, value: int) -> None:
    """Emit ADC read event."""
    emit_event("adc_read", {"pin": pin_id, "value": value})


def emit_neopixel_init(pin_id: str, count: int) -> None:
    """Emit NeoPixel initialization event."""
    emit_event("neopixel_init", {"pin": pin_id, "n": count})


def emit_neopixel_write(pixels: list) -> None:
    """Emit NeoPixel write event with pixel colors."""
    emit_event("neopixel_write", {"pixels": pixels})


def emit_exception(message: str, traceback: str = "") -> None:
    """Emit exception event."""
    emit_event("exception", {"message": message, "traceback": traceback})


def emit_complete() -> None:
    """Emit script completion event."""
    emit_event("complete", {})


def emit_start(script: str, board: str = "pico") -> None:
    """Emit script start event."""
    emit_event("start", {"script": script, "board": board})
