"""
Source File Utilities Module
Handles source file loading and path resolution.
"""

import config


def get_script_path(module_path=None):
    """Get the full path to a script file."""
    if module_path is None:
        module_path = config.FILE_NAME

    if "/" not in module_path and "." in module_path:
        module_path = module_path.replace(".", "/")

    suffix = "" if module_path.endswith(".py") else ".py"

    return "{}{}{}".format(
        config.SCRIPT_DIRECTORY,
        "/" if not module_path.startswith("/") else "",
        module_path + suffix,
    )


def build_candidate_paths(filename):
    """Build a list of candidate paths to try when loading a file."""
    candidates = []

    if filename and isinstance(filename, str):
        candidates.append(filename)
        if not filename.startswith("/"):
            candidates.append(
                "{}/{}".format(config.SCRIPT_DIRECTORY, filename.lstrip("/"))
            )
            candidates.append("/{}".format(filename.lstrip("/")))

    # Remove duplicates while preserving order
    unique = []
    for path in candidates:
        if path and path not in unique:
            unique.append(path)

    return unique


def load_source_lines(filename):
    """
    Load source lines from a file.

    Returns:
        tuple: (lines list, resolved path) or (None, fallback path)
    """
    candidates = build_candidate_paths(filename)

    for path in candidates:
        try:
            with open(path, "r") as source_file:
                return source_file.readlines(), path
        except OSError:
            continue

    fallback = filename if filename else None
    return None, fallback
