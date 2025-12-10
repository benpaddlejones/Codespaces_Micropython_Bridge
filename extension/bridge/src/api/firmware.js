/**
 * Firmware API Routes
 * Handles firmware version fetching from micropython.org
 *
 * Separated concerns:
 * - This module: Firmware version lookup and download URLs
 * - esptool.js: ESP32 flashing tools
 */

const express = require("express");
const https = require("https");
const router = express.Router();

// Cache for firmware URLs (avoid hammering micropython.org)
const firmwareCache = new Map();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch the latest firmware URL for a board
 * GET /api/firmware/latest/:board
 */
router.get("/firmware/latest/:board", async (req, res) => {
  const { board } = req.params;

  // Board to download page mapping
  const boardPages = {
    pico: { page: "RPI_PICO", ext: ".uf2" },
    pico_w: { page: "RPI_PICO_W", ext: ".uf2" },
    pico2: { page: "RPI_PICO2", ext: ".uf2" },
    rp2040: { page: "RPI_PICO", ext: ".uf2" },
    rp2350: { page: "RPI_PICO2", ext: ".uf2" },
    esp32: { page: "ESP32_GENERIC", ext: ".bin" },
    esp32s2: { page: "ESP32_GENERIC_S2", ext: ".bin" },
    esp32s3: { page: "ESP32_GENERIC_S3", ext: ".bin" },
    esp32c3: { page: "ESP32_GENERIC_C3", ext: ".bin" },
    esp8266: { page: "ESP8266_GENERIC", ext: ".bin" },
    tinys3: { page: "ESP32_GENERIC_S3", ext: ".bin" },
  };

  const boardInfo = boardPages[board];
  if (!boardInfo) {
    return res.status(400).json({ error: "Unknown board type" });
  }

  // Check cache
  const cacheKey = boardInfo.page;
  const cached = firmwareCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[firmware] Cache hit for ${board}`);
    return res.json(cached.data);
  }

  try {
    const downloadPageUrl = `https://micropython.org/download/${boardInfo.page}/`;
    console.log(`[firmware] Fetching ${downloadPageUrl}`);

    const html = await fetchPage(downloadPageUrl);

    // Parse the HTML to find firmware links
    const firmwareRegex = new RegExp(
      `href="(/resources/firmware/${
        boardInfo.page
      }-\\d+-v[\\d.]+${boardInfo.ext.replace(".", "\\.")})"`,
      "g"
    );

    const matches = [...html.matchAll(firmwareRegex)];

    if (matches.length === 0) {
      return res.status(404).json({ error: "No firmware found" });
    }

    // First match is typically the latest stable release
    const latestPath = matches[0][1];
    const latestUrl = `https://micropython.org${latestPath}`;
    const filename = latestPath.split("/").pop();

    // Extract version from filename
    const versionMatch = filename.match(/v([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : "unknown";

    // Extract date from filename
    const dateMatch = filename.match(/(\d{8})/);
    const buildDate = dateMatch ? dateMatch[1] : null;

    const result = {
      board,
      url: latestUrl,
      filename,
      version,
      buildDate,
      downloadPage: downloadPageUrl,
      isESP: boardInfo.ext === ".bin",
    };

    // Cache the result
    firmwareCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });

    console.log(`[firmware] Found latest: ${filename}`);
    res.json(result);
  } catch (err) {
    console.error(`[firmware] Error fetching firmware info:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Helper Functions ===

/**
 * Fetch a page via HTTPS
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          return fetchPage(response.headers.location)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => resolve(data));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

module.exports = router;
