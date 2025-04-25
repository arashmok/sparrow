// This content script runs on OpenWebUI to handle the import
console.log("OpenWebUI import content script loaded");

// Configuration
const CONFIG = {
  waitTimes: {
    domReady: 1800,
    betweenMessages: 1200,
    responseGeneration: 2500
  },
  selectors: {
    // Add more specific selectors based on OpenWebUI's structure
    inputElements: [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="chat" i]',
      'textarea[placeholder*="send" i]',
      'textarea[placeholder*="type" i]',
      'textarea:not([disabled])',
      '[contenteditable="true"]',
      '.chat-input',
      '.message-input',
      'form textarea'
    ],
    chatContainers: [
      '.chat-container',
      '.conversation-container',
      '.message-list',
      '[role="log"]',
      '[aria-live="polite"]'
    ]
  }
};

// DOM Ready handler with improved timing
window.addEventListener('load', function() {
  // Give extra time for dynamic content to load
  setTimeout(initializeImport, CONFIG.waitTimes.domReady);
});

// Initialize the import functionality
function initializeImport() {
  try {
    const url = new URL(window.location.href);
    
    // Check if this is a Sparrow export
    if (url.searchParams.has('sparrow-export') && url.searchParams.get('sparrow-export') === 'true') {
      console.log("Detected Sparrow export in URL parameters");
      
      // Get the conversation data from storage
      chrome.storage.local.get(['openwebui_export_data'], function(result) {
        if (result && result.openwebui_export_data && result.openwebui_export_data.messages) {
          // Create the import button
          displayImportButton(result.openwebui_export_data);
          
          // Analyze the DOM to better understand OpenWebUI's structure
          analyzeOpenWebUIDOM();
          
          // Set up mutation observers to track UI changes
          setupMutationObservers();
        } else {
          console.error("No valid conversation data found in storage");
        }
      });
    }
    
    // Also check for other import methods
    checkForOtherImportMethods();
  } catch (e) {
    console.error("Error initializing import:", e);
  }
}

// Check for other import methods (localStorage, events, etc.)
function checkForOtherImportMethods() {
  // Check localStorage as a backup method
  try {
    const title = localStorage.getItem('sparrow_export_title');
    if (title) {
      console.log("Found export title in localStorage:", title);
      
      // Request the conversation data from the extension
      chrome.runtime.sendMessage({
        action: "get-openwebui-export-data"
      }, function(response) {
        if (response && response.data) {
          console.log("Received conversation data from storage");
          displayImportButton(response.data);
        }
      });
      
      // Clear it after use
      localStorage.removeItem('sparrow_export_title');
    }
  } catch (e) {
    console.error("Error checking localStorage:", e);
  }
  
  // Add a listener for our custom event
  document.addEventListener('sparrow-export-ready', function(e) {
    console.log("Received sparrow-export-ready event", e.detail);
    if (e.detail && e.detail.title) {
      chrome.storage.local.get(['openwebui_export_data'], function(result) {
        if (result && result.openwebui_export_data) {
          displayImportButton(result.openwebui_export_data);
        }
      });
    }
  });
}

// Function to analyze the DOM structure of OpenWebUI
function analyzeOpenWebUIDOM() {
  console.log("Analyzing OpenWebUI DOM structure...");
  
  // Look for messaging components
  CONFIG.selectors.chatContainers.forEach(selector => {
    const containers = document.querySelectorAll(selector);
    if (containers.length > 0) {
      console.log(`Found ${containers.length} potential chat containers with selector: ${selector}`);
    }
  });
  
  // Look for input elements
  const inputElement = findInputElement();
  if (inputElement) {
    console.log("Found input element:", inputElement);
    console.log("Input element properties:", {
      tagName: inputElement.tagName,
      id: inputElement.id,
      className: inputElement.className,
      placeholder: inputElement.placeholder,
      contentEditable: inputElement.contentEditable
    });
  }
  
  // Look for submit/send buttons
  const sendButton = findSendButton();
  if (sendButton) {
    console.log("Found send button:", sendButton);
    console.log("Send button properties:", {
      tagName: sendButton.tagName,
      id: sendButton.id,
      className: sendButton.className,
      textContent: sendButton.textContent.trim()
    });
  }
  
  // Look for new chat button
  const newChatButton = findNewChatButton();
  if (newChatButton) {
    console.log("Found new chat button:", newChatButton);
  }
}

