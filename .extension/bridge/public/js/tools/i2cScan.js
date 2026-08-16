/**
 * I2C Device Scanner
 *
 * Runs a MicroPython script on the connected device that probes every
 * documented I2C pin pair for the detected board using SoftI2C (which
 * works on any GPIO pair, unlike hardware I2C), reports each device
 * address found together with a best-guess identification, and prints
 * live progress per pair. Once that pass finishes, the user is asked
 * whether to brute-force every remaining GPIO pin combination too.
 *
 * Design notes:
 *  - Output streams to the terminal in real time: sendRawCommand echoes
 *    device prints as they happen and returns as soon as the exec frame
 *    closes, so no extra progress plumbing is needed.
 *  - A floating (unwired / no pull-ups) bus can ACK dozens of ghost
 *    addresses; any pair reporting more than 24 hits is dismissed.
 *  - After each scan pass the friendly REPL prompt is restored with a CR
 *    nudge, exactly like the other tools.
 */

import { sendRawCommand } from "../serial/rawRepl.js";
import * as store from "../state/store.js";
import { termWrite } from "../terminal/output.js";

// Documented I2C pin pairs (SDA, SCL, bus label) per board family.
// RP2040/RP2350: every adjacent hardware I2C pair from the datasheet.
const PICO_PAIRS = [
  [0, 1, "I2C0"],
  [4, 5, "I2C0"],
  [8, 9, "I2C0"],
  [12, 13, "I2C0"],
  [16, 17, "I2C0"],
  [20, 21, "I2C0"],
  [2, 3, "I2C1"],
  [6, 7, "I2C1"],
  [10, 11, "I2C1"],
  [14, 15, "I2C1"],
  [18, 19, "I2C1"],
  [26, 27, "I2C1"],
];

// ESP32 classic: default wiring first, then common alternates.
const ESP32_PAIRS = [
  [21, 22, "default"],
  [25, 26, "alt"],
  [32, 33, "alt"],
  [18, 19, "alt"],
  [16, 17, "alt"],
  [13, 14, "alt"],
];

// ESP32-S2/S3/C3: low-numbered GPIOs are the usual I2C wiring.
const ESP32_SX_PAIRS = [
  [8, 9, "default"],
  [1, 2, "alt"],
  [4, 5, "alt"],
  [6, 7, "alt"],
];

/**
 * Choose the pin-pair table for the detected board.
 * Unknown boards get the Pico table (this project's primary target).
 */
function pairsForBoard(deviceInfo) {
  const board = (deviceInfo && deviceInfo.board) || "";
  if (board.startsWith("esp32s") || board.startsWith("esp32c")) {
    return ESP32_SX_PAIRS;
  }
  if (board.startsWith("esp32") || board === "esp8266") {
    return ESP32_PAIRS;
  }
  return PICO_PAIRS;
}

// Full GPIO candidate lists for the brute-force "scan everything" pass.
// Invalid/reserved pins are left in; the on-device try/except already
// skips any pin machine.Pin() rejects, so being generous here is cheap.
const PICO_ALL_PINS = Array.from({ length: 29 }, (_, i) => i); // GP0-GP28

const ESP32_ALL_PINS = [
  0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
];

const ESP32_SX_ALL_PINS = Array.from({ length: 22 }, (_, i) => i); // GP0-GP21

/** Choose the exhaustive GPIO candidate list for the detected board. */
function allPinsForBoard(deviceInfo) {
  const board = (deviceInfo && deviceInfo.board) || "";
  if (board.startsWith("esp32s") || board.startsWith("esp32c")) {
    return ESP32_SX_ALL_PINS;
  }
  if (board.startsWith("esp32") || board === "esp8266") {
    return ESP32_ALL_PINS;
  }
  return PICO_ALL_PINS;
}

/**
 * Every (sda, scl) ordered pin combination for the board that wasn't
 * already covered by `knownPairs`, for the brute-force "scan everything"
 * pass. Ordered (not combinations) because swapping SDA/SCL matters.
 */
