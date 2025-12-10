"""
Error Guidance Module
Contains error messages and guidance for different exception types.
"""

ERROR_GUIDANCE = {
    "IMPORT ERROR": [
        "Raised when the import statement has trouble trying to load a library or module. A common issue is that the module does not exist.",
        "Check that the module/import exists in MicroPython or that you have added the library to the 'lib' folder.",
        "Next step: Confirm the script is stored under /py_scripts or /lib and that the name on line 7 matches the file.",
    ],
    "NAME ERROR": [
        "Raised when a local or global name is not found. This is usually a typo in the name of a variable, method or function.",
        "Check the names of all variables, methods and functions have been typed correctly.",
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
    "OS ERROR": [
        "This is a system error catch all.",
        "Next step: Note the error code, verify any file paths, and retry after checking the hardware connections.",
    ],
    "RUNTIME ERROR": [
        "This is a runtime catch all error.",
        "Next step: Use the code context and traceback to narrow down what ran just before the crash.",
    ],
    "UNEXPECTED ERROR": [
        "Raised when an error was not specifically handled above.",
        "Next step: Review the code context and traceback to decide which exception type needs its own handler.",
    ],
}


def get_guidance(error_type):
    """Get guidance messages for a specific error type."""
    return ERROR_GUIDANCE.get(error_type, ERROR_GUIDANCE.get("UNEXPECTED ERROR", []))
