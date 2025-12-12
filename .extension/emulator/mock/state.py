"""Global state management for MicroPython emulator."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, List, Optional

EventCallback = Callable[[Dict[str, Any]], None]


@dataclass
class PinState:
    identifier: str
    mode: str
    value: int


_reporters: List[EventCallback] = []
_pins: Dict[str, PinState] = {}
_adc_values: Dict[str, int] = {}
_i2c_devices: Dict[int, List[int]] = {}  # bus_id -> list of addresses
_i2c_responses: Dict[str, bytes] = {}  # "bus_addr_memaddr" -> response bytes
_i2c_auto_respond: bool = True  # Auto-respond with device-present data


def set_reporter(callback: EventCallback) -> None:
    """Register a callback to receive state change events."""
    if callback not in _reporters:
        _reporters.append(callback)


def clear_reporters() -> None:
    """Remove all registered reporters."""
    _reporters.clear()


def reset() -> None:
    """Reset all state."""
    global _i2c_auto_respond
    _pins.clear()
    _adc_values.clear()
    _i2c_devices.clear()
    _i2c_responses.clear()
    _i2c_auto_respond = True
    _emit({"type": "reset"})


def register_pin(identifier: str, mode: str, initial: Optional[int] = None) -> None:
    """Register a pin in the state table."""
    value = 1 if initial else 0
    _pins[identifier] = PinState(identifier=identifier, mode=mode, value=value)
    _emit({
        "type": "pin_register",
        "pin": identifier,
        "mode": mode,
        "value": value,
    })


def update_pin(identifier: str, value: int, mode: Optional[str] = None) -> None:
    """Update pin value and optionally mode."""
    state = _pins.get(identifier)
    if state is None:
        state = PinState(identifier=identifier, mode=mode or "OUT", value=value)
        _pins[identifier] = state
    else:
        if mode is not None:
            state.mode = mode
        state.value = value

    event = {"type": "pin_update", "pin": identifier, "value": value}
    if mode is not None:
        event["mode"] = mode
    _emit(event)


def get_pin_value(identifier: str) -> int:
    state = _pins.get(identifier)
    return state.value if state else 0


def snapshot() -> List[Dict[str, Any]]:
    """Return a snapshot of all pins."""
    return [asdict(pin) for pin in _pins.values()]


# ADC Support

def get_adc_value(pin_id: str) -> Optional[int]:
    """Get a simulated ADC value for a pin."""
    return _adc_values.get(pin_id)


def set_adc_value(pin_id: str, value: int) -> None:
    """Set a simulated ADC value (from webview or test)."""
    _adc_values[pin_id] = max(0, min(65535, value))
    _emit({"type": "adc_set", "pin": pin_id, "value": _adc_values[pin_id]})


def clear_adc_value(pin_id: str) -> None:
    """Clear a simulated ADC value (revert to random)."""
    if pin_id in _adc_values:
        del _adc_values[pin_id]


# I2C Support

def get_i2c_devices(bus_id: int) -> List[int]:
    """Get list of I2C device addresses on a bus.
    
    If no devices are configured but auto-respond is enabled,
    returns common device addresses to prevent infinite scan loops.
    """
    devices = _i2c_devices.get(bus_id, [])
    if not devices and _i2c_auto_respond:
        # Return common I2C device addresses when auto-respond is enabled
        # This prevents infinite loops in code like `while not i2c.scan(): pass`
        devices = [0x68, 0x3C, 0x76, 0x27]  # MPU6050, SSD1306, BME280, LCD
    return devices


def set_i2c_devices(bus_id: int, addresses: List[int]) -> None:
    """Configure I2C devices present on a bus."""
    _i2c_devices[bus_id] = addresses
    _emit({"type": "i2c_devices_set", "bus": bus_id, "addresses": addresses})


def register_i2c_device(bus_id: int, addr: int) -> None:
    """Register a single I2C device address on a bus."""
    if bus_id not in _i2c_devices:
        _i2c_devices[bus_id] = []
    if addr not in _i2c_devices[bus_id]:
        _i2c_devices[bus_id].append(addr)
    _emit({"type": "i2c_device_registered", "bus": bus_id, "addr": addr})


def set_i2c_auto_respond(enabled: bool) -> None:
    """Enable/disable automatic I2C device responses.
    
    When enabled, I2C operations return valid data even without 
    explicit configuration, preventing infinite loops.
    """
    global _i2c_auto_respond
    _i2c_auto_respond = enabled
    _emit({"type": "i2c_auto_respond", "enabled": enabled})


def get_i2c_response(
    bus_id: int,
    addr: int,
    nbytes: int,
    memaddr: Optional[int] = None,
) -> bytes:
    """Get configured I2C response data.
    
    If no response is configured and auto-respond is enabled,
    returns sensible defaults:
    - First byte is always non-zero (device present)
    - WHO_AM_I style registers return address
    - Other registers return 0x00
    """
    key = f"{bus_id}_{addr}_{memaddr}" if memaddr is not None else f"{bus_id}_{addr}"
    response = _i2c_responses.get(key)
    
    if response is None and _i2c_auto_respond:
        # Generate sensible auto-response data
        if memaddr == 0x75 or memaddr == 0x00:  # Common WHO_AM_I registers
            # Return device address as identification
            response = bytes([addr]) + b'\x00' * (nbytes - 1)
        elif memaddr is not None:
            # For memory reads, return non-zero first byte to indicate presence
            response = bytes([0x01]) + b'\x00' * (nbytes - 1)
        else:
            # For direct reads, return ACK-style response (non-zero first byte)
            response = bytes([0x01]) + b'\x00' * (nbytes - 1)
    elif response is None:
        # No response configured and auto-respond disabled
        response = b'\x00' * nbytes
    
    # Return exactly nbytes, padding or truncating as needed
    if len(response) < nbytes:
        response = response + b'\x00' * (nbytes - len(response))
    return response[:nbytes]


def set_i2c_response(
    bus_id: int,
    addr: int,
    data: bytes,
    memaddr: Optional[int] = None,
) -> None:
    """Configure I2C response data for a device."""
    key = f"{bus_id}_{addr}_{memaddr}" if memaddr is not None else f"{bus_id}_{addr}"
    _i2c_responses[key] = data
    _emit({
        "type": "i2c_response_set",
        "bus": bus_id,
        "addr": addr,
        "memaddr": memaddr,
        "data": data.hex(),
    })


# Generic event emission

def emit_event(event_type: str, data: Dict[str, Any]) -> None:
    """Emit a generic event with type and data."""
    event = {"type": event_type, **data}
    _emit(event)


def _emit(event: Dict[str, Any]) -> None:
    for reporter in list(_reporters):
        try:
            reporter(event)
        except Exception:
            # Ignore reporter errors to avoid breaking emulator
            continue
