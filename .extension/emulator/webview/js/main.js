/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();

// Element references
const scriptNameEl = document.getElementById("scriptName");
const eventLogEl = document.getElementById("eventLog");
const clearLogBtn = document.getElementById("clearLogBtn");
const boardContainer = document.getElementById("boardContainer");
const boardSelect = document.getElementById("boardSelect");

// Control buttons
const playStopBtn = document.getElementById("playStopBtn");
const pauseBtn = document.getElementById("pauseBtn");

// Console panel elements
const consoleOutputEl = document.getElementById("consoleOutput");
const clearConsoleBtn = document.getElementById("clearConsoleBtn");

// I2C panel elements
const i2cLastWriteEl = document.getElementById("i2cLastWrite");
const i2cReadInputEl = document.getElementById("i2cReadInput");
const i2cSetBtnEl = document.getElementById("i2cSetBtn");
const i2cClearResponseBtnEl = document.getElementById("i2cClearResponseBtn");
const i2cValidationEl = document.getElementById("i2cValidation");
const i2cResponseStatusEl = document.getElementById("i2cResponseStatus");
const i2cLogEl = document.getElementById("i2cLog");
const clearI2cBtn = document.getElementById("clearI2cBtn");

// Track I2C response override
let i2cResponseOverride = null;

// ADC panel elements
const adcPinSelectEl = document.getElementById("adcPinSelect");
const adcValueInputEl = document.getElementById("adcValueInput");
const adcSliderEl = document.getElementById("adcSlider");
const adcVoltagePreviewEl = document.getElementById("adcVoltagePreview");
const adcSetBtnEl = document.getElementById("adcSetBtn");
const adcClearOverrideBtnEl = document.getElementById("adcClearOverrideBtn");
const adcOverrideStatusEl = document.getElementById("adcOverrideStatus");
const adcLastReadEl = document.getElementById("adcLastRead");
const adcLogEl = document.getElementById("adcLog");
const clearAdcBtn = document.getElementById("clearAdcBtn");

// Panel sections for auto-collapse
const i2cPanel = document.querySelector(".i2c-panel");
const adcPanel = document.querySelector(".adc-panel");

// Track ADC overrides (pin -> value)
const adcOverrides = {};

// Board-specific ADC pin configurations
const boardAdcPins = {
  pico: [
    { value: "26", label: "GP26 (ADC0)" },
    { value: "27", label: "GP27 (ADC1)" },
    { value: "28", label: "GP28 (ADC2)" },
    { value: "29", label: "GP29 (ADC3/VSYS)" },
    { value: "4", label: "Internal Temp" },
  ],
  "pico-w": [
    { value: "26", label: "GP26 (ADC0)" },
    { value: "27", label: "GP27 (ADC1)" },
    { value: "28", label: "GP28 (ADC2)" },
    { value: "29", label: "GP29 (ADC3/VSYS)" },
    { value: "4", label: "Internal Temp" },
  ],
  pico2w: [
    { value: "26", label: "GP26 (ADC0)" },
    { value: "27", label: "GP27 (ADC1)" },
    { value: "28", label: "GP28 (ADC2)" },
    { value: "29", label: "GP29 (ADC3/VSYS)" },
    { value: "4", label: "Internal Temp" },
  ],
  esp32: [
    { value: "32", label: "GPIO32 (ADC1_CH4)" },
    { value: "33", label: "GPIO33 (ADC1_CH5)" },
    { value: "34", label: "GPIO34 (ADC1_CH6)" },
    { value: "35", label: "GPIO35 (ADC1_CH7)" },
    { value: "36", label: "GPIO36/VP (ADC1_CH0)" },
    { value: "39", label: "GPIO39/VN (ADC1_CH3)" },
    { value: "25", label: "GPIO25 (ADC2_CH8)" },
    { value: "26", label: "GPIO26 (ADC2_CH9)" },
    { value: "27", label: "GPIO27 (ADC2_CH7)" },
  ],
};

// Current board
let currentBoard = "pico";

// Update ADC pin dropdown based on selected board
function updateAdcPinSelect(board) {
  if (!adcPinSelectEl) return;

  const pins = boardAdcPins[board] || boardAdcPins["pico"];
  adcPinSelectEl.innerHTML = "";

  pins.forEach((pin) => {
    const option = document.createElement("option");
    option.value = pin.value;
    option.textContent = pin.label;
    adcPinSelectEl.appendChild(option);
  });
}

