"""
Source File Utilities Module
Handles source file loading and path resolution.
"""

import config


def get_script_path(module_path=None):
    """Get the full filesystem path to a script file.

    Converts dot-separated module paths to slash-separated file paths
    and prepends the configured script directory.

    Args:
        module_path: Module name or relative path. If None, uses
            config.FILE_NAME.

    Returns:
        str: Absolute path to the script file with .py extension.
    """
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
    """Build a list of candidate paths to try when loading a file.

    Args:
        filename: Source filename or path to resolve.

    Returns:
        list[str]: Deduplicated list of candidate paths, starting with
            the filename as-is, then under SCRIPT_DIRECTORY, then at root.
    """
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

    Tries each candidate path built from the filename until one
    opens successfully.

    Args:
        filename: Source filename or path to resolve.

    Returns:
        tuple: (lines list, resolved path) on success, or
            (None, filename) if no candidate could be opened.
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
