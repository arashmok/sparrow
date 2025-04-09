// Selection menu for text selection and chat initiation

// Global variables
let selectionMenu = null;
let selectedText = '';

// Initialize when content script loads
function initSelectionMenu() {
  // Create menu element
  createSelectionMenu();
  
  // Add event listeners
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('click', hideSelectionMenu);
}

// Create the selection menu element
function createSelectionMenu() {
  // Check if menu already exists
  if (selectionMenu) return;
  
  // Create menu container
  selectionMenu = document.createElement('div');
  selectionMenu.className = 'sparrow-selection-menu';
  selectionMenu.style.cssText = `
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
  
  // Add buttons
  selectionMenu.innerHTML = `
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
  
  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  
  // Add event listeners for buttons
  selectionMenu.querySelector('#sparrow-ask-button').addEventListener('click', (e) => {
    e.stopPropagation();
    initiateChat('ask');
  });
  
  selectionMenu.querySelector('#sparrow-explain-button').addEventListener('click', (e) => {
    e.stopPropagation();
    initiateChat('explain');
  });
  
  // Add to document
  document.body.appendChild(selectionMenu);
}

// Handle text selection
function handleTextSelection(e) {
  // Get selected text
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  // Update global selected text
  selectedText = text;
  
  // If no text is selected or too short, hide menu
  if (!text || text.length < 10) {
    hideSelectionMenu();
    return;
  }
  
  // Position menu near selection
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Show menu above the selection
  selectionMenu.style.display = 'block';
  selectionMenu.style.top = `${window.scrollY + rect.top - 50}px`;
  selectionMenu.style.left = `${window.scrollX + (rect.left + rect.right) / 2 - selectionMenu.offsetWidth / 2}px`;
}

// Hide selection menu
function hideSelectionMenu(e) {
  if (!selectionMenu) return;
  
  // Don't hide if click is on the menu
  if (e && selectionMenu.contains(e.target)) return;
  
  selectionMenu.style.display = 'none';
}

// Initiate chat with the selected text
function initiateChat(action) {
  if (!selectedText) return;
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'open-chat-panel',
    tabId: null, // This will be handled in background script
    generatedText: selectedText,
    chatAction: action
  });
  
  // Hide menu
  hideSelectionMenu();
}

// Initialize when content script loads
initSelectionMenu();