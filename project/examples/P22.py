from PiicoDev_Potentiometer import PiicoDev_Potentiometer
from PiicoDev_Unified import sleep_ms
 
pot = PiicoDev_Potentiometer(id=[0,0,0,0], minimum=0.0, maximum=100.0)   # Initialise the RFID module address=0x35, 

while True:
    firmware = pot.firmware
    print('Firmware: ' + str(firmware[0]) + '.' + str(firmware[1]))
    print('ID: ' + str(pot.whoami))
    print('Flashing LED 3 times...')
    for x in range(3):
        pot.led = False
        print("LED ON: " + str(pot.led))
        sleep_ms(1000)
        pot.led = True
        print("LED ON: " + str(pot.led))
        sleep_ms(1000)
    print("Value: " + str(pot.value))
    print("Raw Value: " + str(pot.raw))
    print("------------------------------------------")
    pot.setI2Caddr(0x35)