"""Type stubs for MicroPython random module."""
from typing import Optional, Sequence, TypeVar

T = TypeVar("T")

def seed(n: Optional[int] = ...) -> None:
    """Initialize the random number generator."""
    ...

def getrandbits(k: int) -> int:
    """Generate an integer with k random bits."""
    ...

def randrange(start: int, stop: Optional[int] = ..., step: int = ...) -> int:
    """Return a random integer from range."""
    ...

def randint(a: int, b: int) -> int:
    """Return a random integer N such that a <= N <= b."""
    ...

def choice(seq: Sequence[T]) -> T:
    """Return a random element from non-empty sequence."""
    ...

def random() -> float:
    """Return a random float in the range [0.0, 1.0)."""
    ...

def uniform(a: float, b: float) -> float:
    """Return a random float N such that a <= N <= b."""
    ...

def shuffle(seq: list[T]) -> None:
    """Shuffle sequence in place."""
    ...