// Set up mutation observers to track UI changes
function setupMutationObservers() {
  // Watch for changes in the chat container
  CONFIG.selectors.chatContainers.forEach(selector => {
    const containers = document.querySelectorAll(selector);
    containers.forEach(container => {
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            console.log("Chat container updated with new content");
          }
        }
      });
      
      observer.observe(container, { childList: true, subtree: true });
    });
  });
}

// Function to display the import button
function displayImportButton(conversation) {
  // Remove any existing button first
  const existingButton = document.getElementById('sparrow-import-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Create a floating button
  const importButton = document.createElement('div');
  importButton.id = 'sparrow-import-button';
  importButton.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #2980b9;
    color: white;
    padding: 12px 20px;
    border-radius: 50px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  `;
  
  importButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
    Import Sparrow Chat (${conversation.messages.length} messages)
  `;
  
  document.body.appendChild(importButton);
  
  // Add hover effect
  importButton.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-2px)';
    this.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
  });
  
  importButton.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
    this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  
  // Add click event to insert all messages
  importButton.addEventListener('click', function() {
    // Show options dialog
    showImportOptionsDialog(conversation);
  });
}

// Function to show import options dialog
function showImportOptionsDialog(conversation) {
  // Create dialog element
  const dialog = document.createElement('div');
  dialog.id = 'sparrow-import-options-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 10001;
    width: 450px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #333;
    line-height: 1.5;
  `;
  
  dialog.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 16px;">
      <div style="background-color: #2980b9; border-radius: 50%; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; margin-right: 12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>
      <h3 style="margin: 0; color: #2980b9; font-size: 20px;">Import Options</h3>
    </div>
    
    <p style="margin-top: 0;">Choose how to import ${conversation.messages.length} messages from Sparrow:</p>
    
    <div style="display: flex; flex-direction: column; gap: 12px; margin: 20px 0;">
      <button id="sparrow-import-auto" style="
        background: #2980b9;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"></path>
          <path d="M12 5v14"></path>
        </svg>
        Automatic Import (Recommended)
      </button>
      
      <button id="sparrow-import-clipboard" style="
        background: #f5f5f5;
        color: #333;
        border: none;
        padding: 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        </svg>
        Copy to Clipboard
      </button>
      
      <button id="sparrow-import-first" style="
        background: #f5f5f5;
        color: #333;
        border: none;
        padding: 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 10 4 15 9 20"></polyline>
          <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
        </svg>
        Import First Message Only
      </button>
    </div>
    
    <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
      <button id="sparrow-import-cancel" style="
        background: #e0e0e0;
        color: #333;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      ">Cancel</button>
    </div>
  `;
  
  // Add dialog to page
  document.body.appendChild(dialog);
  
  // Add event listeners
  document.getElementById('sparrow-import-auto').addEventListener('click', function() {
    dialog.remove();
    importConversationToOpenWebUI(conversation);
  });
  
  document.getElementById('sparrow-import-clipboard').addEventListener('click', function() {
    dialog.remove();
    copyConversationToClipboard(conversation);
  });
  
  document.getElementById('sparrow-import-first').addEventListener('click', function() {
    dialog.remove();
    importFirstMessageOnly(conversation);
  });
  
  document.getElementById('sparrow-import-cancel').addEventListener('click', function() {
    dialog.remove();
  });
}

