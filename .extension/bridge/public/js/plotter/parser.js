/**
 * Plotter Parser Module
 * Parses serial data for plottable values.
 */

import * as store from "../state/store.js";
import { drawPlotter } from "./renderer.js";

/**
 * Parse serial data for plottable values
 * @param {string} data - Raw serial data
 */
export function parseSerialForPlotter(data) {
  // Don't add new data if frozen
  if (store.isPlotterFrozen()) return;

  // Add to line buffer
  let lineBuffer = store.getPlotterLineBuffer();
  lineBuffer += data;

  // Process complete lines
  const lines = lineBuffer.split(/[\r\n]+/);

  // Keep the last incomplete line in buffer
  store.setPlotterLineBuffer(lines.pop() || "");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try to parse different formats:
    // 1. Single value: "123" or "123.45"
    // 2. Multiple comma-separated: "1,2,3" or "1.0, 2.0, 3.0"
    // 3. Labeled: "temp:25.5" or "temp:25.5,humidity:60"
    // 4. Space-separated: "1 2 3"

    const values = parseLine(trimmed);

    // Add values to plotter data
    for (const [label, value] of Object.entries(values)) {
      store.addPlotterValue(label, value);
    }
  }

  // Redraw if we have data
  const plotterData = store.getPlotterData();
  if (Object.keys(plotterData).length > 0) {
    drawPlotter();
  }
}

/**
 * Parse a single line for plottable values
 * @param {string} line - Line to parse
 * @returns {Object} Object with label:value pairs
 */
function parseLine(line) {
  const values = {};

  // Check for labeled format (contains ":")
  if (line.includes(":")) {
    const parts = line.split(/[,\s]+/);
    for (const part of parts) {
      const [label, val] = part.split(":");
      if (label && val) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          values[label.trim()] = num;
        }
      }
    }
  } else {
    // Try comma/tab/space separated values
    // Split by comma, tab, or multiple spaces (like Arduino Serial Plotter format)
    const parts = line
      .split(/[,\t]+|\s{2,}/)
      .map((p) => p.trim())
      .filter((p) => p);

    // Check if this might be a header line (contains non-numeric text)
    const hasNonNumeric = parts.some((part) => isNaN(parseFloat(part)));

    if (hasNonNumeric && parts.length > 1) {
      // This looks like a header line - store the labels
      store.setPlotterLabels(parts);
      return {}; // Don't plot this line
    }

    // Parse numeric values
    const labels = store.getPlotterLabels();
    let idx = 0;
    for (const part of parts) {
      const num = parseFloat(part);
      if (!isNaN(num)) {
        // Use stored label if available, otherwise use ch1, ch2, etc.
        const label =
          labels && labels[idx]
            ? labels[idx]
            : parts.length === 1
            ? "value"
            : `ch${idx + 1}`;
        values[label] = num;
        idx++;
      }
    }
  }

  return values;
}
