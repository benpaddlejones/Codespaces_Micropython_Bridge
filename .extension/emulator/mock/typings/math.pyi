"""Type stubs for MicroPython math module."""
from typing import Tuple

# Constants
e: float
pi: float
tau: float
inf: float
nan: float

def ceil(x: float) -> int:
    """Return the ceiling of x."""
    ...

def copysign(x: float, y: float) -> float:
    """Return x with the sign of y."""
    ...

def fabs(x: float) -> float:
    """Return absolute value of x."""
    ...

def floor(x: float) -> int:
    """Return the floor of x."""
    ...

def fmod(x: float, y: float) -> float:
    """Return x modulo y."""
    ...

def frexp(x: float) -> Tuple[float, int]:
    """Return mantissa and exponent of x."""
    ...

def ldexp(x: float, exp: int) -> float:
    """Return x * (2**exp)."""
    ...

def modf(x: float) -> Tuple[float, float]:
    """Return fractional and integer parts of x."""
    ...

def trunc(x: float) -> int:
    """Return integer part of x."""
    ...

def isfinite(x: float) -> bool:
    """Return True if x is finite."""
    ...

def isinf(x: float) -> bool:
    """Return True if x is infinite."""
    ...

def isnan(x: float) -> bool:
    """Return True if x is NaN."""
    ...

def exp(x: float) -> float:
    """Return e**x."""
    ...

def expm1(x: float) -> float:
    """Return exp(x) - 1."""
    ...

def log(x: float, base: float = ...) -> float:
    """Return logarithm of x to given base."""
    ...

def log2(x: float) -> float:
    """Return base-2 logarithm of x."""
    ...

def log10(x: float) -> float:
    """Return base-10 logarithm of x."""
    ...

def pow(x: float, y: float) -> float:
    """Return x**y."""
    ...

def sqrt(x: float) -> float:
    """Return square root of x."""
    ...

def cos(x: float) -> float:
    """Return cosine of x (radians)."""
    ...

def sin(x: float) -> float:
    """Return sine of x (radians)."""
    ...

def tan(x: float) -> float:
    """Return tangent of x (radians)."""
    ...

def acos(x: float) -> float:
    """Return arc cosine of x (radians)."""
    ...

def asin(x: float) -> float:
    """Return arc sine of x (radians)."""
    ...

def atan(x: float) -> float:
    """Return arc tangent of x (radians)."""
    ...

def atan2(y: float, x: float) -> float:
    """Return arc tangent of y/x (radians)."""
    ...

def cosh(x: float) -> float:
    """Return hyperbolic cosine of x."""
    ...

def sinh(x: float) -> float:
    """Return hyperbolic sine of x."""
    ...

def tanh(x: float) -> float:
    """Return hyperbolic tangent of x."""
    ...

def acosh(x: float) -> float:
    """Return inverse hyperbolic cosine of x."""
    ...

def asinh(x: float) -> float:
    """Return inverse hyperbolic sine of x."""
    ...

def atanh(x: float) -> float:
    """Return inverse hyperbolic tangent of x."""
    ...

def degrees(x: float) -> float:
    """Convert radians to degrees."""
    ...

def radians(x: float) -> float:
    """Convert degrees to radians."""
    ...

def erf(x: float) -> float:
    """Return error function at x."""
    ...

def erfc(x: float) -> float:
    """Return complementary error function at x."""
    ...

def gamma(x: float) -> float:
    """Return gamma function at x."""
    ...

def lgamma(x: float) -> float:
    """Return natural log of gamma function at x."""
    ...

def factorial(x: int) -> int:
    """Return x factorial."""
    ...

def gcd(a: int, b: int) -> int:
    """Return greatest common divisor."""
    ...
