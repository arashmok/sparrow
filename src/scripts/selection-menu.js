/**
 * selection-menu.js - Handles text selection and context menu for the Sparrow extension
 * 
 * This script:
 * - Creates and manages a floating menu when text is selected on a webpage
 * - Allows users to ask questions about or get explanations for selected text
 * - Communicates with the background script to initiate chat in the side panel
 */

// =====================================================================================
// GLOBAL VARIABLES
// =====================================================================================

// Reference to the selection menu DOM element
let selectionMenu = null;

// Stores the currently selected text
let selectedText = '';

// CSS styles for the selection menu and animation
const MENU_STYLES = `
  position: absolute;
  display: none;
  z-index: 999999;
  background-color: #4285f4;
  border-radius: 18px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
  animation: fade-in 0.2s ease-out;
`;

// CSS for the animation
const ANIMATION_STYLES = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// HTML template for the selection menu
const MENU_HTML = `
  <div class="sparrow-menu-buttons" style="display: flex; align-items: center; height: 36px;">
    <button class="sparrow-menu-button" id="sparrow-ask-button" style="
      background: none;
      border: none;
      color: white;
      padding: 0 15px;
      font-size: 13px;
      cursor: pointer;
      height: 100%;
    ">Ask</button>
    <div style="width: 1px; height: 20px; background-color: rgba(255, 255, 255, 0.5);"></div>
    <button class="sparrow-menu-button" id="sparrow-explain-button" style="
      background: none;
      border: none;
      color: white;
      padding: 0 15px;
      font-size: 13px;
      cursor: pointer;
      height: 100%;
    ">Explain</button>
  </div>
`;

// =====================================================================================
// INITIALIZATION
// =====================================================================================

/**
 * Initialize the selection menu system
 * Sets up the menu element and event listeners
 */
function initSelectionMenu() {
  // Create the selection menu DOM element
  createSelectionMenu();
  
  // Add global event listeners
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('click', hideSelectionMenu);
}

/**
 * Creates the selection menu DOM element and adds it to the document
 */
function createSelectionMenu() {
  // Return early if menu already exists
  if (selectionMenu) return;
  
  // Create menu container
  selectionMenu = document.createElement('div');
  selectionMenu.className = 'sparrow-selection-menu';
  selectionMenu.style.cssText = MENU_STYLES;
  
  // Add menu content
  selectionMenu.innerHTML = MENU_HTML;
  
  // Add animation styles to document
  const style = document.createElement('style');
  style.textContent = ANIMATION_STYLES;
  document.head.appendChild(style);
  
  // Add event listeners for menu buttons
  selectionMenu.querySelector('#sparrow-ask-button').addEventListener('click', (e) => {
    e.stopPropagation();
    initiateChat('ask');
  });
  
  selectionMenu.querySelector('#sparrow-explain-button').addEventListener('click', (e) => {
    e.stopPropagation();
    initiateChat('explain');
  });
  
  // Add menu to document
  document.body.appendChild(selectionMenu);
}

// =====================================================================================
// EVENT HANDLERS
// =====================================================================================

/**
 * Handles text selection events
 * Shows the menu when text is selected
 * 
 * @param {MouseEvent} e - The mouseup event
 */
function handleTextSelection(e) {
  // Get the selected text
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  // Update global selected text variable
  selectedText = text;
  
  // If no text is selected or text is too short, hide menu
  if (!text || text.length < 10) {
    hideSelectionMenu();
    return;
  }
  
  // Position menu near selection
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Show menu above the selection
  selectionMenu.style.display = 'block';
  
  // Position menu centered above the selection
  selectionMenu.style.top = `${window.scrollY + rect.top - 50}px`;
  selectionMenu.style.left = `${window.scrollX + (rect.left + rect.right) / 2 - selectionMenu.offsetWidth / 2}px`;
}

/**
 * Hides the selection menu
 * Called when clicking outside the menu or when selection is cleared
 * 
 * @param {MouseEvent|null} e - The click event (optional)
 */
function hideSelectionMenu(e) {
  if (!selectionMenu) return;
  
  // Don't hide if click is on the menu
  if (e && selectionMenu.contains(e.target)) return;
  
  // Hide the menu
  selectionMenu.style.display = 'none';
}

// =====================================================================================
// CHAT FUNCTIONALITY
// =====================================================================================

/**
 * Initiates a chat with the selected text
 * Sends a message to background script to open chat panel
 * 
 * @param {string} action - The action type ('ask' or 'explain')
 */
function initiateChat(action) {
  // Do nothing if no text is selected
  if (!selectedText) return;
  
  // Send message to background script to open chat panel
  chrome.runtime.sendMessage({
    action: 'open-chat-panel',
    tabId: null, // This will be handled in background script
    generatedText: selectedText,
    chatAction: action
  });
  
  // Hide the menu after initiating chat
  hideSelectionMenu();
}

// =====================================================================================
// INITIALIZE THE SYSTEM
// =====================================================================================

// Initialize when script loads
initSelectionMenu();