// Function to import the conversation using multiple methods
async function importConversationToOpenWebUI(conversation) {
  // Show a processing notification
  showNotification("Processing conversation import...", "info");
  
  try {
    // Method 1: Try to find and use New Chat button if we're not already in a chat
    const newChatButton = findNewChatButton();
    if (newChatButton) {
      console.log("Found New Chat button - clicking it first");
      newChatButton.click();
      
      // Wait for the chat input to appear
      await waitForElement('textarea, [contenteditable="true"]', 3000);
    }
    
    // Method 2: Try sending messages one by one (most compatible)
    const success = await sendMessagesSequentially(conversation.messages);
    
    if (success) {
      showNotification("Conversation imported successfully!", "success");
      
      // Hide the import button after successful import
      const importButton = document.getElementById('sparrow-import-button');
      if (importButton) {
        importButton.remove();
      }
    } else {
      // Method 3: Fallback to copying everything at once
      showNotification("Automatic import failed. Copying to clipboard instead.", "info");
      copyConversationToClipboard(conversation);
    }
  } catch (error) {
    console.error("Error during import:", error);
    showNotification("Import failed. Please try copying to clipboard instead.", "error");
  }
}

// Function to copy conversation to clipboard
async function copyConversationToClipboard(conversation) {
  try {
    // Format the messages for copying
    const messages = conversation.messages;
    let formattedText = `# ${conversation.title || 'Conversation from Sparrow'}\n\n`;
    
    messages.forEach(msg => {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      formattedText += `**${role}:** ${msg.content}\n\n`;
    });
    
    // Copy to clipboard
    await navigator.clipboard.writeText(formattedText);
    
    // Show success notification
    showNotification("Conversation copied to clipboard!", "success");
    
    // Find the message input field
    const inputElement = findInputElement();
    if (inputElement) {
      // Focus the input element
      inputElement.focus();
      
      // Show guidance message
      showNotification("Paste the conversation into the input field and press Enter to send.", "info");
    }
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    
    // Try fallback method
    const success = fallbackClipboardCopy(formattedText);
    if (success) {
      showNotification("Conversation copied to clipboard using fallback method!", "success");
    } else {
      showNotification("Failed to copy conversation. Please try another method.", "error");
    }
  }
}

// Function to import only the first message
async function importFirstMessageOnly(conversation) {
  try {
    // Find the first user message
    const userMessages = conversation.messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) {
      showNotification("No user messages found in the conversation.", "error");
      return;
    }
    
    const firstUserMessage = userMessages[0];
    
    // Method 1: Try to find and use New Chat button if we're not already in a chat
    const newChatButton = findNewChatButton();
    if (newChatButton) {
      console.log("Found New Chat button - clicking it first");
      newChatButton.click();
      
      // Wait for the chat input to appear
      await waitForElement('textarea, [contenteditable="true"]', 3000);
    }
    
    // Find input element
    const inputElement = findInputElement();
    if (!inputElement) {
      showNotification("Cannot find input element. Copying to clipboard instead.", "info");
      
      // Copy to clipboard as fallback
      await navigator.clipboard.writeText(firstUserMessage.content);
      showNotification("First message copied to clipboard!", "success");
      return;
    }
    
    // Type message into input
    await typeIntoElement(inputElement, firstUserMessage.content);
    
    // Find and click send button
    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
      showNotification("First message sent successfully!", "success");
    } else {
      // Try to simulate Enter key if no send button found
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        which: 13,
        keyCode: 13,
        bubbles: true
      });
      
      inputElement.dispatchEvent(event);
      showNotification("First message sent successfully!", "success");
    }
    
    // Show notification about remaining messages
    if (conversation.messages.length > 1) {
      setTimeout(() => {
        showImportNotification(conversation.messages.length - 1);
      }, 2000);
    }
    
    // Hide the import button after successful import
    const importButton = document.getElementById('sparrow-import-button');
    if (importButton) {
      importButton.remove();
    }
  } catch (error) {
    console.error("Error importing first message:", error);
    showNotification("Failed to import first message. Please try copying to clipboard.", "error");
  }
}