// Pin state tracking
const pinStates = {};

// I2C/UART bus pin mappings - tracks which pins are used by each bus
const i2cBuses = {}; // { busId: { scl: pin, sda: pin } }
const uartBuses = {}; // { busId: { tx: pin, rx: pin } }

// ADC pin tracking - tracks which pins are used for ADC
const adcPins = {}; // { pinId: true }

// Execution state
let isRunning = false;
let isPaused = false;

// Board SVG content (will be set by extension)
let boardSvgContent = null;

function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  // Prepend so newest entries appear at top
  eventLogEl.textContent =
    `[${timestamp}] ${message}\n` + eventLogEl.textContent;
  eventLogEl.scrollTop = 0;
}

function appendConsole(text) {
  if (consoleOutputEl) {
    // Prepend so newest entries appear at top
    consoleOutputEl.textContent = text + consoleOutputEl.textContent;
    consoleOutputEl.scrollTop = 0;
  }
}

function logI2C(direction, addr, data, memAddr = null) {
  if (!i2cLogEl) {
    return;
  }
  const timestamp = new Date().toLocaleTimeString();
  let memStr =
    memAddr !== null ? ` mem=0x${memAddr.toString(16).padStart(2, "0")}` : "";
  let dataStr = Array.isArray(data)
    ? data.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(" ")
    : data;
  i2cLogEl.textContent += `[${timestamp}] ${direction} addr=0x${addr
    .toString(16)
    .padStart(2, "0")}${memStr}: ${dataStr}\n`;
  i2cLogEl.scrollTop = i2cLogEl.scrollHeight;
}

/**
 * Set pin mode indicator with persistent color.
 * @param {number|string} pin - The GPIO pin number
 * @param {string} mode - 'digital', 'pwm', 'adc', 'i2c', 'uart'
 * @param {boolean} active - Whether the pin is active
 */
function setPinMode(pin, mode, active = true) {
  if (pin === null || pin === undefined) return;

  const pinEl = boardContainer?.querySelector(`#pin-${pin}`);
  if (!pinEl) return;

  // Remove all mode classes first
  pinEl.classList.remove(
    "active",
    "digital-mode",
    "digital-out",
    "digital-in",
    "pwm-mode",
    "adc-mode",
    "i2c-mode",
    "uart-mode"
  );

  if (active) {
    pinEl.classList.add("active", `${mode}-mode`);
  }
}

/**
 * Flash a communication activity indicator on a pin (brief highlight).
 * @param {number} pin - The GPIO pin number
 * @param {string} protocol - 'i2c', 'uart', 'adc' for color coding
 */
function flashPinActivity(pin, protocol = "i2c") {
  if (pin === null || pin === undefined) return;

  const pinEl = boardContainer?.querySelector(`#pin-${pin}`);
  if (!pinEl) return;

  // Set persistent mode color
  setPinMode(pin, protocol, true);

  // Add flash animation
  pinEl.classList.remove("activity-flash");
  void pinEl.offsetWidth; // Force reflow
  pinEl.classList.add("activity-flash");

  // Remove just the flash animation (keep mode color)
  setTimeout(() => {
    pinEl.classList.remove("activity-flash");
  }, 200);
}

/**
 * Flash activity on multiple pins simultaneously (e.g., SDA + SCL for I2C).
 * @param {number[]} pins - Array of pin numbers
 * @param {string} protocol - 'i2c', 'uart', or 'spi'
 */
function flashMultiplePins(pins, protocol) {
  pins.forEach((pin) => flashPinActivity(pin, protocol));
}

// Board SVG handling
function loadBoardSvg(svgContent) {
  if (boardContainer && svgContent) {
    boardContainer.innerHTML = svgContent;
    boardSvgContent = svgContent;
    // Apply any existing pin states to the SVG
    Object.entries(pinStates).forEach(([pin, state]) => {
      updatePinVisual(pin, state.value, state.mode);
    });
  }
}