function allPairsForBoard(deviceInfo, knownPairs) {
  const pins = allPinsForBoard(deviceInfo);
  const known = new Set(knownPairs.map(([sda, scl]) => `${sda},${scl}`));
  const pairs = [];
  for (const sda of pins) {
    for (const scl of pins) {
      if (sda === scl || known.has(`${sda},${scl}`)) continue;
      pairs.push([sda, scl, "brute"]);
    }
  }
  return pairs;
}

/**
 * Build the on-device scan script.
 * The known-address table lives in the script so identifications print
 * inline with live progress (no post-processing round trip).
 */
function buildScanScript(pairs) {
  const pairsPy = pairs
    .map(([sda, scl, bus]) => `(${sda},${scl},'${bus}')`)
    .join(",");

  return `
import machine
_PAIRS = [${pairsPy}]
_NAMES = {
    0x0D: 'QMC5883L compass',
    0x1D: 'ADXL345 accelerometer',
    0x1E: 'HMC5883L compass',
    0x23: 'BH1750 light sensor',
    0x27: 'PCF8574 LCD backpack / IO expander',
    0x29: 'VL53L0X distance / TSL2561 light',
    0x38: 'AHT10/AHT20 temp+humidity',
    0x39: 'TSL2561 light / APDS-9960 gesture',
    0x3C: 'SSD1306/SH1106 OLED display',
    0x3D: 'SSD1306 OLED (alt address)',
    0x3F: 'PCF8574A LCD backpack',
    0x40: 'INA219 current / HTU21D humidity / PCA9685 PWM',
    0x44: 'SHT31/SHT40 temp+humidity',
    0x48: 'ADS1115 ADC / TMP102 temp',
    0x4A: 'ADS1115 ADC (alt address)',
    0x50: 'AT24C EEPROM',
    0x51: 'PCF8563 RTC',
    0x53: 'ADXL345 accelerometer (alt)',
    0x57: 'AT24C EEPROM / MAX30102 pulse',
    0x5A: 'MLX90614 IR temp / CCS811 air quality',
    0x60: 'MCP4725 DAC / ATECC crypto',
    0x61: 'SCD30 CO2 sensor',
    0x62: 'SCD40/SCD41 CO2 sensor',
    0x68: 'MPU6050 IMU / DS1307/DS3231 RTC',
    0x69: 'MPU6050 IMU (alt address)',
    0x76: 'BMP280/BME280 pressure (alt)',
    0x77: 'BMP280/BME280/BMP180 pressure',
}
_found = {}
_total = len(_PAIRS)
print('[I2C] Scanning %d pin pairs...' % _total)
for _i, (_sda, _scl, _bus) in enumerate(_PAIRS):
    print('[I2C] (%d/%d) SDA=GP%d SCL=GP%d (%s)...' % (_i + 1, _total, _sda, _scl, _bus))
    try:
        try:
            _sda_pin = machine.Pin(_sda, mode=machine.Pin.OPEN_DRAIN, pull=machine.Pin.PULL_UP)
            _scl_pin = machine.Pin(_scl, mode=machine.Pin.OPEN_DRAIN, pull=machine.Pin.PULL_UP)
        except Exception:
            # Some ports reject OPEN_DRAIN for these pins; fall back so scan still runs.
            _sda_pin = machine.Pin(_sda)
            _scl_pin = machine.Pin(_scl)
        try:
            # Clear any leftover IRQ (e.g. the launcher's stop-pin button)
            # so toggling this pin during the scan doesn't spam KeyboardInterrupts.
            _sda_pin.irq(handler=None)
            _scl_pin.irq(handler=None)
        except Exception:
            pass
        _i2c = machine.SoftI2C(sda=_sda_pin, scl=_scl_pin, freq=100000, timeout=50000)
        _devs = _i2c.scan()
    except Exception as _e:
        print('       skipped: %s' % _e)
        continue
    if len(_devs) > 24:
        print('       %d addresses ACKed - floating bus (missing pull-ups?), ignored' % len(_devs))
        try:
            _i2c_sw = machine.SoftI2C(sda=_scl_pin, scl=_sda_pin, freq=100000, timeout=50000)
            _sw_devs = _i2c_sw.scan()
            if 0 < len(_sw_devs) <= 24:
                print('       NOTE: reversed mapping found %d device(s): %s' % (len(_sw_devs), ', '.join('0x%02X' % _a for _a in _sw_devs)))
                print('       CHECK: SDA/SCL may be swapped in wiring for this pair')
            elif len(_sw_devs) > 24:
                print('       reversed mapping also floating (%d ACKs)' % len(_sw_devs))
            else:
                print('       reversed mapping found no devices')
        except Exception as _sw_e:
            print('       reversed mapping check failed: %s' % _sw_e)
        continue
    for _a in _devs:
        print('       FOUND 0x%02X - %s' % (_a, _NAMES.get(_a, 'unknown device')))
        _k = '0x%02X' % _a
        if _k not in _found:
            _found[_k] = []
        _found[_k].append('GP%d/GP%d' % (_sda, _scl))
print('')
if _found:
    print('[I2C] === Summary: %d device address(es) ===' % len(_found))
    for _k in sorted(_found):
        _a = int(_k, 16)
        print('[I2C] %s  %s' % (_k, _NAMES.get(_a, 'unknown device')))
        print('       wired on: %s' % ', '.join(_found[_k]))
else:
    print('[I2C] No devices found.')
    print('[I2C] Check: VCC/GND wiring, SDA/SCL not swapped, pull-up resistors (4.7k) present.')
del _PAIRS, _NAMES, _found
`;
}