// Function to show a notification about remaining messages
function showImportNotification(messageCount) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: white;
    color: #333;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10001;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 300px;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 10px;">
      <div style="background-color: #2980b9; border-radius: 50%; width: 24px; height: 24px; display: flex; justify-content: center; align-items: center; margin-right: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      </div>
      <h3 style="margin: 0; color: #2980b9; font-size: 16px;">Sparrow Export</h3>
    </div>
    <p style="margin: 0 0 10px 0; font-size: 14px;">
      First message imported successfully. There are ${messageCount} more messages in the conversation.
    </p>
    <div style="display: flex; justify-content: flex-end;">
      <button id="sparrow-copy-all" style="
        background: #2980b9;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      ">Copy All Messages</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Add event listener to copy button
  document.getElementById('sparrow-copy-all').addEventListener('click', function() {
    chrome.storage.local.get(['openwebui_export_data'], function(result) {
      if (result && result.openwebui_export_data) {
        // Format the messages for copying
        const messages = result.openwebui_export_data.messages;
        let formattedText = `# ${result.openwebui_export_data.title || 'Conversation from Sparrow'}\n\n`;
        
        messages.forEach(msg => {
          const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
          formattedText += `**${role}:** ${msg.content}\n\n`;
        });
        
        // Copy to clipboard
        navigator.clipboard.writeText(formattedText)
          .then(() => {
            // Show success notification
            notification.innerHTML = `
              <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <div style="background-color: #27ae60; border-radius: 50%; width: 24px; height: 24px; display: flex; justify-content: center; align-items: center; margin-right: 10px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h3 style="margin: 0; color: #27ae60; font-size: 16px;">Success!</h3>
              </div>
              <p style="margin: 0 0 10px 0; font-size: 14px;">
                All messages copied to clipboard.
              </p>
              <div style="display: flex; justify-content: flex-end;">
                <button id="sparrow-close-notification" style="
                  background: #e0e0e0;
                  color: #333;
                  border: none;
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 13px;
                ">Close</button>
              </div>
            `;
            
            document.getElementById('sparrow-close-notification').addEventListener('click', function() {
              notification.remove();
            });
          })
          .catch(err => {
            console.error("Failed to copy to clipboard:", err);
            notification.innerHTML = `
              <div style="color: #e74c3c; font-weight: bold; margin-bottom: 10px;">Failed to copy to clipboard</div>
              <button id="sparrow-close-notification">Close</button>
            `;
            document.getElementById('sparrow-close-notification').addEventListener('click', function() {
              notification.remove();
            });
          });
      }
    });
  });
  
  // Auto-hide after 20 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 20000);
}

// Function to send messages sequentially with improved timing
async function sendMessagesSequentially(messages) {
  let success = true;
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // Skip if empty message
    if (!message.content.trim()) continue;
    
    // Only send user messages - AI responses should be generated by OpenWebUI
    if (message.role === 'user') {
      try {
        // Find input element each time as it might change
        const inputElement = findInputElement();
        if (!inputElement) {
          console.error("Cannot find input element for message:", message);
          success = false;
          continue;
        }
        
        // Type message into input
        await typeIntoElement(inputElement, message.content);
        
        // Find and click send button
        const sendButton = findSendButton();
        if (sendButton) {
          sendButton.click();
          
          // Show progress notification for long conversations
          if (i < messages.length - 1) {
            showNotification(`Sending message ${Math.floor(i/2) + 1}/${Math.ceil(messages.length/2)}...`, "info");
          }
          
          // Wait for the assistant response to be generated
          // Use a dynamic wait time based on message length
          const waitTime = Math.max(
            CONFIG.waitTimes.responseGeneration,
            Math.min(10000, message.content.length * 5) // 5ms per character, max 10 seconds
          );
          
          await waitForResponseCompletion(waitTime);
        } else {
          // Try to simulate Enter key if no send button found
          const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            which: 13,
            keyCode: 13,
            bubbles: true
          });
          
          inputElement.dispatchEvent(event);
          
          // Wait for the assistant response to be generated
          await waitForResponseCompletion(CONFIG.waitTimes.responseGeneration);
        }
      } catch (e) {
        console.error("Error sending message:", e);
        success = false;
      }
    }
  }
  
  return success;
}