function updatePinVisual(pin, value, mode = "digital") {
  // Extract pin number from various formats (GP25, 25, "25", "LED")
  let pinNum = String(pin).replace(/^GP/i, "");

  // Handle special "LED" pin name (maps to GP25 on Pico, GPIO2 on ESP32)
  if (pinNum.toUpperCase() === "LED") {
    pinNum = "25";
  }

  // Determine if pin should be considered "on" (for digital or PWM)
  const isActive = mode === "pwm" ? value : Boolean(value);

  // Update onboard LED - check for both Pico (GP25) and ESP32 (GPIO2)
  if (pinNum === "25") {
    const ledEl = boardContainer?.querySelector("#led-gp25");
    if (ledEl) {
      // Remove all state classes first
      ledEl.classList.remove("on", "pwm");

      if (mode === "pwm" && isActive) {
        ledEl.classList.add("pwm");
      } else if (isActive) {
        ledEl.classList.add("on");
      }
    }
  }

  // ESP32 onboard LED is on GPIO2
  if (pinNum === "2") {
    const ledEl = boardContainer?.querySelector("#led-gpio2");
    if (ledEl) {
      // Remove all state classes first
      ledEl.classList.remove("on", "pwm");

      if (mode === "pwm" && isActive) {
        ledEl.classList.add("pwm");
      } else if (isActive) {
        ledEl.classList.add("on");
      }
    }
  }

  // Update pin indicator in SVG with mode color
  const pinIndicator = boardContainer?.querySelector(`#pin-${pinNum}`);
  if (pinIndicator) {
    // Remove old mode classes
    pinIndicator.classList.remove(
      "active",
      "digital-mode",
      "digital-out",
      "digital-in",
      "pwm-mode",
      "adc-mode",
      "i2c-mode",
      "uart-mode",
      "pin-high",
      "pin-low",
      "pin-pwm"
    );

    if (isActive) {
      pinIndicator.classList.add("active");
      if (mode === "pwm") {
        pinIndicator.classList.add("pwm-mode");
      } else if (mode === "IN") {
        pinIndicator.classList.add("digital-in");
      } else {
        pinIndicator.classList.add("digital-out");
      }
    }
  }

  // Store state
  pinStates[pinNum] = { value, mode };
}

/**
 * Clear all pin mode indicators without resetting logs.
 * Called when script exits naturally.
 */
function clearPinModes() {
  console.log("[Emulator] clearPinModes called");
  const allPinIndicators = boardContainer?.querySelectorAll(".pin-indicator");
  console.log("[Emulator] Found", allPinIndicators?.length, "pin indicators");
  let clearedCount = 0;
  if (allPinIndicators) {
    allPinIndicators.forEach((pinEl) => {
      const hadClass = pinEl.classList.contains("adc-mode") || 
                       pinEl.classList.contains("i2c-mode") ||
                       pinEl.classList.contains("uart-mode") ||
                       pinEl.classList.contains("pwm-mode") ||
                       pinEl.classList.contains("digital-out") ||
                       pinEl.classList.contains("digital-in");
      if (hadClass) {
        console.log("[Emulator] Clearing pin:", pinEl.id, "classes:", pinEl.className);
        clearedCount++;
      }
      pinEl.classList.remove(
        "active",
        "activity-flash",
        "digital-mode",
        "digital-out",
        "digital-in",
        "pwm-mode",
        "adc-mode",
        "i2c-mode",
        "uart-mode"
      );
    });
  }
  console.log("[Emulator] Cleared", clearedCount, "pins with mode classes");
}

function resetAll() {
  // Reset all pin indicators - clear all mode and activity classes
  const allPinIndicators = boardContainer?.querySelectorAll(".pin-indicator");
  if (allPinIndicators) {
    allPinIndicators.forEach((pinEl) => {
      pinEl.classList.remove(
        "active",
        "activity-flash",
        "digital-mode",
        "digital-out",
        "digital-in",
        "pwm-mode",
        "adc-mode",
        "i2c-mode",
        "uart-mode",
        "pin-high",
        "pin-low",
        "pin-pwm"
      );
    });
  }

  // Reset pin states tracking
  Object.keys(pinStates).forEach((pin) => {
    updatePinVisual(pin, 0, "digital");
  });

  // Reset onboard LEDs (Pico GP25 and ESP32 GPIO2)
  const ledElPico = boardContainer?.querySelector("#led-gp25");
  if (ledElPico) {
    ledElPico.classList.remove("on", "pwm");
  }
  const ledElEsp32 = boardContainer?.querySelector("#led-gpio2");
  if (ledElEsp32) {
    ledElEsp32.classList.remove("on", "pwm");
  }

  // Clear bus tracking
  Object.keys(i2cBuses).forEach((key) => delete i2cBuses[key]);
  Object.keys(uartBuses).forEach((key) => delete uartBuses[key]);
  Object.keys(adcPins).forEach((key) => delete adcPins[key]);

  // Reset logs
  if (eventLogEl) {
    eventLogEl.textContent = "";
  }
  if (consoleOutputEl) {
    consoleOutputEl.textContent = "";
  }
  if (i2cLogEl) {
    i2cLogEl.textContent = "";
  }
  if (i2cLastWriteEl) {
    i2cLastWriteEl.textContent = "-";
  }
  // Reset ADC panel
  if (adcLogEl) {
    adcLogEl.textContent = "";
  }
  if (adcLastReadEl) {
    adcLastReadEl.querySelector(".adc-pin").textContent = "-";
    adcLastReadEl.querySelector(".adc-value").textContent = "-";
    adcLastReadEl.querySelector(".adc-voltage").textContent = "-";
  }
}

