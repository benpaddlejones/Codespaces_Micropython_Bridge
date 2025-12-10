/**
 * Plotter Controls Module
 * Handles plotter visibility and control operations.
 */

import * as store from "../state/store.js";
import {
  drawPlotter,
  clearPlotter as clearPlotterData,
  downloadPlotterPNG,
} from "./renderer.js";
import { fitTerminal } from "../terminal/setup.js";

/**
 * Toggle plotter visibility
 * @param {boolean} enabled - Whether plotter should be visible
 */
export function togglePlotter(enabled) {
  store.setPlotterEnabled(enabled);

  const mainContent = document.getElementById("main-content");
  const plotterContainer = document.getElementById("plotter-container");

  if (enabled) {
    mainContent?.classList.add("split-view");
    if (plotterContainer) plotterContainer.style.display = "flex";

    // Resize canvas after display change
    setTimeout(() => {
      drawPlotter();
      fitTerminal();
    }, 100);
  } else {
    mainContent?.classList.remove("split-view");
    if (plotterContainer) plotterContainer.style.display = "none";

    // Exit fullscreen if plotter is disabled
    if (store.isPlotterFullscreen()) {
      togglePlotterFullscreen();
    }
    setTimeout(() => fitTerminal(), 100);
  }
}

/**
 * Toggle plotter freeze state
 */
export function togglePlotterFreeze() {
  const frozen = !store.isPlotterFrozen();
  store.setPlotterFrozen(frozen);

  const freezeBtn = document.getElementById("plotterFreezeBtn");
  if (freezeBtn) {
    if (frozen) {
      freezeBtn.textContent = "▶️ Resume";
      freezeBtn.classList.add("btn-freeze-active");
    } else {
      freezeBtn.textContent = "⏸️ Freeze";
      freezeBtn.classList.remove("btn-freeze-active");
    }
  }
}

/**
 * Toggle plotter fullscreen mode
 */
export function togglePlotterFullscreen() {
  const fullscreen = !store.isPlotterFullscreen();
  store.setPlotterFullscreen(fullscreen);

  const plotterContainer = document.getElementById("plotter-container");
  const fullscreenBtn = document.getElementById("plotterFullscreenBtn");

  if (plotterContainer) {
    if (fullscreen) {
      plotterContainer.classList.add("fullscreen");
      if (fullscreenBtn) fullscreenBtn.textContent = "⛶ Exit";

      // Hide other elements
      const header = document.querySelector(".header");
      const inputBar = document.querySelector(".input-bar");
      const terminal = document.getElementById("terminal-container");

      if (header) header.style.display = "none";
      if (inputBar) inputBar.style.display = "none";
      if (terminal) terminal.style.display = "none";
    } else {
      plotterContainer.classList.remove("fullscreen");
      if (fullscreenBtn) fullscreenBtn.textContent = "⛶ Fullscreen";

      // Show other elements
      const header = document.querySelector(".header");
      const inputBar = document.querySelector(".input-bar");
      const terminal = document.getElementById("terminal-container");

      if (header) header.style.display = "";
      if (inputBar) inputBar.style.display = "";
      if (terminal) terminal.style.display = "";
    }

    // Redraw after resize
    setTimeout(() => {
      drawPlotter();
      fitTerminal();
    }, 100);
  }
}

/**
 * Clear plotter (wrapper)
 */
export function clearPlotter() {
  clearPlotterData();
}

/**
 * Download plotter (wrapper)
 */
export function downloadPlotter() {
  downloadPlotterPNG();
}

/**
 * Setup plotter event listeners
 */
export function setupPlotterEventListeners() {
  const plotterCheck = document.getElementById("plotterCheck");
  const plotterClearBtn = document.getElementById("plotterClearBtn");
  const plotterFreezeBtn = document.getElementById("plotterFreezeBtn");
  const plotterDownloadBtn = document.getElementById("plotterDownloadBtn");
  const plotterFullscreenBtn = document.getElementById("plotterFullscreenBtn");
  const plotterAutoScaleCheck = document.getElementById(
    "plotterAutoScaleCheck"
  );

  if (plotterCheck) {
    plotterCheck.addEventListener("change", (e) => {
      togglePlotter(e.target.checked);
    });
  }

  if (plotterClearBtn) {
    plotterClearBtn.addEventListener("click", clearPlotter);
  }

  if (plotterFreezeBtn) {
    plotterFreezeBtn.addEventListener("click", togglePlotterFreeze);
  }

  if (plotterDownloadBtn) {
    plotterDownloadBtn.addEventListener("click", downloadPlotter);
  }

  if (plotterFullscreenBtn) {
    plotterFullscreenBtn.addEventListener("click", togglePlotterFullscreen);
  }

  if (plotterAutoScaleCheck) {
    plotterAutoScaleCheck.addEventListener("change", (e) => {
      store.setPlotterAutoScale(e.target.checked);
      drawPlotter();
    });
  }

  // ESC key to exit fullscreen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && store.isPlotterFullscreen()) {
      togglePlotterFullscreen();
    }
  });

  // Resize plotter on window resize
  window.addEventListener("resize", () => {
    if (store.isPlotterEnabled()) {
      drawPlotter();
    }
  });
}