// Function to wait for response completion
async function waitForResponseCompletion(baseWaitTime) {
  // First, wait for the base time
  await new Promise(resolve => setTimeout(resolve, baseWaitTime));
  
  // Then check if there's any loading indicator
  const loadingIndicators = [
    '.loading',
    '.typing',
    '.thinking',
    '[role="status"]',
    '.spinner',
    '.dots',
    '.progress'
  ];
  
  // Check for any visible loading indicators
  for (const selector of loadingIndicators) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isElementVisible(element)) {
        console.log("Found active loading indicator, waiting for completion");
        
        // Wait for the loading indicator to disappear
        await new Promise(resolve => {
          const observer = new MutationObserver(() => {
            if (!isElementVisible(element)) {
              observer.disconnect();
              resolve();
            }
          });
          
          observer.observe(element, { 
            attributes: true,
            attributeFilter: ['style', 'class'],
            childList: true
          });
          
          // Timeout after 30 seconds
          setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 30000);
        });
        
        // Add a small buffer time
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
    }
  }
  
  // If no loading indicator found, just add a small additional wait
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Check if an element is visible
function isElementVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 &&
         element.offsetHeight > 0;
}

// Function to find a "New Chat" button
function findNewChatButton() {
  // Look for buttons with text containing "new chat" or "new conversation"
  const buttons = document.querySelectorAll('button, a, [role="button"]');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('new chat') || text.includes('new conversation')) {
      return button;
    }
  }
  
  // Look for elements with + icon that might be new chat buttons
  const plusIcons = document.querySelectorAll('svg');
  for (const icon of plusIcons) {
    // Check if it looks like a plus icon
    if (icon.innerHTML.includes('M12 5v14m-7-7h14') || 
        icon.innerHTML.includes('M12 5v14') || 
        icon.innerHTML.includes('M5 12h14')) {
      // This is likely a + icon
      const button = icon.closest('button') || icon.closest('a') || icon.closest('[role="button"]');
      if (button) return button;
    }
  }
  
  return null;
}

// Function to wait for an element to appear
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Function to find the send button with improved detection
function findSendButton() {
  // Common patterns for send buttons
  const buttons = document.querySelectorAll('button, [role="button"]');
  
  // Look for buttons with text suggesting sending
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    if (text.includes('send') || text.includes('submit')) {
      return button;
    }
  }
  
  // Look for buttons with paper plane icons (common send icon)
  const svgButtons = Array.from(buttons).filter(btn => btn.querySelector('svg'));
  for (const button of svgButtons) {
    const svg = button.querySelector('svg');
    const svgContent = svg.innerHTML;
    
    // Check for common paper plane icon paths
    if (svgContent.includes('M22 2L11 13') || // Paper plane shape
        svgContent.includes('M2 21l7-7 9 9') || // Paper plane shape
        svgContent.includes('M21.44 11.05l-9.19 9.19')) { // Paper plane shape
      return button;
    }
  }
  
  // Look for buttons positioned near the input element
  const inputElement = findInputElement();
  if (inputElement) {
    const inputRect = inputElement.getBoundingClientRect();
    
    // Find buttons that are positioned to the right of the input
    const potentialSendButtons = Array.from(buttons).filter(btn => {
      const buttonRect = btn.getBoundingClientRect();
      
      // Button should be close to the input horizontally and aligned vertically
      const horizontallyClose = Math.abs(buttonRect.left - inputRect.right) < 100;
      const verticallyAligned = Math.abs(buttonRect.top - inputRect.top) < 50;
      
      return horizontallyClose && verticallyAligned;
    });
    
    if (potentialSendButtons.length > 0) {
      // Return the closest button to the input
      return potentialSendButtons.reduce((closest, current) => {
        const closestRect = closest.getBoundingClientRect();
        const currentRect = current.getBoundingClientRect();
        
        const closestDistance = Math.abs(closestRect.left - inputRect.right);
        const currentDistance = Math.abs(currentRect.left - inputRect.right);
        
        return currentDistance < closestDistance ? current : closest;
      });
    }
  }
  
  return null;
}