// Update Play/Stop button appearance
function updatePlayStopButton() {
  if (playStopBtn) {
    if (isRunning && !isPaused) {
      // Running - show Stop
      playStopBtn.innerHTML = "⏹ Stop";
      playStopBtn.title = "Stop script";
    } else if (isRunning && isPaused) {
      // Paused - show Play (to resume)
      playStopBtn.innerHTML = "▶ Play";
      playStopBtn.title = "Resume script";
    } else {
      // Stopped - show Play (to start)
      playStopBtn.innerHTML = "▶ Play";
      playStopBtn.title = "Run script";
    }
  }
}

// Control button functions
function handlePlayStop() {
  if (isRunning && !isPaused) {
    // Currently running - Stop completely
    isRunning = false;
    isPaused = false;
    resetAll();
    logEvent("⏹ Stopped");
    vscode.postMessage({ type: "stop" });
    updatePlayStopButton();
  } else if (isRunning && isPaused) {
    // Currently paused - Resume
    isPaused = false;
    logEvent("▶ Resumed");
    vscode.postMessage({ type: "resume" });
    updatePlayStopButton();
  } else {
    // Not running - Start fresh
    isRunning = true;
    isPaused = false;
    logEvent("▶ Starting script");
    vscode.postMessage({ type: "play" });
    updatePlayStopButton();
  }
}

function handlePause() {
  if (isRunning && !isPaused) {
    isPaused = true;
    logEvent("⏸ Paused");
    vscode.postMessage({ type: "pause" });
    updatePlayStopButton();
  }
}

