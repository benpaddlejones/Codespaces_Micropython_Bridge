/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();

// Element references
const statusEl = document.getElementById("status");
const scriptNameEl = document.getElementById("scriptName");
const boardNameEl = document.getElementById("boardName");
const eventLogEl = document.getElementById("eventLog");
const resetBtn = document.getElementById("resetBtn");
const clearLogBtn = document.getElementById("clearLogBtn");
const boardContainer = document.getElementById("boardContainer");
const boardSelect = document.getElementById("boardSelect");

// Console panel elements
const consoleOutputEl = document.getElementById("consoleOutput");
const clearConsoleBtn = document.getElementById("clearConsoleBtn");

// I2C panel elements
const i2cLastWriteEl = document.getElementById("i2cLastWrite");
const i2cReadInputEl = document.getElementById("i2cReadInput");
const i2cLogEl = document.getElementById("i2cLog");
const clearI2cBtn = document.getElementById("clearI2cBtn");

// NeoPixel elements
const neopixelStrip = document.getElementById("neopixelStrip");
const neopixelLeds = document.getElementById("neopixelLeds");

// Pinout modal elements
const pinoutBtn = document.getElementById("pinoutBtn");
const pinoutModal = document.getElementById("pinoutModal");
const modalOverlay = document.getElementById("modalOverlay");
const closePinoutBtn = document.getElementById("closePinoutBtn");
const pinoutContent = document.getElementById("pinoutContent");
const pinoutBoardName = document.getElementById("pinoutBoardName");

// Pin state tracking
const pinStates = {};

// Board SVG content (will be set by extension)
let boardSvgContent = null;

function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  eventLogEl.textContent += `[${timestamp}] ${message}\n`;
  eventLogEl.scrollTop = eventLogEl.scrollHeight;
}

function updateStatus(text) {
  statusEl.textContent = text;
}

function appendConsole(text) {
  if (consoleOutputEl) {
    consoleOutputEl.textContent += text;
    consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
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

  // Handle special "LED" pin name (maps to GP25 on Pico)
  if (pinNum.toUpperCase() === "LED") {
    pinNum = "25";
  }

  // Update onboard LED (GP25)
  if (pinNum === "25") {
    const ledEl = boardContainer?.querySelector("#led-gp25");
    if (ledEl) {
      if (value) {
        ledEl.classList.add("on");
      } else {
        ledEl.classList.remove("on");
      }
    }
  }

  // Update pin indicator in SVG
  const pinIndicator = boardContainer?.querySelector(`#pin-${pinNum}`);
  if (pinIndicator) {
    pinIndicator.classList.add("active");
    pinIndicator.classList.remove("pin-high", "pin-low", "pin-pwm");

    if (mode === "pwm") {
      pinIndicator.classList.add("pin-pwm");
    } else if (value) {
      pinIndicator.classList.add("pin-high");
    } else {
      pinIndicator.classList.add("pin-low");
    }
  }

  // Store state
  pinStates[pinNum] = { value, mode };
}

// NeoPixel handling
function initNeopixels(count, pin) {
  if (!neopixelStrip || !neopixelLeds) {
    return;
  }

  neopixelStrip.style.display = "block";
  neopixelLeds.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const led = document.createElement("div");
    led.className = "neopixel-led";
    led.id = `neopixel-${i}`;
    led.style.backgroundColor = "#222";
    neopixelLeds.appendChild(led);
  }
}

function updateNeopixels(pixels) {
  if (!pixels || !neopixelLeds) {
    return;
  }

  pixels.forEach((color, i) => {
    const led = document.getElementById(`neopixel-${i}`);
    if (led) {
      const [r, g, b] = color;
      const brightness = Math.max(r, g, b);
      led.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      led.style.setProperty("--led-color", `rgb(${r}, ${g}, ${b})`);

      if (brightness > 10) {
        led.classList.add("lit");
      } else {
        led.classList.remove("lit");
      }
    }
  });
}

function resetAll() {
  // Reset pin states
  Object.keys(pinStates).forEach((pin) => {
    updatePinVisual(pin, 0, "digital");
  });

  // Reset onboard LED
  const ledEl = boardContainer?.querySelector("#led-gp25");
  if (ledEl) {
    ledEl.classList.remove("on");
  }

  // Reset NeoPixels
  if (neopixelStrip) {
    neopixelStrip.style.display = "none";
  }
  if (neopixelLeds) {
    neopixelLeds.innerHTML = "";
  }

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

  updateStatus("Idle");
}

