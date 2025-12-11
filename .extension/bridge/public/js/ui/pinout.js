/**
 * Pinout Viewer Module
 *
 * Handles the display of the Raspberry Pi Pico pinout diagram
 * with zoom and pan functionality.
 */

import { addListener, getById } from "./dom.js";

// State for zoom/pan
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const ZOOM_SPEED = 0.1;

/**
 * Get DOM elements
 */
function getElements() {
  return {
    modal: getById("pinoutModal"),
    image: getById("pinoutImage"),
    closeBtn: getById("pinoutCloseBtn"),
    resetBtn: getById("pinoutResetBtn"),
    body: document.querySelector(".pinout-modal-body"),
  };
}

/**
 * Reset the view to default
 */
function resetView() {
  scale = 1;
  translateX = 0;
  translateY = 0;
  applyTransform();
}

/**
 * Apply the current transform to the image
 */
function applyTransform() {
  const { image } = getElements();
  if (image) {
    image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }
}

/**
 * Show the pinout modal
 */
export function showPinout() {
  const { modal } = getElements();
  if (modal) {
    modal.style.display = "flex";
    resetView();
  }
}

/**
 * Hide the pinout modal
 */
export function hidePinout() {
  const { modal } = getElements();
  if (modal) {
    modal.style.display = "none";
  }
}

/**
 * Handle mouse wheel for zoom
 */
function handleWheel(e) {
  e.preventDefault();

  const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));

  if (newScale !== scale) {
    // Zoom towards cursor position
    const { body, image } = getElements();
    if (body && image) {
      const rect = body.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      const scaleDiff = newScale - scale;
      translateX -= (mouseX * scaleDiff) / scale;
      translateY -= (mouseY * scaleDiff) / scale;
    }

    scale = newScale;
    applyTransform();
  }
}

/**
 * Handle mouse down for drag start
 */
function handleMouseDown(e) {
  if (e.button === 0) {
    // Left click only
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
  }
}

/**
 * Handle mouse move for dragging
 */
function handleMouseMove(e) {
  if (isDragging) {
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  }
}

/**
 * Handle mouse up for drag end
 */
function handleMouseUp() {
  isDragging = false;
}

/**
 * Handle keyboard events
 */
function handleKeyDown(e) {
  const { modal } = getElements();
  if (modal && modal.style.display !== "none") {
    if (e.key === "Escape") {
      hidePinout();
    }
  }
}

/**
 * Initialize pinout viewer event listeners
 */
export function initPinoutViewer() {
  const { modal, body, closeBtn, resetBtn } = getElements();

  // Open button
  addListener("pinoutBtn", "click", showPinout);

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener("click", hidePinout);
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", resetView);
  }

  // Close on backdrop click
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hidePinout();
      }
    });
  }

  // Zoom with mouse wheel
  if (body) {
    body.addEventListener("wheel", handleWheel, { passive: false });
    body.addEventListener("mousedown", handleMouseDown);
    body.addEventListener("mousemove", handleMouseMove);
    body.addEventListener("mouseup", handleMouseUp);
    body.addEventListener("mouseleave", handleMouseUp);
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyDown);
}