// Message handling
window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") {
    return;
  }

  switch (message.type) {
    case "init":
      // Initialize with board SVG
      if (message.boardSvg) {
        loadBoardSvg(message.boardSvg);
      }
      break;

    case "start":
      scriptNameEl.textContent = message.script || "-";
      isRunning = true;
      isPaused = false;
      updatePlayStopButton();
      logEvent(`Started script ${message.script}`);
      break;

    case "pin_update":
      updatePinVisual(message.pin, message.value, message.mode || "digital");
      logEvent(`Pin ${message.pin} -> ${message.value}`);
      break;

    case "pwm_update":
      updatePinVisual(message.pin, message.duty > 0, "pwm");
      logEvent(`PWM ${message.pin} freq=${message.freq} duty=${message.duty}`);
      break;

    case "pin_register":
      logEvent(`Registered pin ${message.pin} as ${message.mode || "OUTPUT"}`);
      break;

    case "i2c_init":
      // Store I2C bus pin mappings for activity visualization
      i2cBuses[message.id] = {
        scl: message.scl,
        sda: message.sda,
      };
      // Auto-expand I2C panel when I2C is detected
      if (i2cPanel) {
        i2cPanel.classList.remove("collapsed");
        updateToggleButton(i2cPanel);
      }
      logEvent(
        `I2C${message.id} initialized: SCL=GP${message.scl}, SDA=GP${message.sda}, freq=${message.freq}Hz`
      );
      break;

    case "uart_init":
      // Store UART bus pin mappings for activity visualization
      uartBuses[message.id] = {
        tx: message.tx,
        rx: message.rx,
      };
      logEvent(
        `UART${message.id} initialized: TX=GP${message.tx}, RX=GP${message.rx}, baud=${message.baudrate}`
      );
      break;

    case "uart_write":
      // Flash TX pin activity
      if (message.tx !== null && message.tx !== undefined) {
        flashPinActivity(message.tx, "uart");
      } else if (uartBuses[message.id]?.tx !== undefined) {
        flashPinActivity(uartBuses[message.id].tx, "uart");
      }
      logEvent(`UART${message.id} TX: ${message.data.length / 2} bytes`);
      break;

    // WiFi events
    case "wlan_init":
      logEvent(
        `📶 WiFi interface ${
          message.interface === 0 ? "STA" : "AP"
        } initialized`
      );
      break;

    case "wlan_active":
      logEvent(`📶 WiFi ${message.active ? "enabled" : "disabled"}`);
      break;

    case "wlan_connect":
      logEvent(`✅ WiFi connected to "${message.ssid}"`);
      appendConsole(`\n📶 WiFi connected to "${message.ssid}"\n`);
      appendConsole(`   IP: ${message.ip}\n`);
      appendConsole(`   Gateway: ${message.gateway}\n`);
      appendConsole(`   Subnet: ${message.subnet}\n\n`);
      break;

    case "wlan_disconnect":
      logEvent(`📶 WiFi disconnected`);
      break;

    case "wlan_scan":
      logEvent(`📶 WiFi scanning for networks...`);
      break;

    case "adc_init":
      // Track ADC pin
      adcPins[message.pin] = true;
      // Auto-expand ADC panel when ADC is detected
      if (adcPanel) {
        adcPanel.classList.remove("collapsed");
        updateToggleButton(adcPanel);
      }
      logEvent(`ADC initialized on GP${message.pin}`);
      break;

    case "adc_read":
      // Flash the ADC pin with activity indicator
      flashPinActivity(message.pin, "adc");

      // Update last read display
      if (adcLastReadEl) {
        adcLastReadEl.querySelector(
          ".adc-pin"
        ).textContent = `GP${message.pin}`;
        adcLastReadEl.querySelector(".adc-value").textContent = message.value;
        adcLastReadEl.querySelector(
          ".adc-voltage"
        ).textContent = `${message.voltage_mv}mV`;

        // Flash the reading panel
        adcLastReadEl.classList.remove("reading-active");
        void adcLastReadEl.offsetWidth; // Force reflow
        adcLastReadEl.classList.add("reading-active");
        setTimeout(() => adcLastReadEl.classList.remove("reading-active"), 300);
      }

      // Log the read
      if (adcLogEl) {
        const timestamp = new Date().toLocaleTimeString();
        adcLogEl.textContent =
          `[${timestamp}] GP${message.pin}: ${message.value} (${message.voltage_mv}mV)\n` +
          adcLogEl.textContent;
      }
      logEvent(`ADC GP${message.pin} read: ${message.value}`);
      break;

    case "exception":
      isRunning = false;
      isPaused = false;
      // Clear all pin mode indicators on exception
      clearPinModes();
      collapsePanels();
      updatePlayStopButton();
      logEvent(`❌ ${message.message || "Exception"}`);
      // Show hint if provided (for better user guidance)
      if (message.hint) {
        logEvent(`💡 Hint: ${message.hint}`);
        appendConsole(`\n💡 ${message.hint}\n`);
      }
      if (message.traceback) {
        logEvent(message.traceback);
        appendConsole(message.traceback + "\n");
      }
      break;

    case "complete":
    case "complete":
      console.log("[Emulator] Complete event received");
      isRunning = false;
      isPaused = false;
      // Clear all pin mode indicators when script completes
      clearPinModes();
      collapsePanels();
      updatePlayStopButton();
      logEvent("Execution completed");
      break;

    case "reset":
      isRunning = false;
      isPaused = false;
      resetAll();
      updatePlayStopButton();
      break;

    case "exit":
      console.log("[Emulator] Exit event received");
      isRunning = false;
      isPaused = false;
      // Clear all pin mode indicators on exit
      clearPinModes();
      collapsePanels();
      updatePlayStopButton();
      logEvent(`Script exited with code ${message.code}`);
      break;

    case "log":
      appendConsole(
        (message.text || message.message || message.data || "") + "\n"
      );
      break;

    case "i2c_write":
      // Flash SDA/SCL pins for activity
      if (message.scl !== null && message.scl !== undefined) {
        flashMultiplePins([message.scl, message.sda], "i2c");
      } else if (i2cBuses[message.id]) {
        flashMultiplePins(
          [i2cBuses[message.id].scl, i2cBuses[message.id].sda],
          "i2c"
        );
      }
      logI2C("WRITE", message.addr, message.data);
      if (i2cLastWriteEl && message.data) {
        let dataStr = message.data
          .map((b) => "0x" + b.toString(16).padStart(2, "0"))
          .join(" ");
        i2cLastWriteEl.textContent = dataStr;
      }
      logEvent(`I2C write to 0x${message.addr.toString(16)}`);
      break;

    case "i2c_read":
      // Flash SDA/SCL pins for activity
      if (message.scl !== null && message.scl !== undefined) {
        flashMultiplePins([message.scl, message.sda], "i2c");
      } else if (i2cBuses[message.id]) {
        flashMultiplePins(
          [i2cBuses[message.id].scl, i2cBuses[message.id].sda],
          "i2c"
        );
      }
      logI2C("READ", message.addr, message.data);
      logEvent(
        `I2C read from 0x${message.addr.toString(16)}: ${
          message.data.length
        } bytes`
      );
      break;

    case "i2c_write_mem":
      // Flash SDA/SCL pins for activity
      if (message.scl !== null && message.scl !== undefined) {
        flashMultiplePins([message.scl, message.sda], "i2c");
      } else if (i2cBuses[message.id]) {
        flashMultiplePins(
          [i2cBuses[message.id].scl, i2cBuses[message.id].sda],
          "i2c"
        );
      }
      logI2C("WRITE_MEM", message.addr, message.data, message.memaddr);
      if (i2cLastWriteEl && message.data) {
        let dataStr = message.data
          .map((b) => "0x" + b.toString(16).padStart(2, "0"))
          .join(" ");
        i2cLastWriteEl.textContent = dataStr;
      }
      logEvent(`I2C writeto_mem 0x${message.addr.toString(16)}`);
      break;

    case "i2c_read_mem":
      // Flash SDA/SCL pins for activity
      if (message.scl !== null && message.scl !== undefined) {
        flashMultiplePins([message.scl, message.sda], "i2c");
      } else if (i2cBuses[message.id]) {
        flashMultiplePins(
          [i2cBuses[message.id].scl, i2cBuses[message.id].sda],
          "i2c"
        );
      }
      logI2C("READ_MEM", message.addr, message.data, message.memaddr);
      logEvent(
        `I2C readfrom_mem 0x${message.addr.toString(16)}: ${
          message.data.length
        } bytes`
      );
      break;

    default:
      if (message.type) {
        logEvent(`Received ${message.type}`);
      }
      break;
  }
});

