"""
Debugpy Demo - MicroPython Mechatronics Debugging Tutorial
===========================================================

This script demonstrates how to use debugpy to debug a MicroPython
mechatronics project. It simulates a simple robot control system with
sensors and actuators.

HOW TO USE THIS DEMO:
---------------------
1. Open this file in VS Code
2. Set breakpoints by clicking in the gutter (left of line numbers)
   - Try setting breakpoints on lines marked with # BREAKPOINT
3. Press F5 or click "Run and Debug" → "MicroPython (Emulator)"
4. When execution pauses at a breakpoint, explore:
   - VARIABLES panel: See all variable values
   - WATCH panel: Add expressions to monitor (e.g., "motor_speed > 50")
   - CALL STACK: See the function call hierarchy
   - DEBUG CONSOLE: Type Python expressions to evaluate

DEBUGGING TIPS:
---------------
- F5: Continue to next breakpoint
- F10: Step Over (execute current line, don't enter functions)
- F11: Step Into (enter the function on current line)
- Shift+F11: Step Out (finish current function, return to caller)
- Hover over variables to see their values
- Right-click a variable → "Add to Watch" for continuous monitoring

"""

from machine import Pin, ADC, PWM
import time

# ============================================================================
# CONFIGURATION - Try changing these values and watch in debugger!
# ============================================================================

MOTOR_PIN = 15          # PWM output for motor
SENSOR_PIN = 26         # ADC input for distance sensor
LED_PIN = "LED"         # Status LED
BUTTON_PIN = 14         # Manual override button

SPEED_MIN = 0           # Minimum motor speed (0-65535)
SPEED_MAX = 65535       # Maximum motor speed
DISTANCE_THRESHOLD = 500  # Stop if object closer than this

MAX_CYCLES = 10         # Number of control cycles to run

# ============================================================================
# HARDWARE INITIALIZATION
# ============================================================================

def init_hardware():
    """
    Initialize all hardware peripherals.
    
    Set a breakpoint here to inspect hardware objects after creation.
    """
    # BREAKPOINT: Set breakpoint on next line to see hardware init
    led = Pin(LED_PIN, Pin.OUT)
    motor = PWM(Pin(MOTOR_PIN))
    motor.freq(1000)  # 1kHz PWM frequency
    
    sensor = ADC(SENSOR_PIN)
    button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    
    # Return as a dictionary - easy to inspect in debugger
    hardware = {
        "led": led,
        "motor": motor,
        "sensor": sensor,
        "button": button,
        "motor_speed": 0,
        "is_running": False
    }
    
    print("✓ Hardware initialized")
    return hardware

# ============================================================================
# SENSOR PROCESSING
# ============================================================================

def read_distance(sensor):
    """
    Read and process distance sensor value.
    
    The ADC returns 0-65535, we convert to a 0-1000 range.
    Set a breakpoint to watch raw vs processed values.
    """
    # BREAKPOINT: Compare raw_value vs distance
    raw_value = sensor.read_u16()
    
    # Scale to 0-1000 range for easier interpretation
    distance = int((raw_value / 65535) * 1000)
    
    return distance, raw_value

def calculate_motor_speed(distance, current_speed):
    """
    Calculate motor speed based on distance sensor.
    
    This is the core control algorithm - great place for debugging!
    Watch how speed changes based on distance.
    """
    # BREAKPOINT: Watch the control logic decisions
    if distance < DISTANCE_THRESHOLD:
        # Object too close - stop immediately
        new_speed = SPEED_MIN
        status = "STOP - Object detected!"
    elif distance < DISTANCE_THRESHOLD * 2:
        # Getting close - slow down proportionally
        ratio = (distance - DISTANCE_THRESHOLD) / DISTANCE_THRESHOLD
        new_speed = int(SPEED_MAX * ratio * 0.5)
        status = f"SLOW - Distance: {distance}"
    else:
        # Clear path - full speed
        new_speed = SPEED_MAX
        status = "GO - Path clear"
    
    # Smooth acceleration/deceleration
    speed_change = new_speed - current_speed
    if abs(speed_change) > 5000:
        # Limit speed change rate
        new_speed = current_speed + (5000 if speed_change > 0 else -5000)
    
    return new_speed, status

# ============================================================================
# MAIN CONTROL LOOP
# ============================================================================

def control_cycle(hardware, cycle_num):
    """
    Single iteration of the control loop.
    
    This function runs once per cycle. Set a breakpoint at the start
    to step through and watch all the values change.
    """
    # BREAKPOINT: Start of each control cycle
    print(f"\n--- Cycle {cycle_num} ---")
    
    # Read sensors
    distance, raw_adc = read_distance(hardware["sensor"])
    button_pressed = not hardware["button"].value()  # Active low
    
    # Check for manual override
    if button_pressed:
        print("⚠ Manual override - STOPPING")
        hardware["motor"].duty_u16(0)
        hardware["led"].on()
        hardware["motor_speed"] = 0
        return False  # Signal to stop
    
    # Calculate new motor speed
    old_speed = hardware["motor_speed"]
    new_speed, status = calculate_motor_speed(distance, old_speed)
    
    # BREAKPOINT: Watch speed transition
    print(f"Distance: {distance} | Speed: {old_speed} → {new_speed}")
    print(f"Status: {status}")
    
    # Apply motor speed
    hardware["motor"].duty_u16(new_speed)
    hardware["motor_speed"] = new_speed
    
    # Update LED based on status
    if new_speed == 0:
        hardware["led"].on()   # LED on when stopped
    else:
        hardware["led"].off()  # LED off when running
    
    # Build state dictionary for debugging
    # BREAKPOINT: Inspect this to see complete system state
    state = {
        "cycle": cycle_num,
        "distance": distance,
        "raw_adc": raw_adc,
        "old_speed": old_speed,
        "new_speed": new_speed,
        "button": button_pressed,
        "status": status
    }
    
    return True  # Continue running

def run_robot():
    """
    Main robot control function.
    
    This orchestrates the entire system. Set a breakpoint at the start
    to step through initialization, then continue to watch cycles.
    """
    print("=" * 50)
    print("DEBUGPY DEMO - Robot Control System")
    print("=" * 50)
    print("\nTIP: Set breakpoints on lines marked # BREAKPOINT")
    print("     Then press F5 to start debugging!\n")
    
    # BREAKPOINT: Watch hardware dictionary being created
    hardware = init_hardware()
    
    print(f"\nRunning {MAX_CYCLES} control cycles...")
    print("-" * 50)
    
    # Main control loop with counter (debugpy-friendly)
    cycle = 0
    running = True
    
    while running and cycle < MAX_CYCLES:
        cycle += 1
        
        # Run one control cycle
        running = control_cycle(hardware, cycle)
        
        # Small delay between cycles
        time.sleep(0.5)
    
    # Cleanup
    print("\n" + "=" * 50)
    print("Control loop finished")
    hardware["motor"].duty_u16(0)
    hardware["led"].off()
    print("Motor stopped, LED off")
    print("=" * 50)
    
    # BREAKPOINT: Final state inspection
    final_state = {
        "total_cycles": cycle,
        "final_speed": hardware["motor_speed"],
        "stopped_early": not running
    }
    print(f"\nFinal state: {final_state}")
    
    return final_state

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    # BREAKPOINT: Start here to step through entire program
    result = run_robot()
    print(f"\nDemo complete! Result: {result}")
