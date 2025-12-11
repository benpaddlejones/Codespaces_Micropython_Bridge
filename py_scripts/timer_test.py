"""
Timer Test - Tests MicroPython Timer callbacks
Common pattern for periodic tasks
"""
from machine import Timer, Pin
import utime

# Create a counter to track callbacks
callback_count = 0
max_callbacks = 5

def timer_callback(t):
    global callback_count
    callback_count += 1
    print(f"Timer callback #{callback_count} at {utime.ticks_ms()}ms")
    
    # Stop after max callbacks
    if callback_count >= max_callbacks:
        t.deinit()
        print("Timer stopped")

print("=== Timer Test ===")
print(f"Will fire {max_callbacks} times with 200ms period")
print()

# Create and start timer
# Use -1 for software timer (virtual timer)
timer = Timer(-1)
timer.init(period=200, mode=Timer.PERIODIC, callback=timer_callback)

print("Timer started, waiting for callbacks...")
print()

# Wait for all callbacks to complete
start = utime.ticks_ms()
while callback_count < max_callbacks:
    utime.sleep_ms(50)  # Small sleep to not block

elapsed = utime.ticks_diff(utime.ticks_ms(), start)
print()
print(f"Total time elapsed: {elapsed}ms")
print(f"Expected: ~{max_callbacks * 200}ms")
print()
print("=== Timer Test Complete ===")