// Event listeners
if (clearLogBtn) {
  clearLogBtn.addEventListener("click", () => {
    eventLogEl.textContent = "";
  });
}

if (clearConsoleBtn) {
  clearConsoleBtn.addEventListener("click", () => {
    if (consoleOutputEl) {
      consoleOutputEl.textContent = "";
    }
  });
}

if (clearI2cBtn) {
  clearI2cBtn.addEventListener("click", () => {
    if (i2cLogEl) {
      i2cLogEl.textContent = "";
    }
    if (i2cLastWriteEl) {
      i2cLastWriteEl.textContent = "-";
    }
  });
}

// Panel toggle functionality
function setupPanelToggle(panel) {
  if (!panel) return;
  const toggleBtn = panel.querySelector(".panel-toggle");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const isCollapsed = panel.classList.toggle("collapsed");
    toggleBtn.textContent = isCollapsed ? "Expand" : "Collapse";
  });
}

// Helper to update toggle button text after auto-expand
function updateToggleButton(panel) {
  if (!panel) return;
  const toggleBtn = panel.querySelector(".panel-toggle");
  if (toggleBtn) {
    toggleBtn.textContent = panel.classList.contains("collapsed")
      ? "Expand"
      : "Collapse";
  }
}

// Collapse I2C and ADC panels (called on script end)
function collapsePanels() {
  if (i2cPanel) {
    i2cPanel.classList.add("collapsed");
    updateToggleButton(i2cPanel);
  }
  if (adcPanel) {
    adcPanel.classList.add("collapsed");
    updateToggleButton(adcPanel);
  }
}

// Initialize panel toggles
setupPanelToggle(i2cPanel);
setupPanelToggle(adcPanel);

