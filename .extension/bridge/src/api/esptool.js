/**
 * ESPTool API Routes
 * Handles ESP32 flashing tools integration
 */

const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Firmware download directory
const FIRMWARE_DIR = path.join(__dirname, "../../firmware_downloads");

// Ensure firmware directory exists
if (!fs.existsSync(FIRMWARE_DIR)) {
  fs.mkdirSync(FIRMWARE_DIR, { recursive: true });
}

/**
 * Check if esptool is installed
 * GET /api/esptool/status
 */
router.get("/esptool/status", async (req, res) => {
  try {
    const result = await execPromise(
      "esptool.py version 2>&1 || esptool version 2>&1 || echo 'not found'"
    );
    const installed =
      !result.includes("not found") && !result.includes("command not found");

    let version = null;
    if (installed) {
      const match = result.match(/esptool(?:\.py)?\s+v?([\d.]+)/i);
      version = match ? match[1] : "unknown";
    }

    res.json({
      installed,
      version,
      message: installed
        ? `esptool v${version} is available`
        : "esptool not installed",
    });
  } catch (err) {
    res.json({
      installed: false,
      version: null,
      message: "esptool not installed",
    });
  }
});

/**
 * Install esptool via pip
 * POST /api/esptool/install
 */
router.post("/esptool/install", async (req, res) => {
  console.log("[esptool] Installing esptool...");

  try {
    const result = await execPromise(
      "pip3 install esptool 2>&1 || pip install esptool 2>&1"
    );
    console.log("[esptool] Install result:", result);

    // Verify installation
    const verifyResult = await execPromise(
      "esptool.py version 2>&1 || esptool version 2>&1"
    );
    const match = verifyResult.match(/esptool(?:\.py)?\s+v?([\d.]+)/i);
    const version = match ? match[1] : "unknown";

    res.json({
      success: true,
      version,
      message: `esptool v${version} installed successfully`,
    });
  } catch (err) {
    console.error("[esptool] Install error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      message: "Failed to install esptool. Try manually: pip install esptool",
    });
  }
});

/**
 * Get flash command for ESP32
 * GET /api/esptool/flash-command/:chip
 */
router.get("/esptool/flash-command/:chip", (req, res) => {
  const { chip } = req.params;
  const { filename, port } = req.query;

  const chipConfig = {
    esp32: { offset: "0x1000" },
    esp32s2: { offset: "0x1000" },
    esp32s3: { offset: "0" },
    esp32c3: { offset: "0" },
    esp8266: { offset: "0" },
  };

  const config = chipConfig[chip];
  if (!config) {
    return res.status(400).json({
      error: `Unknown chip: ${chip}. Supported: ${Object.keys(chipConfig).join(
        ", "
      )}`,
    });
  }

  const firmwarePath = filename
    ? path.join(FIRMWARE_DIR, filename)
    : "<firmware.bin>";

  const portArg = port ? `--port ${port} ` : "";

  const commands = {
    // Full erase and flash (recommended for clean install)
    eraseAndFlash: `esptool.py --chip ${chip} ${portArg}erase_flash && esptool.py --chip ${chip} ${portArg}write_flash -z ${config.offset} "${firmwarePath}"`,

    // Flash only (keeps existing data)
    flashOnly: `esptool.py --chip ${chip} ${portArg}write_flash -z ${config.offset} "${firmwarePath}"`,

    // Erase only
    eraseOnly: `esptool.py --chip ${chip} ${portArg}erase_flash`,

    // Read chip info
    chipInfo: `esptool.py --chip ${chip} ${portArg}chip_id`,
  };

  res.json({
    chip,
    offset: config.offset,
    commands,
    firmwarePath: filename ? firmwarePath : null,
  });
});

/**
 * Get ESP32 bootloader instructions
 * GET /api/esptool/instructions/:chip
 */
router.get("/esptool/instructions/:chip", (req, res) => {
  const { chip } = req.params;

  const instructions = {
    general: [
      "─".repeat(50),
      "ESP32 Flash Instructions",
      "─".repeat(50),
      "",
      "1. CLOSE all serial connections (disconnect in bridge)",
      "",
      "2. Put device in BOOTLOADER MODE:",
      "   Method A: Hold BOOT → Press RESET → Release BOOT",
      "   Method B: Hold BOOT → Plug in USB → Release BOOT",
      "   (Some boards auto-detect bootloader mode)",
      "",
      "3. Find your serial port:",
      "   Linux:   /dev/ttyUSB0 or /dev/ttyACM0",
      "   macOS:   /dev/cu.usbserial-*",
      "   Windows: COM3, COM4, etc.",
      "",
      "4. Run the flash command",
      "",
      "5. Press RESET after flashing completes",
      "─".repeat(50),
    ],
    tips: [
      "• If flash fails, try lower baud: --baud 115200",
      "• For stubborn boards, hold BOOT during entire flash",
      "• Use 'esptool.py chip_id' to verify connection",
    ],
  };

  // Chip-specific notes
  const chipNotes = {
    esp32: ["• Original ESP32 uses offset 0x1000"],
    esp32s2: ["• ESP32-S2 uses offset 0x1000", "• Has native USB support"],
    esp32s3: [
      "• ESP32-S3 uses offset 0x0",
      "• Has native USB support",
      "• May appear as USB CDC device",
    ],
    esp32c3: ["• ESP32-C3 uses offset 0x0", "• RISC-V architecture"],
    esp8266: [
      "• ESP8266 uses offset 0x0",
      "• Older chip, limited memory",
      "• Some boards need GPIO0 grounded",
    ],
  };

  res.json({
    chip,
    instructions: instructions.general,
    tips: instructions.tips,
    chipNotes: chipNotes[chip] || [],
  });
});

/**
 * List downloaded firmware files
 * GET /api/esptool/downloads
 */
router.get("/esptool/downloads", (req, res) => {
  try {
    if (!fs.existsSync(FIRMWARE_DIR)) {
      return res.json({ files: [], directory: FIRMWARE_DIR });
    }

    const files = fs.readdirSync(FIRMWARE_DIR).map((filename) => {
      const filepath = path.join(FIRMWARE_DIR, filename);
      const stats = fs.statSync(filepath);
      return {
        filename,
        filepath,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        modified: stats.mtime,
      };
    });

    res.json({ files, directory: FIRMWARE_DIR });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete a downloaded firmware file
 * DELETE /api/esptool/downloads/:filename
 */
router.delete("/esptool/downloads/:filename", (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(FIRMWARE_DIR, filename);

  // Security: ensure we're only deleting from firmware dir
  if (!filepath.startsWith(FIRMWARE_DIR)) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ success: true, message: `Deleted ${filename}` });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Helper Functions ===

/**
 * Execute a command and return output
 */
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error && !stdout && !stderr) {
        reject(error);
      } else {
        resolve(stdout + stderr);
      }
    });
  });
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

module.exports = router;
