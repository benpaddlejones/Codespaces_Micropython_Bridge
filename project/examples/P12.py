# PiicoDev Capacitive Touch Sensor CAP1203 demo code
# Play some notes using the sensor as a keyboard

import music
from PiicoDev_CAP1203 import PiicoDev_CAP1203
from PiicoDev_Unified import sleep_ms # cross-platform-compatible sleep

touchSensor = PiicoDev_CAP1203()

while True:
    status = touchSensor.read() # read the state of all the touch pads
    # Play a note depending on which pad is pressed
    if status[1] == 1:
        music.play("F#")
    if status[2] == 1:
        music.play("E")
    if status[3] == 1:
        music.play("D")

    sleep_ms(100)