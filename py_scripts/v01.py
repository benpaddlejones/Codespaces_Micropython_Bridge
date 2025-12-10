"""
Basic blink program
"""

from machine import Pin
from utime import sleep


pin = Pin("LED", Pin.OUT)

while True:
    pin.toggle()
    sleep(1)  # sleep 1sec
    print("LED is ON" if pin.value() else "LED is OFF")
