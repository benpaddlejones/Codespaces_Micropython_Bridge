# Run Your First Script

Execute Python code on your Pico directly from VS Code!

## Running Code

### From the Editor
1. Open a Python file (`.py`)
2. Right-click and select **Pico Bridge: Run File**
3. Or use `Ctrl+Shift+R` (Cmd+Shift+R on Mac)

### From the Command Palette
1. `Ctrl+Shift+P` to open Command Palette
2. Type "Pico Bridge: Run File"
3. Press Enter

## What Happens

1. Your code is sent to the Pico through the bridge
2. The REPL terminal shows the output
3. Any print() statements appear in real-time

## Example

```python
# main.py
from machine import Pin
import time

led = Pin(25, Pin.OUT)  # Built-in LED on Pico

while True:
    led.toggle()
    print("LED toggled!")
    time.sleep(1)
```
