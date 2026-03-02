"""
File Utilities Module
Directory listing and file availability functions.
"""

import uos

import config


def list_directory(path):
    """List directory contents, returning None on error.

    Args:
        path: Filesystem path to list.

    Returns:
        list[str] or None: Sorted list of entry names, or None if the
            directory cannot be read.
    """
    try:
        return sorted(uos.listdir(path))
    except OSError:
        return None


def print_available_files():
    """Print list of available files in key directories."""
    locations = [config.SCRIPT_DIRECTORY, config.LIB_DIRECTORY, "/"]

    print("--- Available Files ---")

    for location in locations:
        entries = list_directory(location)

        if entries is None:
            print("{}: unavailable".format(location))
        elif not entries:
            print("{}: <empty>".format(location))
        else:
            print("{}: {}".format(location, ", ".join(entries)))
