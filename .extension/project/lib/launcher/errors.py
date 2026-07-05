"""
Error Guidance Module
Contains error messages and guidance for different exception types.
"""

ERROR_GUIDANCE = {
    "IMPORT ERROR": [
        "Raised when the import statement has trouble trying to load a library or module. A common issue is that the module does not exist.",
        "Check that the module/import exists in MicroPython or that you have added the library to the 'lib' folder.",
        "Next step: Confirm the script is stored under /py_scripts or /lib and that it matches the FILE_NAME setting in config.py.",
    ],
    "NAME ERROR": [
        "Raised when a local or global name is not found. This is usually a typo in the name of a variable, method or function.",
        "Check the names of all variables, methods and functions have been typed correctly - names are case-sensitive.",
        "Next step: Compare the highlighted context line with the variable/function definitions to locate the mismatch.",
    ],
    "SYNTAX ERROR": [
        "Raised when the parser encounters a syntax error. This may be caused by a typo in the code.",
        "Check the white space, colons, brackets and other syntax elements are correct in the code.",
        "Next step: Fix the syntax around the highlighted line, then re-run the program.",
    ],
    "TYPE ERROR": [
        "Raised when an operation or function is applied to an object of inappropriate type. The associated value is a string giving details about the type mismatch.",
        "Check you are performing the correct processing for the data type.",
        "Next step: Inspect the variables used on the highlighted line and ensure they have the expected data type.",
    ],
    "VALUE ERROR": [
        "Raised when a built-in operation or function receives an argument that has the right type but an inappropriate value.",
        "Next step: Validate the values being passed to the function on the highlighted line before calling it.",
    ],
    "ATTRIBUTE ERROR": [
        "Raised when you use a method or property that does not exist on that object. Usually a typo in the method name, or the variable is not the type you think it is.",
        "Check the spelling of the method/property - names are case-sensitive - and print the variable to confirm its type.",
        "Next step: Compare the highlighted line against the documentation for that class to find the correct name.",
    ],
    "INDEX ERROR": [
        "Raised when a list (or similar) index is out of range - the position you asked for does not exist.",
        "Remember indexes start at 0, so the last item of a list of length n is at index n-1.",
        "Next step: Print the list and its len() just before the highlighted line to see what positions actually exist.",
    ],
    "KEY ERROR": [
        "Raised when a dictionary key is not found. The key may be misspelled or was never added.",
        "Check the exact spelling and type of the key - 'Led' and 'led' are different keys.",
        "Next step: Print the dictionary (or its .keys()) just before the highlighted line to see which keys exist.",
    ],
    "ZERO DIVISION ERROR": [
        "Raised when dividing (or using modulo %) by zero.",
        "A variable used as the divisor has ended up as 0 - often from a sensor reading or a counter that never advanced.",
        "Next step: Print the divisor before the highlighted line, and guard the division with 'if divisor != 0:'.",
    ],
    "MEMORY ERROR": [
        "Raised when the board runs out of RAM. Microcontrollers have very little memory compared to a computer.",
        "Large lists/strings built up in loops are the usual cause.",
        "Next step: Reduce the size of data kept in memory, reuse buffers, and call gc.collect() after freeing large objects.",
    ],
    "OS ERROR": [
        "Raised when a system operation fails - usually file access or talking to hardware.",
        "The errno hint under the error message explains what the error number means.",
        "Next step: Note the error code, verify any file paths, and retry after checking the hardware connections.",
    ],
    "RUNTIME ERROR": [
        "This is a runtime catch all error.",
        "Next step: Use the code context and traceback to narrow down what ran just before the crash.",
    ],
    "UNEXPECTED ERROR": [
        "An error occurred that the launcher does not have specific guidance for.",
        "Next step: Read the error message and highlighted code context above - they describe exactly what went wrong and where.",
    ],
}


# Plain-English translations for the errno codes students actually hit.
# MicroPython often raises bare "OSError: 5" style errors - the number on
# its own is meaningless to a learner.
ERRNO_HINTS = {
    1: ("EPERM", "Operation not permitted."),
    2: (
        "ENOENT",
        "File or directory not found on the device - check the path and that the file was uploaded.",
    ),
    5: (
        "EIO",
        "Hardware input/output failed - check wiring, power and connections.",
    ),
    13: ("EACCES", "Access to the file or resource was denied."),
    17: ("EEXIST", "The file or directory already exists."),
    19: (
        "ENODEV",
        "No such hardware device - check the pin/bus numbers and the wiring.",
    ),
    22: (
        "EINVAL",
        "An argument value is invalid for this hardware call - check pin numbers, frequencies and modes.",
    ),
    28: ("ENOSPC", "No space left on the device filesystem."),
    110: (
        "ETIMEDOUT",
        "The operation timed out - the hardware or network did not respond.",
    ),
}


def get_guidance(error_type):
    """Get guidance messages for a specific error type."""
    return ERROR_GUIDANCE.get(error_type, ERROR_GUIDANCE.get("UNEXPECTED ERROR", []))


def get_errno_hint(error):
    """
    Translate an OSError's errno into plain English.

    Returns:
        str or None: A human-readable hint, or None if not applicable.
    """
    if not isinstance(error, OSError):
        return None
    args = getattr(error, "args", None)
    if not args or not isinstance(args[0], int):
        return None
    hint = ERRNO_HINTS.get(args[0])
    if not hint:
        return None
    return "Errno {} ({}): {}".format(args[0], hint[0], hint[1])
