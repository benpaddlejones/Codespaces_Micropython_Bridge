"""MicroPython `uos` module emulator - wraps standard Python os."""
from os import *

# MicroPython-specific functions that map to os equivalents
def ilistdir(path="."):
    """Iterate over directory entries (MicroPython-style)."""
    import os
    for name in os.listdir(path):
        full_path = os.path.join(path, name)
        if os.path.isdir(full_path):
            yield (name, 0x4000, 0)  # directory
        else:
            stat = os.stat(full_path)
            yield (name, 0x8000, stat.st_size)  # file

def dupterm(stream, index=0):
    """Duplicate terminal - stub for emulator."""
    pass