// Pinout modal functions
function showPinoutModal() {
  if (pinoutModal) {
    pinoutModal.style.display = "flex";
    const currentBoard = boardSelect?.value || "pico";
    const boardNames = {
      pico: "Raspberry Pi Pico",
      "pico-w": "Raspberry Pi Pico W",
      pico2w: "Raspberry Pi Pico 2 W",
      esp32: "ESP32 DevKit",
    };
    if (pinoutBoardName) {
      pinoutBoardName.textContent = boardNames[currentBoard] || currentBoard;
    }
    // Request pinout SVG from extension
    vscode.postMessage({ type: "request_pinout", board: currentBoard });
  }
}

function hidePinoutModal() {
  if (pinoutModal) {
    pinoutModal.style.display = "none";
  }
}

function loadPinoutSvg(svgContent) {
  if (pinoutContent && svgContent) {
    pinoutContent.innerHTML = svgContent;
  } else if (pinoutContent) {
    pinoutContent.innerHTML =
      '<div class="pinout-loading">Pinout diagram not available for this board</div>';
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
      boardNameEl.textContent = message.board || "pico";
      updateStatus("Running");
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

    case "neopixel_init":
      initNeopixels(message.n, message.pin);
      logEvent(`NeoPixel initialized: ${message.n} LEDs on pin ${message.pin}`);
      break;

    case "neopixel_write":
      updateNeopixels(message.pixels);
      break;

    case "exception":
      updateStatus("Error");
      logEvent(message.message || "Exception");
      if (message.traceback) {
        logEvent(message.traceback);
        appendConsole(message.traceback + "\n");
      }
      break;

    case "complete":
      updateStatus("Completed");
      logEvent("Execution completed");
      break;

    case "reset":
      resetAll();
      break;

    case "exit":
      updateStatus(`Exited (${message.code})`);
      logEvent(`Script exited with code ${message.code}`);
      break;

    case "log":
      appendConsole(message.text || message.message || "");
      break;

    case "i2c_write":
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
      logI2C("READ", message.addr, message.data);
      logEvent(
        `I2C read from 0x${message.addr.toString(16)}: ${
          message.data.length
        } bytes`
      );
      break;

    case "i2c_write_mem":
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
      logI2C("READ_MEM", message.addr, message.data, message.memaddr);
      logEvent(
        `I2C readfrom_mem 0x${message.addr.toString(16)}: ${
          message.data.length
        } bytes`
      );
      break;

    case "pinout_svg":
      loadPinoutSvg(message.svg);
      break;

    default:
      if (message.type) {
        logEvent(`Received ${message.type}`);
      }
      break;
  }
});

// Event listeners
resetBtn.addEventListener("click", () => {
  vscode.postMessage({ type: "reset" });
  resetAll();
});

clearLogBtn.addEventListener("click", () => {
  eventLogEl.textContent = "";
});

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

// I2C read input - send hex bytes when user presses Enter
if (i2cReadInputEl) {
  i2cReadInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const hexStr = i2cReadInputEl.value.trim();
      if (hexStr) {
        const bytes = hexStr
          .split(/\s+/)
          .map((s) => parseInt(s.replace(/^0x/i, ""), 16))
          .filter((n) => !isNaN(n));
        if (bytes.length > 0) {
          vscode.postMessage({ type: "i2c_read_response", data: bytes });
          i2cReadInputEl.value = "";
          logEvent(
            `Set I2C read response: ${bytes
              .map((b) => "0x" + b.toString(16))
              .join(" ")}`
          );
        }
      }
    }
  });
}

// Board selection
if (boardSelect) {
  boardSelect.addEventListener("change", () => {
    const board = boardSelect.value;
    boardNameEl.textContent = board;
    vscode.postMessage({ type: "board_change", board });
  });
}

// Pinout modal event listeners
if (pinoutBtn) {
  pinoutBtn.addEventListener("click", showPinoutModal);
}

if (closePinoutBtn) {
  closePinoutBtn.addEventListener("click", hidePinoutModal);
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", hidePinoutModal);
}

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pinoutModal?.style.display === "flex") {
    hidePinoutModal();
  }
});

// Request board SVG on load
vscode.postMessage({ type: "ready" });
