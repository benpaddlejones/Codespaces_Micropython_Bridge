# Plotter Demo for Pi Pico Bridge
# This script demonstrates the plotter feature similar to Arduino Serial Plotter
# Enable the "📈 Plotter" checkbox in the bridge to see the graphs
#
# Sends different waveforms (sine, square, triangle, and random)
# demonstrating how multiple variables can be visualized in real-time.
#
# @author Ben Jones

import math
import time
import random

# Configuration
sample_rate = 50  # Hz
freq = 1.0  # Hz
time_val = 0.0

print("Sine\tSquare\tTri\tRandom")

while True:
    # Generate signals
    sine_val = math.sin(2 * math.pi * freq * time_val)
    square_val = 1.0 if sine_val >= 0 else -1.0
    tri_val = 2.0 * abs(2.0 * (time_val * freq - math.floor(time_val * freq + 0.5))) - 1.0
    random_val = random.uniform(-1.0, 1.0)

    # Print in tab-separated format for Serial Plotter (all 4 lines plotted simultaneously)
    print(f"{sine_val:.3f}\t{square_val:.3f}\t{tri_val:.3f}\t{random_val:.3f}")

    # Update time
    time_val += 1.0 / sample_rate
    time.sleep(1.0 / sample_rate)
