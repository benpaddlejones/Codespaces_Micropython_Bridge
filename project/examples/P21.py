from PiicoDev_Switch import PiicoDev_Switch
from PiicoDev_Unified import sleep_ms
 
button = PiicoDev_Switch(address=0x42, double_press_duration=400, ema_parameter=73, ema_period=30)   # Initialise the module

while True:
    print('----------------------------------------------------')
    firmware = button.firmware
    print('Firmware: ' + str(firmware[0]) + '.' + str(firmware[1]))
    print('ID: ' + str(button.whoami))
    print('Flashing LED 3 times...')
    for x in range(3):
        button.led = False
        print("LED ON: " + str(button.led))
        sleep_ms(500)
        button.led = True
        print("LED ON: " + str(button.led))
        sleep_ms(500)
    print('Button was pressed: ' + str(button.was_pressed))
    print('Button press count: ' + str(button.press_count))
    print('double_press_duration: ' + str(button.double_press_duration))
    print('EMA Parameter: ' + str(button.ema_parameter))
    print('EMA Period: ' + str(button.ema_period))
    print('Is Pressed: ' + str(button.is_pressed))
    print('was_double_pressed: ' + str(button.was_double_pressed))
    #button.setI2Caddr(0x72)
    sleep_ms(4000)