// I2C hex validation and parsing
function parseHexBytes(hexStr) {
  if (!hexStr || !hexStr.trim()) {
    return {
      valid: false,
      bytes: [],
      error: "Enter hex bytes (e.g., 0x68 0x00 or 68 00)",
    };
  }

  // Split by whitespace or commas
  const parts = hexStr.trim().split(/[\s,]+/);
  const bytes = [];
  const errors = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Remove optional 0x prefix
    const cleanHex = part.replace(/^0x/i, "");

    // Validate hex format (1-2 hex digits)
    if (!/^[0-9a-fA-F]{1,2}$/.test(cleanHex)) {
      errors.push(`"${part}" is not valid hex`);
      continue;
    }

    const value = parseInt(cleanHex, 16);
    if (value < 0 || value > 255) {
      errors.push(`"${part}" out of range (0x00-0xFF)`);
      continue;
    }

    bytes.push(value);
  }

  if (errors.length > 0) {
    return { valid: false, bytes: [], error: errors.join(", ") };
  }

  if (bytes.length === 0) {
    return { valid: false, bytes: [], error: "No valid hex bytes found" };
  }

  return { valid: true, bytes, error: null };
}

// Format bytes for display
function formatHexBytes(bytes) {
  return bytes
    .map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

// Update I2C response status display
function updateI2cResponseStatus() {
  if (i2cResponseStatusEl) {
    if (i2cResponseOverride && i2cResponseOverride.length > 0) {
      i2cResponseStatusEl.textContent = `⚡ Override: ${formatHexBytes(
        i2cResponseOverride
      )}`;
      i2cResponseStatusEl.classList.add("active");
    } else {
      i2cResponseStatusEl.textContent = "Using auto-response (default)";
      i2cResponseStatusEl.classList.remove("active");
    }
  }
}

// Real-time validation as user types
if (i2cReadInputEl) {
  i2cReadInputEl.addEventListener("input", () => {
    const hexStr = i2cReadInputEl.value;
    if (!hexStr.trim()) {
      // Empty is OK - clear validation
      i2cReadInputEl.classList.remove("valid", "invalid");
      if (i2cValidationEl) {
        i2cValidationEl.textContent = "";
        i2cValidationEl.classList.remove("error", "success");
      }
      return;
    }

    const result = parseHexBytes(hexStr);
    if (result.valid) {
      i2cReadInputEl.classList.add("valid");
      i2cReadInputEl.classList.remove("invalid");
      if (i2cValidationEl) {
        i2cValidationEl.textContent = `✓ ${
          result.bytes.length
        } byte(s): ${formatHexBytes(result.bytes)}`;
        i2cValidationEl.classList.add("success");
        i2cValidationEl.classList.remove("error");
      }
    } else {
      i2cReadInputEl.classList.add("invalid");
      i2cReadInputEl.classList.remove("valid");
      if (i2cValidationEl) {
        i2cValidationEl.textContent = `✗ ${result.error}`;
        i2cValidationEl.classList.add("error");
        i2cValidationEl.classList.remove("success");
      }
    }
  });

  // Also submit on Enter
  i2cReadInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      i2cSetBtnEl?.click();
    }
  });
}

// Set button handler
if (i2cSetBtnEl) {
  i2cSetBtnEl.addEventListener("click", () => {
    const hexStr = i2cReadInputEl?.value || "";
    const result = parseHexBytes(hexStr);

    if (result.valid) {
      i2cResponseOverride = result.bytes;
      vscode.postMessage({ type: "i2c_read_response", data: result.bytes });
      logEvent(`Set I2C read response: ${formatHexBytes(result.bytes)}`);
      updateI2cResponseStatus();

      // Clear input and validation
      if (i2cReadInputEl) {
        i2cReadInputEl.value = "";
        i2cReadInputEl.classList.remove("valid", "invalid");
      }
      if (i2cValidationEl) {
        i2cValidationEl.textContent = "";
        i2cValidationEl.classList.remove("error", "success");
      }
    } else {
      // Show error
      if (i2cValidationEl) {
        i2cValidationEl.textContent = `✗ ${result.error}`;
        i2cValidationEl.classList.add("error");
        i2cValidationEl.classList.remove("success");
      }
    }
  });
}

// Clear response button
if (i2cClearResponseBtnEl) {
  i2cClearResponseBtnEl.addEventListener("click", () => {
    i2cResponseOverride = null;
    vscode.postMessage({ type: "i2c_clear_response" });
    logEvent("Cleared I2C response override - using auto-response");
    updateI2cResponseStatus();

    if (i2cReadInputEl) {
      i2cReadInputEl.value = "";
      i2cReadInputEl.classList.remove("valid", "invalid");
    }
    if (i2cValidationEl) {
      i2cValidationEl.textContent = "";
      i2cValidationEl.classList.remove("error", "success");
    }
  });
}

// Initialize I2C status
updateI2cResponseStatus();

