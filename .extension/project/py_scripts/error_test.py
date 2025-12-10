"""
Error Testing Script
Tests various error types to verify error handler functionality.

Uncomment different sections to test different error types.
"""

from machine import Pin
from utime import sleep


# ============================================================================
# TEST 1: ImportError - Module doesn't exist
# ============================================================================
# from nonexistent_module import something


# ============================================================================
# TEST 2: ImportError - File doesn't exist in py_scripts
# ============================================================================
# from missing_file import my_function


# ============================================================================
# TEST 3: AttributeError - Accessing non-existent attribute
# ============================================================================
# pin = Pin("LED", Pin.OUT)
# pin.nonexistent_method()


# ============================================================================
# TEST 4: NameError - Using undefined variable
# ============================================================================
# print(undefined_variable)


# ============================================================================
# TEST 5: TypeError - Wrong argument type
# ============================================================================
# pin = Pin("LED", Pin.OUT)
# sleep("not a number")


# ============================================================================
# TEST 6: ValueError - Invalid value
# ============================================================================
# number = int("not_a_number")


# ============================================================================
# TEST 7: ZeroDivisionError
# ============================================================================
# result = 10 / 0


# ============================================================================
# TEST 8: IndexError - List index out of range
# ============================================================================
# my_list = [1, 2, 3]
# value = my_list[10]


# ============================================================================
# TEST 9: KeyError - Dictionary key doesn't exist
# ============================================================================
# my_dict = {"a": 1, "b": 2}
# value = my_dict["z"]


# ============================================================================
# TEST 10: OSError - File operation error
# ============================================================================
# with open("nonexistent_file.txt", "r") as f:
#     content = f.read()


# ============================================================================
# TEST 11: RuntimeError - General runtime error
# ============================================================================
# def recursive_function():
#     return recursive_function()
# recursive_function()


# ============================================================================
# TEST 12: SyntaxError in imported module
# ============================================================================
# Create a file 'bad_syntax.py' with syntax errors and import it
# from bad_syntax import something


# ============================================================================
# TEST 13: Multiple nested function calls leading to error
# ============================================================================
# def level_1():
#     return level_2()
# 
# def level_2():
#     return level_3()
# 
# def level_3():
#     return undefined_variable
# 
# level_1()


# ============================================================================
# TEST 14: Error in loop
# ============================================================================
# for i in range(5):
#     print(f"Iteration {i}")
#     if i == 3:
#         result = 1 / 0


# ============================================================================
# TEST 15: Pin configuration error
# ============================================================================
# pin = Pin(999, Pin.OUT)  # Invalid pin number


# ============================================================================
# WORKING CODE - Default when all tests are commented
# ============================================================================
print("=== Error Test Script ===")
print("All error tests are currently commented out.")
print("Uncomment a test section above to test error handling.")
print("")
print("LED blink test starting...")

led = Pin("LED", Pin.OUT)

for i in range(5):
    led.toggle()
    sleep(0.5)
    print(f"Blink {i+1}: LED is {'ON' if led.value() else 'OFF'}")

print("Test complete!")