// Function to find the input element with improved detection
function findInputElement() {
  // Try all selectors from the config
  for (const selector of CONFIG.selectors.inputElements) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Filter for visible elements
      const visibleElements = Array.from(elements).filter(el => isElementVisible(el));
      
      if (visibleElements.length > 0) {
        // Return the largest visible element (most likely the main input)
        return visibleElements.reduce((largest, current) => {
          return (current.offsetHeight > largest.offsetHeight) ? current : largest;
        });
      }
      
      return elements[0];
    }
  }
  
  // Look for any textarea or contenteditable div that's visible
  const allInputs = [
    ...document.querySelectorAll('textarea'),
    ...document.querySelectorAll('[contenteditable="true"]')
  ];
  
  const visibleInputs = allInputs.filter(el => isElementVisible(el));
  if (visibleInputs.length > 0) {
    // Return the largest visible input
    return visibleInputs.reduce((largest, current) => {
      return (current.offsetHeight > largest.offsetHeight) ? current : largest;
    });
  }
  
  return null;
}

// Function to simulate typing into an element
async function typeIntoElement(element, text) {
  // Clear existing content first
  if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
    element.value = '';
    
    // Focus the element
    element.focus();
    
    // Set the value
    element.value = text;
    
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } 
  else if (element.getAttribute('contenteditable') === 'true') {
    // For contenteditable elements
    element.innerHTML = '';
    element.focus();
    
    // Insert text
    document.execCommand('insertText', false, text);
    
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Add this fallback clipboard function
function fallbackClipboardCopy(text) {
  try {
    // Method 1: Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Hide the element
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Execute the copy command
    const successful = document.execCommand('copy');
    
    // Remove the temporary element
    document.body.removeChild(textArea);
    
    if (successful) {
      console.log("Successfully copied to clipboard using execCommand");
      return true;
    } else {
      console.warn("execCommand copy failed");
      return false;
    }
  } catch (err) {
    console.error("Fallback clipboard method failed:", err);
    return false;
  }
}

// Function to show notification
function showNotification(message, type = "info") {
  // Remove any existing notification with the same message
  const existingNotifications = document.querySelectorAll('.sparrow-notification');
  existingNotifications.forEach(notification => {
    if (notification.textContent.includes(message)) {
      notification.remove();
    }
  });
  
  const notification = document.createElement('div');
  notification.className = 'sparrow-notification';
  
  // Set colors based on type
  let bgColor, iconColor, iconSvg;
  
  switch (type) {
    case "success":
      bgColor = "#27ae60";
      iconColor = "#fff";
      iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      break;
    case "error":
      bgColor = "#e74c3c";
      iconColor = "#fff";
      iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      break;
    default: // info
      bgColor = "#3498db";
      iconColor = "#fff";
      iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }
  
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10001;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: sparrowSlideIn 0.3s ease;
    max-width: 80%;
  `;
  
  notification.innerHTML = `
    <div style="color: ${iconColor};">${iconSvg}</div>
    <div style="word-break: break-word;">${message}</div>
  `;
  
  // Add animation
  if (!document.getElementById('sparrow-notification-style')) {
    const style = document.createElement('style');
    style.id = 'sparrow-notification-style';
    style.textContent = `
      @keyframes sparrowSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Position multiple notifications
  const notifications = document.querySelectorAll('.sparrow-notification');
  let offset = 0;
  
  notifications.forEach((notif, index) => {
    if (index > 0) {
      const prevNotif = notifications[index - 1];
      const prevHeight = prevNotif.offsetHeight;
      offset += prevHeight + 10; // 10px gap
      notif.style.bottom = `${20 + offset}px`;
    }
  });
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    notification.style.transition = 'all 0.3s ease';
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
      }
    }, 300);
  }, 5000);
}