// ADC panel event listeners
if (clearAdcBtn) {
  clearAdcBtn.addEventListener("click", () => {
    if (adcLogEl) {
      adcLogEl.textContent = "";
    }
    if (adcLastReadEl) {
      adcLastReadEl.querySelector(".adc-pin").textContent = "-";
      adcLastReadEl.querySelector(".adc-value").textContent = "-";
      adcLastReadEl.querySelector(".adc-voltage").textContent = "-";
    }
  });
}

// Helper function to update voltage preview
function updateAdcVoltagePreview(value) {
  if (adcVoltagePreviewEl) {
    const voltage = ((value * 3.3) / 65535).toFixed(2);
    adcVoltagePreviewEl.textContent = `≈ ${voltage}V`;
  }
}

// Helper function to update override status display
function updateAdcOverrideStatus() {
  if (adcOverrideStatusEl) {
    const overrideCount = Object.keys(adcOverrides).length;
    if (overrideCount > 0) {
      const pins = Object.entries(adcOverrides)
        .map(([pin, val]) => `GP${pin}=${val}`)
        .join(", ");
      adcOverrideStatusEl.textContent = `⚡ Active overrides: ${pins}`;
      adcOverrideStatusEl.classList.add("active");
    } else {
      adcOverrideStatusEl.textContent = "Using random noise (default)";
      adcOverrideStatusEl.classList.remove("active");
    }
  }
}

// Validate and clamp ADC value
function validateAdcValue(value) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return 32768; // Default to mid-range
  return Math.max(0, Math.min(65535, num));
}

// Sync slider and number input
if (adcSliderEl && adcValueInputEl) {
  adcSliderEl.addEventListener("input", () => {
    const value = parseInt(adcSliderEl.value, 10);
    adcValueInputEl.value = value;
    updateAdcVoltagePreview(value);
  });

  adcValueInputEl.addEventListener("input", () => {
    let value = validateAdcValue(adcValueInputEl.value);
    adcSliderEl.value = value;
    updateAdcVoltagePreview(value);
  });

  // Initialize preview
  updateAdcVoltagePreview(32768);
}

// ADC value input - set a specific ADC override
if (adcSetBtnEl) {
  adcSetBtnEl.addEventListener("click", () => {
    const pin = adcPinSelectEl?.value;
    let value = validateAdcValue(
      adcSliderEl?.value || adcValueInputEl?.value || "32768"
    );

    // Update input to show validated value
    if (adcValueInputEl) adcValueInputEl.value = value;
    if (adcSliderEl) adcSliderEl.value = value;

    if (pin) {
      adcOverrides[pin] = value;
      vscode.postMessage({ type: "adc_set_value", pin, value });
      const voltage = ((value * 3.3) / 65535).toFixed(2);
      logEvent(`Override ADC GP${pin} = ${value} (${voltage}V)`);
      updateAdcOverrideStatus();
    }
  });
}

// Clear override for selected pin
if (adcClearOverrideBtnEl) {
  adcClearOverrideBtnEl.addEventListener("click", () => {
    const pin = adcPinSelectEl?.value;
    if (pin && adcOverrides[pin] !== undefined) {
      delete adcOverrides[pin];
      vscode.postMessage({ type: "adc_clear_override", pin });
      logEvent(`Cleared override for GP${pin} - using random noise`);
      updateAdcOverrideStatus();
    }
  });
}

// Also allow Enter key in ADC value input
if (adcValueInputEl) {
  adcValueInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      adcSetBtnEl?.click();
    }
  });

  // Validate on blur
  adcValueInputEl.addEventListener("blur", () => {
    const value = validateAdcValue(adcValueInputEl.value);
    adcValueInputEl.value = value;
    if (adcSliderEl) adcSliderEl.value = value;
    updateAdcVoltagePreview(value);
  });
}

// Initialize override status
updateAdcOverrideStatus();

// Board selection
if (boardSelect) {
  boardSelect.addEventListener("change", () => {
    const board = boardSelect.value;
    currentBoard = board;
    updateAdcPinSelect(board);
    vscode.postMessage({ type: "board_change", board });
  });
}

// Initialize ADC pin select with current board
updateAdcPinSelect(currentBoard);

// Control button event listeners
if (playStopBtn) {
  playStopBtn.addEventListener("click", handlePlayStop);
}

if (pauseBtn) {
  pauseBtn.addEventListener("click", handlePause);
}

// Request board SVG on load
vscode.postMessage({ type: "ready" });
