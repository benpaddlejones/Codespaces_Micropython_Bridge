/**
 * DOM Utilities Module
 * Provides helper functions for DOM manipulation.
 */

/**
 * Get element by ID with type safety
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getById(id) {
  return document.getElementById(id);
}

/**
 * Add event listener to element by ID
 * @param {string} id - Element ID
 * @param {string} event - Event name
 * @param {function} handler - Event handler
 */
export function addListener(id, event, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener(event, handler);
  }
}

/**
 * Set element disabled state
 * @param {string} id - Element ID
 * @param {boolean} disabled - Disabled state
 */
export function setDisabled(id, disabled) {
  const element = document.getElementById(id);
  if (element) {
    element.disabled = disabled;
  }
}

/**
 * Set element display
 * @param {string} id - Element ID
 * @param {string} display - Display value
 */
export function setDisplay(id, display) {
  const element = document.getElementById(id);
  if (element) {
    element.style.display = display;
  }
}

/**
 * Add class to element
 * @param {string} id - Element ID
 * @param {string} className - Class to add
 */
export function addClass(id, className) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.add(className);
  }
}

/**
 * Remove class from element
 * @param {string} id - Element ID
 * @param {string} className - Class to remove
 */
export function removeClass(id, className) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.remove(className);
  }
}

/**
 * Set element text content
 * @param {string} id - Element ID
 * @param {string} text - Text content
 */
export function setText(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Set element value
 * @param {string} id - Element ID
 * @param {string} value - Value
 */
export function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

/**
 * Get element value
 * @param {string} id - Element ID
 * @returns {string}
 */
export function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}
