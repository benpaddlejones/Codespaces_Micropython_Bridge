"""Type stubs for MicroPython rp2 module (RP2040/Pico specific)."""
from typing import Any, Callable, Optional, Union
from machine import Pin

def bootsel_button() -> int:
    """Return the state of the BOOTSEL button (0 or 1)."""
    ...

def country(code: Optional[str] = ...) -> str:
    """Get or set the two-letter country code for wireless."""
    ...

class Flash:
    """Access to flash memory."""
    
    def __init__(self) -> None: ...
    def readblocks(self, block_num: int, buf: bytearray, offset: int = ...) -> None: ...
    def writeblocks(self, block_num: int, buf: bytes, offset: int = ...) -> None: ...
    def ioctl(self, op: int, arg: int = ...) -> Optional[int]: ...

class PIO:
    """Programmable I/O (PIO) state machine manager."""
    
    IN_LOW: int
    IN_HIGH: int
    OUT_LOW: int
    OUT_HIGH: int
    SHIFT_LEFT: int
    SHIFT_RIGHT: int
    IRQ_SM0: int
    IRQ_SM1: int
    IRQ_SM2: int
    IRQ_SM3: int
    JOIN_NONE: int
    JOIN_TX: int
    JOIN_RX: int
    
    def __init__(self, id: int) -> None: ...
    def add_program(self, program: Any) -> int: ...
    def remove_program(self, program: Optional[Any] = ...) -> None: ...
    def state_machine(
        self,
        id: int,
        program: Any = ...,
        freq: int = ...,
        *,
        in_base: Optional[Pin] = ...,
        out_base: Optional[Pin] = ...,
        set_base: Optional[Pin] = ...,
        jmp_pin: Optional[Pin] = ...,
        sideset_base: Optional[Pin] = ...,
        in_shiftdir: int = ...,
        out_shiftdir: int = ...,
        push_thresh: int = ...,
        pull_thresh: int = ...,
    ) -> "StateMachine": ...
    def irq(
        self, handler: Optional[Callable[[Any], None]] = ..., trigger: int = ..., hard: bool = ...
    ) -> Any: ...

class StateMachine:
    """PIO State Machine."""
    
    def __init__(
        self,
        id: int,
        program: Any = ...,
        freq: int = ...,
        *,
        in_base: Optional[Pin] = ...,
        out_base: Optional[Pin] = ...,
        set_base: Optional[Pin] = ...,
        jmp_pin: Optional[Pin] = ...,
        sideset_base: Optional[Pin] = ...,
        in_shiftdir: int = ...,
        out_shiftdir: int = ...,
        push_thresh: int = ...,
        pull_thresh: int = ...,
    ) -> None: ...
    def init(
        self,
        program: Any = ...,
        freq: int = ...,
        *,
        in_base: Optional[Pin] = ...,
        out_base: Optional[Pin] = ...,
        set_base: Optional[Pin] = ...,
        jmp_pin: Optional[Pin] = ...,
        sideset_base: Optional[Pin] = ...,
        in_shiftdir: int = ...,
        out_shiftdir: int = ...,
        push_thresh: int = ...,
        pull_thresh: int = ...,
    ) -> None: ...
    def active(self, value: Optional[int] = ...) -> int: ...
    def restart(self) -> None: ...
    def exec(self, instr: int) -> None: ...
    def get(self, buf: Optional[bytearray] = ..., shift: int = ...) -> int: ...
    def put(self, value: int, shift: int = ...) -> None: ...
    def rx_fifo(self) -> int: ...
    def tx_fifo(self) -> int: ...
    def irq(
        self, handler: Optional[Callable[[Any], None]] = ..., trigger: int = ..., hard: bool = ...
    ) -> Any: ...

def asm_pio(
    *,
    out_init: Union[int, tuple[int, ...], None] = ...,
    set_init: Union[int, tuple[int, ...], None] = ...,
    sideset_init: Union[int, tuple[int, ...], None] = ...,
    in_shiftdir: int = ...,
    out_shiftdir: int = ...,
    autopush: bool = ...,
    autopull: bool = ...,
    push_thresh: int = ...,
    pull_thresh: int = ...,
    fifo_join: int = ...,
) -> Callable[[Callable[..., None]], Any]:
    """Decorator for PIO assembly programs."""
    ...

class DMA:
    """Direct Memory Access controller."""
    
    def __init__(self) -> None: ...
    def config(
        self,
        *,
        read: Optional[int] = ...,
        write: Optional[int] = ...,
        count: Optional[int] = ...,
        ctrl: Optional[int] = ...,
        trigger: bool = ...,
    ) -> None: ...
    def active(self, value: Optional[bool] = ...) -> bool: ...
    def irq(
        self, handler: Optional[Callable[[Any], None]] = ..., hard: bool = ...
    ) -> Any: ...
    def close(self) -> None: ...
