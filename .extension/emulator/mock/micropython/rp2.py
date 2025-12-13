"""MicroPython `rp2` module emulator for RP2040-specific features.

This module provides mock implementations of RP2040/Pico-specific
functionality including PIO (Programmable I/O) and state machines.

Compatible with: MicroPython v1.20+ (RP2040/Raspberry Pi Pico)
Last API audit: December 2025

See: https://docs.micropython.org/en/latest/library/rp2.html
"""

import state

# PIO state machine constants
PIO0_BASE = 0x50200000
PIO1_BASE = 0x50300000


class PIOASMEmit:
    """Mock PIO assembler."""
    pass


class StateMachine:
    """Mock PIO state machine."""
    
    def __init__(self, id: int, prog, freq: int = -1, **kwargs):
        """
        Initialize a PIO state machine.
        
        Args:
            id: State machine ID (0-7)
            prog: PIO program (assembled)
            freq: Frequency in Hz
        """
        self.id = id
        self.prog = prog
        self.freq = freq
        self.kwargs = kwargs
        self._active = False
        state.emit_event("pio_sm_init", {"id": id, "freq": freq})
    
    def active(self, value: int = None):
        """Activate or deactivate the state machine."""
        if value is not None:
            self._active = bool(value)
            state.emit_event("pio_sm_active", {"id": self.id, "active": self._active})
        return int(self._active)
    
    def restart(self):
        """Restart the state machine."""
        state.emit_event("pio_sm_restart", {"id": self.id})
    
    def exec(self, instr):
        """Execute a single PIO instruction."""
        state.emit_event("pio_sm_exec", {"id": self.id, "instr": instr})
    
    def get(self, buf=None, shift: int = 0):
        """Get data from the TX FIFO."""
        return 0
    
    def put(self, value, shift: int = 0):
        """Put data into the RX FIFO."""
        state.emit_event("pio_sm_put", {"id": self.id, "value": value})
    
    def tx_fifo(self) -> int:
        """Get the number of words in the TX FIFO."""
        return 0
    
    def rx_fifo(self) -> int:
        """Get the number of words in the RX FIFO."""
        return 0
    
    def irq(self, handler=None, trigger: int = 0, hard: bool = False):
        """Set up IRQ handler for the state machine."""
        pass


class PIO:
    """Mock PIO peripheral."""
    
    IN_LOW = 0
    IN_HIGH = 1
    OUT_LOW = 0
    OUT_HIGH = 1
    SHIFT_LEFT = 0
    SHIFT_RIGHT = 1
    IRQ_SM0 = 0x100
    IRQ_SM1 = 0x200
    IRQ_SM2 = 0x400
    IRQ_SM3 = 0x800
    
    def __init__(self, id: int):
        self.id = id
        state.emit_event("pio_init", {"id": id})
    
    def state_machine(self, id: int, prog=None, **kwargs):
        """Get or create a state machine."""
        return StateMachine(self.id * 4 + id, prog, **kwargs)
    
    def irq(self, handler=None, trigger: int = 0, hard: bool = False):
        """Set up IRQ handler for the PIO."""
        pass
    
    def remove_program(self, prog=None):
        """Remove a program from the PIO."""
        pass


# PIO assembly decorator
def asm_pio(**kwargs):
    """Decorator for PIO assembly programs."""
    def decorator(func):
        # In mock, just return a placeholder
        return []
    return decorator


# Flash storage
class Flash:
    """Mock internal flash storage."""
    
    def __init__(self):
        self._data = bytearray(2 * 1024 * 1024)  # 2MB mock flash
    
    def readblocks(self, block_num: int, buf, offset: int = 0):
        """Read blocks from flash."""
        start = block_num * 4096 + offset
        buf[:] = self._data[start:start + len(buf)]
    
    def writeblocks(self, block_num: int, buf, offset: int = 0):
        """Write blocks to flash."""
        start = block_num * 4096 + offset
        self._data[start:start + len(buf)] = buf
    
    def ioctl(self, op: int, arg: int = 0):
        """Control operations."""
        if op == 4:  # Block count
            return len(self._data) // 4096
        if op == 5:  # Block size
            return 4096
        return 0


# DMA (mock)
class DMA:
    """Mock DMA controller."""
    
    def __init__(self):
        pass


# Helper to get unique ID
def bootsel_button() -> int:
    """Check if BOOTSEL button is pressed (always False in mock)."""
    return 0
