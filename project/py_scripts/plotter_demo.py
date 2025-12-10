# Plotter Demo for Pi Pico Bridge
# This script demonstrates the plotter feature
# Enable the "📈 Plotter" checkbox in the bridge to see the graphs

import math
import time

# The plotter supports multiple data formats:
# 1. Single value:     print(42)
# 2. Multiple values:  print(1.5, 2.3, 3.7)  or  print("1.5,2.3,3.7")
# 3. Labeled values:   print("temp:23.5") or print("x:1.2,y:3.4,z:5.6")

print("Starting Plotter Demo...")
print("Enable the Plotter checkbox in the bridge to see the graphs!")
time.sleep(2)

# Demo 1: Simple sine wave
print("\n--- Demo 1: Sine Wave ---")
for i in range(100):
    value = math.sin(i * 0.1) * 50 + 50  # Sine wave 0-100
    print(value)
    time.sleep(0.05)

time.sleep(1)

# Demo 2: Multiple channels (comma-separated)
print("\n--- Demo 2: Multiple Channels (sin, cos, triangle) ---")
for i in range(100):
    sin_val = math.sin(i * 0.1) * 40 + 50
    cos_val = math.cos(i * 0.1) * 40 + 50
    triangle = abs((i % 40) - 20) * 2 + 30  # Triangle wave
    print(f"{sin_val:.1f},{cos_val:.1f},{triangle}")
    time.sleep(0.05)

time.sleep(1)

# Demo 3: Labeled values (best for readability)
# All labels on one line = concurrent plotting (like Arduino Serial Plotter)
print("\n--- Demo 3: Labeled Values ---")
for i in range(100):
    temperature = (
        20 + math.sin(i * 0.05) * 5 + (i * 0.02)
    )  # Rising temp with oscillation
    humidity = 60 + math.cos(i * 0.08) * 15  # Humidity fluctuation
    pressure = 1013 + math.sin(i * 0.03) * 5  # Pressure variation

    # Labeled format: all on one line for concurrent graphing
    print(f"temp:{temperature:.1f},humidity:{humidity:.1f},pressure:{pressure:.1f}")
    time.sleep(0.1)

time.sleep(1)

# Demo 4: Simulated sensor data
# All values on one line = concurrent plotting (matches Arduino Serial Plotter format)
print("\n--- Demo 4: Simulated Accelerometer ---")
for i in range(150):
    # Simulate accelerometer with noise and movement
    noise = (hash(str(i)) % 100 - 50) / 100  # Pseudo-random noise
    x = math.sin(i * 0.1) * 2 + noise
    y = math.cos(i * 0.15) * 1.5 + noise * 0.5
    z = 9.8 + math.sin(i * 0.05) * 0.5 + noise * 0.3

    # All on one line for concurrent graphing
    print(f"accel_x:{x:.2f},accel_y:{y:.2f},accel_z:{z:.2f}")
    time.sleep(0.05)

print("\n--- Plotter Demo Complete! ---")
print("Try modifying this script to plot your own sensor data!")