/**
 * Run one scan pass (a list of pin pairs) and restore the REPL prompt
 * afterwards, regardless of success or failure.
 */
async function runScanPass(pairs, timeoutMs) {
  try {
    // Upper bound; returns early when the device finishes.
    await sendRawCommand(buildScanScript(pairs), timeoutMs);
  } catch (err) {
    termWrite(`[Error] ${err.message}\r\n`);
  } finally {
    // Restore the friendly ">>>" prompt, same as the other tools.
    const writer = store.getWriter();
    if (writer) {
      try {
        await writer.write("\r");
      } catch {
        /* connection may have closed mid-flight */
      }
    }
  }
}

/**
 * Scan all documented I2C pin pairs on the connected device and report
 * every device found, with live progress in the terminal. Afterwards,
 * offer to brute-force every remaining GPIO pin combination.
 */
export async function scanI2cDevices() {
  if (!store.isConnected()) {
    termWrite("\r\n[Bridge] Please connect to Pico first\r\n");
    return;
  }

  const deviceInfo = store.getDeviceInfo();
  const knownPairs = pairsForBoard(deviceInfo);
  termWrite("\r\n[Bridge] Scanning for I2C devices...\r\n");
  await runScanPass(knownPairs, 20000);

  const bruteForcePairs = allPairsForBoard(deviceInfo, knownPairs);
  if (bruteForcePairs.length === 0) return;

  const wantsBruteForce = confirm(
    `Scan all ${bruteForcePairs.length} remaining GPIO pin combinations too?\n\nThis brute-forces every other pin pair and can take several minutes.`,
  );
  if (!wantsBruteForce) return;

  termWrite(
    `\r\n[Bridge] Scanning all ${bruteForcePairs.length} remaining pin combinations (this may take a while)...\r\n`,
  );
  // Scale the wait budget with pair count; still returns early on completion.
  const bruteForceTimeoutMs = Math.max(20000, bruteForcePairs.length * 300);
  await runScanPass(bruteForcePairs, bruteForceTimeoutMs);
}
