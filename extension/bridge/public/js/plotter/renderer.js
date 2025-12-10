/**
 * Plotter Renderer Module
 * Handles canvas rendering for the plotter.
 */

import * as store from "../state/store.js";

// Color palette for plotter lines
const PLOTTER_COLORS = [
  "#4ec9b0", // teal
  "#ce9178", // orange
  "#dcdcaa", // yellow
  "#c586c0", // pink
  "#9cdcfe", // light blue
  "#4fc1ff", // cyan
  "#f44747", // red
  "#b5cea8", // green
];

// Plotter config
const PADDING = { top: 20, right: 60, bottom: 30, left: 60 };

/**
 * Draw the plotter
 */
export function drawPlotter() {
  const canvas = document.getElementById("plotterCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();

  // Set canvas size to match container
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const width = rect.width;
  const height = rect.height;
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  // Clear
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, width, height);

  // Get all values for scaling
  const plotterData = store.getPlotterData();
  let allValues = [];
  for (const values of Object.values(plotterData)) {
    allValues = allValues.concat(values);
  }

  if (allValues.length === 0) return;

  // Calculate Y range
  let minY = Math.min(...allValues);
  let maxY = Math.max(...allValues);

  const plotterState = store.getPlotterState();
  if (plotterState.autoScale) {
    // Add some padding
    const range = maxY - minY || 1;
    minY -= range * 0.1;
    maxY += range * 0.1;
  } else {
    // Fixed range if auto-scale is off
    minY = Math.min(minY, 0);
    maxY = Math.max(maxY, 100);
  }

  // Draw grid
  drawGrid(ctx, width, height, plotWidth, plotHeight, minY, maxY);

  // Draw data lines
  const labels = Object.keys(plotterData);
  const maxLen = Math.max(...labels.map((l) => plotterData[l].length));

  // Fixed number of points to display (creates natural scrolling)
  const displayPoints = store.getPlotterMaxPoints();
  const pixelsPerPoint = plotWidth / displayPoints;

  labels.forEach((label, labelIdx) => {
    const values = plotterData[label];
    const color = PLOTTER_COLORS[labelIdx % PLOTTER_COLORS.length];

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Calculate starting index (show most recent points)
    const startIdx = Math.max(0, values.length - displayPoints);

    for (let i = startIdx; i < values.length; i++) {
      // Map data point to screen position (scrolls naturally left to right)
      const dataIdx = i - startIdx;
      const x = PADDING.left + dataIdx * pixelsPerPoint;
      const y =
        PADDING.top + ((maxY - values[i]) / (maxY - minY || 1)) * plotHeight;

      if (i === startIdx) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  });

  // Update legend
  updateLegend(labels, plotterData);
}

/**
 * Draw grid lines and labels
 */
function drawGrid(ctx, width, height, plotWidth, plotHeight, minY, maxY) {
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;

  // Horizontal grid lines
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = PADDING.top + (plotHeight / ySteps) * i;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(width - PADDING.right, y);
    ctx.stroke();

    // Y axis labels
    const value = maxY - ((maxY - minY) / ySteps) * i;
    ctx.fillStyle = "#888";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(value.toFixed(1), PADDING.left - 8, y + 4);
  }
}

/**
 * Update legend with current values
 */
function updateLegend(labels, plotterData) {
  const legend = document.getElementById("plotterLegend");
  if (!legend) return;

  let html = "";

  labels.forEach((label, idx) => {
    const values = plotterData[label];
    const lastValue = values.length > 0 ? values[values.length - 1] : 0;
    const color = PLOTTER_COLORS[idx % PLOTTER_COLORS.length];

    html += `
      <div class="legend-item">
        <span class="legend-color" style="background-color: ${color}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-value">${lastValue.toFixed(2)}</span>
      </div>
    `;
  });

  legend.innerHTML = html;
}

/**
 * Clear plotter data and redraw
 */
export function clearPlotter() {
  store.clearPlotterData();
  const legend = document.getElementById("plotterLegend");
  if (legend) legend.innerHTML = "";
  drawPlotter();
}

/**
 * Download plotter as PNG
 */
export function downloadPlotterPNG() {
  const plotterCanvas = document.getElementById("plotterCanvas");
  if (!plotterCanvas) return;

  // Create a temporary canvas with dark background
  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");

  tempCanvas.width = plotterCanvas.width;
  tempCanvas.height = plotterCanvas.height;

  // Draw dark background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw the plotter canvas on top
  ctx.drawImage(plotterCanvas, 0, 0);

  // Create download link
  const link = document.createElement("a");
  link.download = `pico-plotter-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.png`;
  link.href = tempCanvas.toDataURL("image/png");
  link.click();
}

/**
 * Get plotter colors (for external use)
 */
export function getPlotterColors() {
  return PLOTTER_COLORS;
}
