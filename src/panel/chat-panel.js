/**
 * Sparrow Chat Panel - Main JavaScript file
 * 
 * This file handles the chat interface functionality for the Sparrow Chrome extension,
 * which provides AI-powered webpage summaries using various API providers.
 * 
 * Key functionalities:
 * - Initializes the chat panel UI
 * - Manages conversation history
 * - Processes user messages and displays AI responses
 * - Formats markdown text to HTML for display
 * - Handles API selection and indicators
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // DOM ELEMENT REFERENCES
  // =========================================================================
  const UI = {
    pageContentContainer: document.getElementById('page-content-container'),
    pageContentText: document.getElementById('page-content-text'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendButton: document.getElementById('send-button'),
    apiIndicator: document.getElementById('api-indicator'),
    saveChatBtn: document.getElementById('save-chat-btn'),
    viewToggleBtn: document.getElementById('view-toggle-btn'),
    savedChatsContainer: document.getElementById('saved-chats-container'),
    savedChatsList: document.getElementById('saved-chats-list'),
    backToChatBtn: document.getElementById('back-to-chat-btn'),
    exportJsonBtn: document.getElementById('export-json-btn')
  };
  
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  
  /**
   * Stores the entire conversation history for context preservation when
   * making API calls
   * @type {Array<{role: string, content: string}>}
   */
  let conversationHistory = [];
  
  /**
   * Stores the original page content for reference
   * @type {string}
   */
  let pageContent = '';

  // Session management variables
  let currentSessionId = null;
  let isChatSaved = false;

  // Flag to indicate if the chat is saved
  let directSavedChatsAccess = false;
  
  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  
  /**
   * Initialize the chat panel with session management
   * - Load settings from storage
   * - Set up event listeners
   * - Configure API indicators
   * - Generate or restore session ID
   */
  async function initializePanel() {
    // Add import-related elements to the UI object
    function updateUIReferences() {
      // Add import-related elements to the UI object
      UI.importChatBtn = document.getElementById('import-chat-btn');
      UI.importFileInput = document.getElementById('import-file-input');
    }

    // Load settings from local storage
    loadApiSettings();

    // Update UI references to include import elements
    updateUIReferences();
    
    // Configure event listeners for message sending
    setupEventListeners();

    // Setup session ID
    generateOrRestoreSessionId();
    
    // Setup additional event listeners for saving
    setupSavingEventListeners();
    
    // Setup event listeners for importing chats
    setupImportEventListeners();
    
    // Check if the panel should open directly to saved chats view
    checkForSavedChatsView();

    // Setup background message listener for chat initiation
    setupEventListeners();

    // Load and display the stored summary if we're not in saved chats view
    const urlParams = new URLSearchParams(window.location.search);
    const showSaved = urlParams.get('showSaved');

    if (showSaved !== 'true') {
      // Normal initialization - show the latest summary if available
      chrome.storage.local.get(['latestSummary'], function(result) {
        if (result.latestSummary) {
          // Display stored summary
          // ... existing summary display code ...
        }
      });
    }
    
    // Load and display the stored summary
    chrome.storage.local.get(['latestSummary'], function(result) {
      if (result.latestSummary) {
        // Format and display the stored summary
        const formattedContent = formatMessageText(result.latestSummary);
        
        // Create and add the assistant message to the chat
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-assistant';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = formattedContent;
        
        messageDiv.appendChild(messageContent);
        UI.chatMessages.appendChild(messageDiv);
        
        // Initialize conversation history with raw text
        conversationHistory = [
          {
            role: 'assistant',
            content: result.latestSummary
          }
        ];
        
        // Ensure the new message is visible
        scrollToBottom();
      }
    });
    
    // Remove the background message listener for chat-initiate
    // since we're now loading from storage directly
    
  }
  
  /**
   * Loads API settings from Chrome local storage and updates UI accordingly
   */
  function loadApiSettings() {
    chrome.storage.local.get([
      'apiMode', 
      'openaiModel', 
      'lmstudioModel', 
      'ollamaModel', 
      'openrouterModel'
    ], function(settings) {
      const apiMode = settings.apiMode || 'openai';
      let modelName = '';
      
      // Determine which model name to use based on the active API
      switch(apiMode) {
        case 'openai':
          modelName = settings.openaiModel || '';
          break;
        case 'lmstudio':
          modelName = settings.lmstudioModel || '';
          break;
        case 'ollama':
          modelName = settings.ollamaModel || '';
          break;
        case 'openrouter':
          modelName = settings.openrouterModel || '';
          break;
      }
      
      // Update the API indicator in the UI
      updateApiIndicator(apiMode, modelName);
    });
  }
  
  /**
   * Export the current chat conversation to a JSON file that can be downloaded
   */
  function exportChatToJson() {
    // Don't export if there's no conversation
    if (conversationHistory.length <= 0) {
      showToast('No conversation to export');
      return;
    }
    
    try {
      // Prepare chat data
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const chatData = {
        exportDate: new Date().toISOString(),
        messages: conversationHistory,
        metadata: {
          exportVersion: "1.0",
          extensionVersion: chrome.runtime.getManifest().version
        }
      };
      
      // Convert to JSON string with nice formatting
      const jsonString = JSON.stringify(chatData, null, 2);
      
      // Create a Blob with the JSON data
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = `sparrow-chat-${timestamp}.json`;
      
      // Append to body, click to download, then remove
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      // Show success message
      showToast('Chat exported successfully');
      
    } catch (error) {
      console.error('Error exporting chat:', error);
      showToast('Failed to export chat');
    }
 }

  /**
   * Set up event listeners for user interactions
   */
  function setupEventListeners() {
    // Send button click event
    UI.sendButton.addEventListener('click', sendMessage);

    // Save chat button click event
    if (UI.exportJsonBtn) {
      UI.exportJsonBtn.addEventListener('click', exportChatToJson);
    }
    
    // Enter key press event (without shift for newline)
    UI.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  /**
   * Set up event listeners for importing chats
   */
  function setupImportEventListeners() {
    if (UI.importChatBtn) {
      UI.importChatBtn.addEventListener('click', () => {
        // Trigger the hidden file input when import button is clicked
        UI.importFileInput.click();
      });
    }
    
    if (UI.importFileInput) {
      UI.importFileInput.addEventListener('change', handleFileSelect);
    }
  }

  /**
   * Configure listeners for messages from the background script
   */
  function setupBackgroundMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle chat initialization with page content
      if (message.action === 'chat-initiate') {
        handleChatInitiation(message, sendResponse);
      }
    });
  }
  
  /**
   * Handle the chat initiation message from the background script
   * @param {Object} message - The message from the background script
   * @param {Function} sendResponse - Function to send a response back
   */
  function handleChatInitiation(message, sendResponse) {
    const pageContent = message.pageContent || '';
    
    if (pageContent) {
      // Format the content for display
      const formattedContent = formatMessageText(pageContent);
      
      // Create and add the assistant message to the chat
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message message-assistant';
      
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';
      messageContent.innerHTML = formattedContent;
      
      messageDiv.appendChild(messageContent);
      UI.chatMessages.appendChild(messageDiv);
      
      // Initialize the conversation history with this content
      conversationHistory = [
        {
          role: 'assistant',
          content: pageContent
        }
      ];
      
      // Ensure the new message is visible
      scrollToBottom();
    }
    
    // Confirm successful processing
    sendResponse({ success: true });
  }
  
  // =========================================================================
  // IMPORT FUNCTIONALITY
  // =========================================================================

  /**
   * Handle file selection from the import button
   * @param {Event} event - The change event from the file input
   */
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
      return; // No file selected
    }
    
    // Check if it's a JSON file
    if (!file.type.match('application/json') && !file.name.endsWith('.json')) {
      showToast('Please select a valid JSON file');
      // Reset file input
      event.target.value = '';
      return;
    }
    
    // Read the file
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const fileContent = e.target.result;
        const importedData = JSON.parse(fileContent);
        
        // Validate the imported data
        validateAndImportChat(importedData);
        
      } catch (error) {
        console.error('Error reading JSON file:', error);
        showToast('Invalid JSON format. Import failed.');
      }
      
      // Reset file input
      event.target.value = '';
    };
    
    reader.onerror = function() {
      showToast('Error reading file');
      // Reset file input
      event.target.value = '';
    };
    
    reader.readAsText(file);
  }

  /**
   * Validate imported data and import if valid
   * @param {Object} importedData - The parsed JSON data from the imported file
   */
  function validateAndImportChat(importedData) {
    // Basic validation
    if (!importedData || !importedData.messages || !Array.isArray(importedData.messages)) {
      showImportErrorDialog('Invalid data format. The file is not a valid Sparrow chat export.');
      return;
    }
    
    // Check if it has the expected metadata
    if (!importedData.metadata || !importedData.metadata.exportVersion) {
      // It might still be a valid chat, but show a warning
      showImportValidationDialog(importedData, 'warning');
    } else {
      // Show validation dialog with success status
      showImportValidationDialog(importedData, 'success');
    }
  }

  /**
   * Show a dialog with import validation information
   * @param {Object} importData - The imported chat data
   * @param {string} status - Status of validation ('success', 'warning', or 'error')
   */
  function showImportValidationDialog(importData, status) {
    // Check if a previous dialog exists and remove it
    const existingDialog = document.getElementById('import-validation-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // Get message count and export date
    const messageCount = importData.messages.length;
    const exportDate = importData.exportDate 
      ? new Date(importData.exportDate).toLocaleString() 
      : 'Unknown';
    
    // Get version info
    const exportVersion = importData.metadata?.exportVersion || 'Unknown';
    const extensionVersion = importData.metadata?.extensionVersion || 'Unknown';
    
    // Create the dialog container
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'import-validation-dialog';
    dialogOverlay.className = 'dialog-overlay';
    
    // Create status message based on validation result
    let statusMessage = '';
    if (status === 'success') {
      statusMessage = `
        <div class="import-success">
          <i class="fa-solid fa-circle-check"></i>
          Valid Sparrow chat export detected.
        </div>
      `;
    } else if (status === 'warning') {
      statusMessage = `
        <div class="import-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          This file appears to be a chat export but may be from a different version or application.
        </div>
      `;
    } else {
      statusMessage = `
        <div class="import-error">
          <i class="fa-solid fa-circle-xmark"></i>
          Invalid chat export format.
        </div>
      `;
    }
    
    // Create the dialog content
    dialogOverlay.innerHTML = `
      <div class="dialog-content">
        <div class="dialog-header">
          <img src="../../assets/icons/icon48.png" alt="Sparrow logo" class="dialog-logo">
          <h3>Import Chat</h3>
        </div>
        <div class="dialog-body">
          <p>Would you like to import this conversation?</p>
          
          <div class="import-summary">
            <div class="import-metadata">
              <div class="import-metadata-item">
                <span class="import-metadata-label">Messages:</span>
                <span>${messageCount}</span>
              </div>
              <div class="import-metadata-item">
                <span class="import-metadata-label">Export Date:</span>
                <span>${exportDate}</span>
              </div>
              <div class="import-metadata-item">
                <span class="import-metadata-label">Export Version:</span>
                <span>${exportVersion}</span>
              </div>
              <div class="import-metadata-item">
                <span class="import-metadata-label">Extension Version:</span>
                <span>${extensionVersion}</span>
              </div>
            </div>
          </div>
          
          ${statusMessage}
        </div>
        <div class="dialog-buttons">
          <button class="dialog-btn dialog-cancel">Cancel</button>
          <button class="dialog-btn dialog-confirm" ${status === 'error' ? 'disabled' : ''}>Import</button>
        </div>
      </div>
    `;
    
    // Add dialog to the DOM
    document.body.appendChild(dialogOverlay);
    
    // Add event listeners
    const cancelBtn = dialogOverlay.querySelector('.dialog-cancel');
    const confirmBtn = dialogOverlay.querySelector('.dialog-confirm');
    
    // Close dialog when clicking cancel
    cancelBtn.addEventListener('click', () => {
      dialogOverlay.classList.add('dialog-closing');
      setTimeout(() => dialogOverlay.remove(), 300);
    });
    
    // Import chat when clicking confirm
    confirmBtn.addEventListener('click', () => {
      dialogOverlay.classList.add('dialog-closing');
      setTimeout(() => {
        dialogOverlay.remove();
        // Process the import
        performChatImport(importData);
      }, 300);
    });
    
    // Close dialog when clicking outside
    dialogOverlay.addEventListener('click', (e) => {
      if (e.target === dialogOverlay) {
        dialogOverlay.classList.add('dialog-closing');
        setTimeout(() => dialogOverlay.remove(), 300);
      }
    });
    
    // Show dialog with animation
    setTimeout(() => dialogOverlay.classList.add('dialog-visible'), 10);
  }

  /**
   * Show error dialog for import validation
   * @param {string} errorMessage - The error message to display
   */
  function showImportErrorDialog(errorMessage) {
    // Check if a previous dialog exists and remove it
    const existingDialog = document.getElementById('import-error-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // Create the dialog container
    const dialogOverlay = document.createElement('div');
    dialogOverlay.id = 'import-error-dialog';
    dialogOverlay.className = 'dialog-overlay';
    
    // Create the dialog content
    dialogOverlay.innerHTML = `
      <div class="dialog-content">
        <div class="dialog-header">
          <img src="../../assets/icons/icon48.png" alt="Sparrow logo" class="dialog-logo">
          <h3>Import Error</h3>
        </div>
        <div class="dialog-body">
          <div class="import-error">
            <i class="fa-solid fa-circle-xmark"></i>
            ${errorMessage}
          </div>
          <p class="dialog-warning">Please make sure you are importing a chat file that was exported from the Sparrow extension.</p>
        </div>
        <div class="dialog-buttons">
          <button class="dialog-btn dialog-confirm">OK</button>
        </div>
      </div>
    `;
    
    // Add dialog to the DOM
    document.body.appendChild(dialogOverlay);
    
    // Add event listeners
    const confirmBtn = dialogOverlay.querySelector('.dialog-confirm');
    
    // Close dialog when clicking OK
    confirmBtn.addEventListener('click', () => {
      dialogOverlay.classList.add('dialog-closing');
      setTimeout(() => dialogOverlay.remove(), 300);
    });
    
    // Close dialog when clicking outside
    dialogOverlay.addEventListener('click', (e) => {
      if (e.target === dialogOverlay) {
        dialogOverlay.classList.add('dialog-closing');
        setTimeout(() => dialogOverlay.remove(), 300);
      }
    });
    
    // Show dialog with animation
    setTimeout(() => dialogOverlay.classList.add('dialog-visible'), 10);
  }

  /**
   * Actually import the chat after validation
   * @param {Object} importData - The imported chat data
   */
  async function performChatImport(importData) {
    try {
      // Generate a new session ID for this import
      const importSessionId = 'imported-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // Generate a meaningful title for the imported chat
      let chatTitle = generateMeaningfulTitle(importData);
      
      // Prepare chat data for storage
      const chatData = {
        sessionId: importSessionId,
        title: chatTitle, // Use the generated title instead of generic "Imported Chat"
        url: '',
        messages: importData.messages,
        firstSaved: importData.exportDate ? new Date(importData.exportDate).getTime() : Date.now(),
        lastUpdated: Date.now(),
        lastViewed: Date.now(),
        importDate: Date.now()
      };
      
      // Get existing saved chats
      const existingSavedChats = await loadSavedChats();
      
      // Add the imported chat
      existingSavedChats.push(chatData);
      
      // Save back to storage
      await chrome.storage.local.set({ 'sparrowSavedChats': existingSavedChats });
      
      // Show success message
      showToast('Chat imported successfully');
      
      // Refresh the saved chats list
      await loadSavedChatsAndShow();
      
    } catch (error) {
      console.error('Error importing chat:', error);
      showToast('Failed to import chat: ' + error.message);
    }
  }
  
  /**
   * Generate a meaningful title for an imported chat based on its content
   * @param {Object} importData - The imported chat data
   * @returns {string} - A meaningful title
   */
  function generateMeaningfulTitle(importData) {
    // Default title if we can't generate anything better
    let defaultTitle = "Imported Chat";
    
    try {
      // If there are no messages, return default title
      if (!importData.messages || importData.messages.length === 0) {
        return defaultTitle;
      }
      
      // Try to find the first assistant message with meaningful content
      const assistantMessages = importData.messages.filter(msg => msg.role === 'assistant');
      
      if (assistantMessages.length > 0) {
        // Get the first assistant message's content
        const firstMessageContent = assistantMessages[0].content;
        
        // Try to extract a title by looking for patterns
        
        // Look for title: or # patterns that might indicate a title
        const titleMatch = firstMessageContent.match(/(?:^|\n)#\s+(.*?)(?:\n|$)/) || 
                          firstMessageContent.match(/(?:^|\n)Title:\s*(.*?)(?:\n|$)/i);
        
        if (titleMatch && titleMatch[1]) {
          // Clean up the matched title
          let extractedTitle = titleMatch[1].trim();
          
          // Truncate if too long (maximum 50 characters)
          if (extractedTitle.length > 50) {
            extractedTitle = extractedTitle.substring(0, 47) + '...';
          }
          
          return extractedTitle;
        }
        
        // If no title pattern found, use the first few words
        // Split the content into words and take the first 6-8 words
        const words = firstMessageContent.split(/\s+/);
        const titleWords = words.slice(0, words.length > 15 ? 6 : 8);
        let generatedTitle = titleWords.join(' ');
        
        // Add ellipsis if we truncated
        if (words.length > titleWords.length) {
          generatedTitle += '...';
        }
        
        // Truncate if still too long
        if (generatedTitle.length > 50) {
          generatedTitle = generatedTitle.substring(0, 47) + '...';
        }
        
        return generatedTitle;
      }
      
      // If no assistant messages, try using user messages
      const userMessages = importData.messages.filter(msg => msg.role === 'user');
      
      if (userMessages.length > 0) {
        // Get the first user message's content
        const firstUserContent = userMessages[0].content;
        
        // Use the first few words of the user's first message
        const words = firstUserContent.split(/\s+/);
        const titleWords = words.slice(0, 6); // Take fewer words for user messages
        let generatedTitle = titleWords.join(' ');
        
        // Add ellipsis if we truncated
        if (words.length > titleWords.length) {
          generatedTitle += '...';
        }
        
        // Truncate if still too long
        if (generatedTitle.length > 50) {
          generatedTitle = generatedTitle.substring(0, 47) + '...';
        }
        
        return 'Chat about: ' + generatedTitle;
      }
      
      // If we couldn't generate a better title, use the export date if available
      if (importData.exportDate) {
        const exportDate = new Date(importData.exportDate);
        return `Chat from ${exportDate.toLocaleDateString()}`;
      }
      
      // Fallback to default
      return defaultTitle;
      
    } catch (error) {
      console.error('Error generating title:', error);
      return defaultTitle;
    }
  }


  // =========================================================================
  // MESSAGE HANDLING
  // =========================================================================
  
  /**
   * Process selected text with a specific action
   * @param {string} text - The selected text to process
   * @param {string} action - The action to perform (ask, explain, etc.)
   */
  function processSelectedText(text, action) {
    // Generate an appropriate prompt based on the action
    let prompt = '';
    
    switch(action) {
      case 'ask':
        prompt = `The user wants to know more about the following text: "${text}"`;
        break;
      case 'explain':
        prompt = `The user wants you to explain the following text in simple terms: "${text}"`;
        break;
      default:
        prompt = `The user has selected the following text: "${text}"`;
        break;
    }
    
    // Send the prompt to the AI for processing
    sendToAI(prompt);
  }
  
  /**
   * Send a message to the AI for processing via the background script
   * @param {string} text - The message text to send
   */
  function sendToAI(text) {
    // Show the typing indicator while waiting for a response
    showTypingIndicator();
    
    // Send message to background script for processing
    chrome.runtime.sendMessage({
      action: 'chat-message',
      text: text,
      history: conversationHistory
    }, (response) => {
      // Hide the typing indicator
      hideTypingIndicator();
      
      if (response && response.reply) {
        // Add the AI's response to the chat
        addMessage(response.reply, 'assistant');
        
        // Update conversation history
        conversationHistory.push({
          role: 'assistant',
          content: response.reply
        });
      } else if (response && response.error) {
        // Display specific error message
        addMessage(`Error: ${response.error}`, 'assistant');
        console.error('API error:', response.error);
      } else {
        // Handle error case
        addMessage('Sorry, I encountered an error processing your message.', 'assistant');
        console.error('Unexpected response format:', response);
      }
    });
  }
  
  /**
   * Send the user's message to the AI
   */
  function sendMessage() {
    const messageText = UI.chatInput.value.trim();
    if (!messageText) return;
    
    // Add the user's message to the chat
    addMessage(messageText, 'user');
    
    // Clear the input field
    UI.chatInput.value = '';
    
    // Update conversation history
    conversationHistory.push({
      role: 'user',
      content: messageText
    });
    
    // Send to AI for processing
    sendToAI(messageText);
  }
  
  /**
   * Add a message to the chat display
   * @param {string} text - The message text
   * @param {string} role - The role of the message sender ('user' or 'assistant')
   */
  const originalAddMessage = function(text, role) {
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${role}`;
    
    // Create and format message content
    const messageText = document.createElement('div');
    messageText.className = 'message-content';
    
    // Format the text with markdown support
    const formattedText = formatMessageText(text);
    messageText.innerHTML = formattedText;
    
    // Add to the chat display
    messageDiv.appendChild(messageText);
    UI.chatMessages.appendChild(messageDiv);
    
    // Scroll to make the new message visible
    scrollToBottom();
  };

  addMessage = function(text, role) {
    // Call the original function
    originalAddMessage(text, role);
    
    // If this is a previously saved chat, automatically save the new content
    if (isChatSaved) {
      // Visual indication that changes are being saved
      UI.saveChatBtn.classList.add('has-changes');
      UI.saveChatBtn.title = 'Auto-saving changes...';
      
      // Add a small delay before auto-saving to prevent excessive saves during rapid exchanges
      clearTimeout(window.autoSaveTimeout);
      window.autoSaveTimeout = setTimeout(() => {
        // Auto-save the updated chat
        autoSaveChat();
      }, 1500); // 1.5 second delay to batch rapid message exchanges
    }
  };
  
  // =========================================================================
  // SESSION AND SAVING FUNCTIONALITY
  // =========================================================================
  
  /**
   * Generate a new session ID or restore from storage
   */
  function generateOrRestoreSessionId() {
    // Check for existing session ID in URL params (from popup)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    
    if (sessionParam) {
      // Restore the specified session ID
      currentSessionId = sessionParam;
      loadSavedChatSession(currentSessionId);
    } else {
      // Generate a new unique session ID
      currentSessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    console.log("Current session ID:", currentSessionId);
  }

  /**
   * Setup event listeners for save button and view switching
   */
  function setupSavingEventListeners() {
    // Save button click
    if (UI.saveChatBtn) {
      UI.saveChatBtn.addEventListener('click', saveCurrentChat);
    }
    
    // View toggle button
    if (UI.viewToggleBtn) {
      UI.viewToggleBtn.addEventListener('click', showSavedChatsView);
    }
    
    // Back button
    if (UI.backToChatBtn) {
      UI.backToChatBtn.addEventListener('click', showChatView);
    }
  }

/**
 * Check if the panel should show saved chats view immediately
 */
function checkForSavedChatsView() {
  const urlParams = new URLSearchParams(window.location.search);
  const showSaved = urlParams.get('showSaved');
  const directAccess = urlParams.get('directAccess');
  
  // Set the direct access flag if present
  if (directAccess === 'true') {
    directSavedChatsAccess = true;
    console.log("Direct access to saved chats detected");
  }
  
  if (showSaved === 'true') {
    // Show saved chats view
    showSavedChatsView();
  }
}

  /**
   * Save the current chat conversation
   */
  async function saveCurrentChat() {
    // Don't save if there's no conversation
    if (conversationHistory.length <= 1) {
      showToast('Nothing to save yet. Start a conversation first!');
      return;
    }
    
    try {
      // Get the active tab for URL and title
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      // Prepare chat data
      const chatData = {
        sessionId: currentSessionId,
        title: activeTab.title || 'Chat Conversation',
        url: activeTab.url || '',
        messages: conversationHistory,
        firstSaved: Date.now(),
        lastUpdated: Date.now(),
        lastViewed: Date.now()
      };
      
      // Check if this session is already saved
      const existingSavedChats = await loadSavedChats();
      const existingIndex = existingSavedChats.findIndex(chat => chat.sessionId === currentSessionId);
      
      if (existingIndex !== -1) {
        // Update existing chat
        chatData.firstSaved = existingSavedChats[existingIndex].firstSaved;
        existingSavedChats[existingIndex] = chatData;
        showToast('Chat updated!');
      } else {
        // Add as new chat
        existingSavedChats.push(chatData);
        showToast('Chat saved!');
      }
      
      // Save back to storage
      await chrome.storage.local.set({ 'sparrowSavedChats': existingSavedChats });
      
      // Update UI to show saved state
      updateSaveButtonState(true);
      
      // Update saved count in popup if possible
      updateSavedChatsCount(existingSavedChats.length);
      
    } catch (error) {
      console.error('Error saving chat:', error);
      showToast('Failed to save chat. Please try again.');
    }
  }

  /**
   * Load all saved chats from storage
   * @returns {Promise<Array>} Array of saved chat objects
   */
  async function loadSavedChats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sparrowSavedChats'], (result) => {
        const savedChats = result.sparrowSavedChats || [];
        resolve(savedChats);
      });
    });
  }

  /**
   * Load a specific saved chat session
   * @param {string} sessionId - The session ID to load
   */
  async function loadSavedChatSession(sessionId) {
    try {
      const savedChats = await loadSavedChats();
      const savedChat = savedChats.find(chat => chat.sessionId === sessionId);
      
      if (savedChat) {
        // Clear current chat
        UI.chatMessages.innerHTML = '';
        
        // Restore conversation history
        conversationHistory = savedChat.messages;
        
        // Add messages to UI
        savedChat.messages.forEach(msg => {
          addMessage(msg.content, msg.role);
        });
        
        // Update session state
        currentSessionId = sessionId;
        
        // Update saved state
        updateSaveButtonState(true);
        
        // Update last viewed timestamp
        updateLastViewed(sessionId);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading saved chat:', error);
      return false;
    }
  }

  /**
   * Update last viewed timestamp for a saved chat
   * @param {string} sessionId - The session ID to update
   */
  async function updateLastViewed(sessionId) {
    const savedChats = await loadSavedChats();
    const chatIndex = savedChats.findIndex(chat => chat.sessionId === sessionId);
    
    if (chatIndex !== -1) {
      savedChats[chatIndex].lastViewed = Date.now();
      await chrome.storage.local.set({ 'sparrowSavedChats': savedChats });
    }
  }

  /**
   * Delete a saved chat session
   * @param {string} sessionId - The session ID to delete
   */
  async function deleteSavedChat(sessionId) {
    try {
      const savedChats = await loadSavedChats();
      const updatedChats = savedChats.filter(chat => chat.sessionId !== sessionId);
      
      await chrome.storage.local.set({ 'sparrowSavedChats': updatedChats });
      
      // Update saved count
      updateSavedChatsCount(updatedChats.length);
      
      // If current session was deleted, update state
      if (currentSessionId === sessionId) {
        updateSaveButtonState(false);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting saved chat:', error);
      return false;
    }
  }

  /**
   * Update the save button state based on whether current chat is saved
   * @param {boolean} isSaved - Whether the current chat is saved
   */
  function updateSaveButtonState(isSaved) {
    isChatSaved = isSaved;
    
    if (UI.saveChatBtn) {
      if (isSaved) {
        UI.saveChatBtn.classList.add('saved');
        UI.saveChatBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        UI.saveChatBtn.title = 'Update saved chat';
      } else {
        UI.saveChatBtn.classList.remove('saved');
        UI.saveChatBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        UI.saveChatBtn.title = 'Save this chat';
      }
    }
  }

/**
 * Show the saved chats view
 */
async function showSavedChatsView() {
  // Load saved chats
  await loadSavedChatsAndShow();
  
  // Show the container
  UI.savedChatsContainer.classList.remove('hidden');
  
  // Update the back button based on access context
  if (directSavedChatsAccess) {
    // Disable or hide back button when directly accessing saved chats
    if (UI.backToChatBtn) {
      UI.backToChatBtn.classList.add('disabled');
      UI.backToChatBtn.disabled = true;
      UI.backToChatBtn.title = "No active chat to return to";
      // Optionally change the text
      UI.backToChatBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> No active chat';
    }
  } else {
    // Ensure back button is enabled when coming from an active chat
    if (UI.backToChatBtn) {
      UI.backToChatBtn.classList.remove('disabled');
      UI.backToChatBtn.disabled = false;
      UI.backToChatBtn.title = "Return to chat";
      UI.backToChatBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Chat';
    }
  }
}

  /**
   * Load saved chats and display them in the saved chats view
   */
  async function loadSavedChatsAndShow() {
    try {
      const savedChats = await loadSavedChats();
      
      // Clear the list
      UI.savedChatsList.innerHTML = '';
      
      if (savedChats.length === 0) {
        // Show empty state
        UI.savedChatsList.innerHTML = `
          <div class="empty-saved-chats">
            <i class="fa-solid fa-bookmark empty-icon"></i>
            <p>No saved conversations yet</p>
          </div>
        `;
        return;
      }
      
      // Sort by last updated (newest first)
      savedChats.sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      // Add each chat to the list
      savedChats.forEach(chat => {
        const lastUpdated = new Date(chat.lastUpdated);
        const formattedDate = lastUpdated.toLocaleDateString() + ' ' + 
                            lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const chatItem = document.createElement('div');
        chatItem.className = 'saved-chat-item';
        chatItem.dataset.sessionId = chat.sessionId;
        
        // Create title from page title or first message
        let chatTitle = chat.title || '';
        if (!chatTitle && chat.messages && chat.messages.length > 0) {
          // Use first few words of first message
          const firstMsg = chat.messages[0].content;
          chatTitle = firstMsg.split(' ').slice(0, 7).join(' ') + '...';
        }
        
        // Fallback if still no title
        if (!chatTitle) {
          chatTitle = 'Chat from ' + formattedDate;
        }
        
        // Get domain from URL if available
        let domain = '';
        try {
          if (chat.url) {
            domain = new URL(chat.url).hostname;
          }
        } catch (e) {
          domain = 'Unknown site';
        }
        
        chatItem.innerHTML = `
          <div class="saved-chat-title">${chatTitle}</div>
          <div class="saved-chat-info">
            <span>${domain || 'Unknown site'}</span>
            <span>${formattedDate}</span>
          </div>
          <button class="saved-chat-delete" title="Delete this chat">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        
        // Add click event to load the chat
        chatItem.addEventListener('click', (e) => {
          // Don't handle clicks on the delete button
          if (e.target.closest('.saved-chat-delete')) return;
          
          loadSavedChatSession(chat.sessionId);
          showChatView();
        });
        
        // Add delete button handler
        const deleteBtn = chatItem.querySelector('.saved-chat-delete');
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          
          // Use the custom delete confirmation instead of the browser's confirm
          showDeleteConfirmation(chatTitle, async () => {
            await deleteSavedChat(chat.sessionId);
            chatItem.remove();
            
            // If list is now empty, show empty state
            if (UI.savedChatsList.children.length === 0) {
              UI.savedChatsList.innerHTML = `
                <div class="empty-saved-chats">
                  <i class="fa-solid fa-bookmark empty-icon"></i>
                  <p>No saved conversations yet</p>
                </div>
              `;
            }
            
            // Update saved count in popup if possible
            updateSavedChatsCount(savedChats.length - 1);
          });
        });
        
        UI.savedChatsList.appendChild(chatItem);
      });
      
    } catch (error) {
      console.error('Error loading saved chats:', error);
      UI.savedChatsList.innerHTML = `
        <div class="empty-saved-chats">
          <i class="fa-solid fa-exclamation-circle empty-icon"></i>
          <p>Error loading saved chats. Please try again.</p>
        </div>
      `;
    }
  }

  /**
   * Show the chat view (hide saved chats)
   */
  function showChatView() {
    UI.savedChatsContainer.classList.add('hidden');
  }

  /**
   * Update the saved chats count in the popup if possible
   * @param {number} count - Number of saved chats
   */
  function updateSavedChatsCount(count) {
    // Attempt to communicate with popup if it's open
    chrome.runtime.sendMessage({
      action: 'update-saved-count',
      count: count
    }).catch(() => {
      // Popup might not be open, this is expected
    });
  }

  /**
   * Show a toast message
   * @param {string} message - Message to show
   * @param {number} duration - Duration in ms
   */
  function showToast(message, duration = 2000) {
    // Create toast if it doesn't exist
    let toast = document.getElementById('toast');
    
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    
    // Set message and show
    toast.textContent = message;
    toast.style.opacity = '1';
    
    // Hide after duration
    setTimeout(() => {
      toast.style.opacity = '0';
    }, duration);
  }

/**
 * Automatically save updates to an existing chat
*/
async function autoSaveChat() {
  try {
    // Get the active tab for URL and title
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    // Get existing saved chats
    const existingSavedChats = await loadSavedChats();
    const existingIndex = existingSavedChats.findIndex(chat => chat.sessionId === currentSessionId);
    
    if (existingIndex !== -1) {
      // Update existing chat with latest messages
      const updatedChat = {
        ...existingSavedChats[existingIndex],
        messages: conversationHistory,
        lastUpdated: Date.now()
      };
      
      // Update the chat in the saved chats array
      existingSavedChats[existingIndex] = updatedChat;
      
      // Save back to storage
      await chrome.storage.local.set({ 'sparrowSavedChats': existingSavedChats });
      
      // Update UI to show saved state - ANIMATION ENHANCEMENT
      UI.saveChatBtn.classList.remove('has-changes');
      
      // Apply the animation class - this will trigger the visual feedback
      UI.saveChatBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
      UI.saveChatBtn.title = 'Chat auto-saved';
      
      // Make animation more noticeable by removing and re-adding the class
      UI.saveChatBtn.classList.remove('auto-saved');
      UI.saveChatBtn.classList.remove('saved');
      
      // Force a reflow to ensure animation triggers even when class was previously applied
      void UI.saveChatBtn.offsetWidth;
      
      // Add classes back with a slight delay between them for better visual effect
      setTimeout(() => {
        UI.saveChatBtn.classList.add('auto-saved');
        
        // Add saved class after a slight delay
        setTimeout(() => {
          UI.saveChatBtn.classList.add('saved');
        }, 100);
      }, 10);
      
      console.log('Chat auto-saved successfully');
    }
  } catch (error) {
    console.error('Error auto-saving chat:', error);
    // Silently fail - we don't want to disturb the user experience
    UI.saveChatBtn.title = 'Auto-save failed. Click to retry.';
  }
}

/**
 * Create a custom delete confirmation dialog
 * @param {string} chatTitle - The title of the chat being deleted
 * @param {Function} onConfirm - Callback when deletion is confirmed
 */
function showDeleteConfirmation(chatTitle, onConfirm) {
  // Check if a previous dialog exists and remove it
  const existingDialog = document.getElementById('custom-delete-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  // Create the dialog container
  const dialogOverlay = document.createElement('div');
  dialogOverlay.id = 'custom-delete-dialog';
  dialogOverlay.className = 'dialog-overlay';
  
  // Create the dialog content with the extension logo
  dialogOverlay.innerHTML = `
    <div class="dialog-content">
      <div class="dialog-header">
        <img src="../../assets/icons/icon48.png" alt="Sparrow logo" class="dialog-logo">
        <h3>Delete Conversation</h3>
      </div>
      <div class="dialog-body">
        <p>Are you sure you want to delete this saved conversation?</p>
        <p class="chat-title-preview">"${escapeHtml(chatTitle)}"</p>
        <p class="dialog-warning">This action cannot be undone.</p>
      </div>
      <div class="dialog-buttons">
        <button class="dialog-btn dialog-cancel">Cancel</button>
        <button class="dialog-btn dialog-confirm">Delete</button>
      </div>
    </div>
  `;
  
  // Add dialog to the DOM
  document.body.appendChild(dialogOverlay);
  
  // Add event listeners
  const cancelBtn = dialogOverlay.querySelector('.dialog-cancel');
  const confirmBtn = dialogOverlay.querySelector('.dialog-confirm');
  
  // Close dialog when clicking cancel
  cancelBtn.addEventListener('click', () => {
    dialogOverlay.classList.add('dialog-closing');
    setTimeout(() => dialogOverlay.remove(), 300);
  });
  
  // Close dialog and execute callback when clicking delete
  confirmBtn.addEventListener('click', () => {
    dialogOverlay.classList.add('dialog-closing');
    setTimeout(() => {
      dialogOverlay.remove();
      onConfirm();
    }, 300);
  });
  
  // Close dialog when clicking outside
  dialogOverlay.addEventListener('click', (e) => {
    if (e.target === dialogOverlay) {
      dialogOverlay.classList.add('dialog-closing');
      setTimeout(() => dialogOverlay.remove(), 300);
    }
  });
  
  // Show dialog with animation
  setTimeout(() => dialogOverlay.classList.add('dialog-visible'), 10);
}
  
  // =========================================================================
  // UI UTILITIES
  // =========================================================================
  
  /**
   * Update the API indicator with the current API provider and model
   * @param {string} apiMode - The current API provider (openai, lmstudio, ollama, openrouter)
   * @param {string} modelName - The name of the model being used
   */
  function updateApiIndicator(apiMode, modelName = '') {
    let displayInfo = { class: '', name: '' };
    
    // Set the appropriate CSS class based on the API provider
    switch(apiMode) {
      case 'lmstudio':
        displayInfo.class = 'indicator-lmstudio';
        break;
      case 'ollama':
        displayInfo.class = 'indicator-ollama';
        break;
      case 'openrouter':
        displayInfo.class = 'indicator-openrouter';
        break;
      default: // openai is the default
        displayInfo.class = 'indicator-openai';
        break;
    }
    
    // Set the display name (model name if available, otherwise API name)
    if (modelName) {
      displayInfo.name = truncateModelName(modelName);
    } else {
      // Default names for each API provider
      switch(apiMode) {
        case 'lmstudio':
          displayInfo.name = 'LM Studio';
          break;
        case 'ollama':
          displayInfo.name = 'Ollama';
          break;
        case 'openrouter':
          displayInfo.name = 'OpenRouter';
          break;
        default:
          displayInfo.name = 'OpenAI';
          break;
      }
    }
    
    // Update the indicator in the UI
    if (UI.apiIndicator) {
      UI.apiIndicator.textContent = displayInfo.name;
      UI.apiIndicator.className = 'api-method-indicator ' + displayInfo.class;
    }
  }
  
  /**
   * Truncate and format model names for display in the UI
   * @param {string} modelName - The full model name
   * @returns {string} - The truncated/formatted model name
   */
  function truncateModelName(modelName) {
    if (!modelName) return '';
    
    // Replace common prefixes with shorter versions
    let displayName = modelName
      .replace('gpt-3.5-turbo', 'GPT-3.5')
      .replace('gpt-4-turbo', 'GPT-4 Turbo')
      .replace('gpt-4-0', 'GPT-4')
      .replace('gpt-4o', 'GPT-4o');
    
    // Remove organization prefixes for OpenRouter models
    const slashIndex = displayName.indexOf('/');
    if (slashIndex > 0) {
      displayName = displayName.substring(slashIndex + 1);
    }
    
    // Truncate if still too long
    if (displayName.length > 15) {
      displayName = displayName.substring(0, 12) + '...';
    }
    
    return displayName;
  }
  
  /**
   * Show the typing indicator while waiting for AI response
   */
  function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator message message-assistant';
    typingDiv.id = 'typing-indicator';
    
    // Create the three animated dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'typing-dot';
      typingDiv.appendChild(dot);
    }
    
    // Add to the chat and scroll to make it visible
    UI.chatMessages.appendChild(typingDiv);
    scrollToBottom();
  }
  
  /**
   * Hide the typing indicator once response is received
   */
  function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  /**
   * Scroll the chat container to the bottom to show newest messages
   */
  function scrollToBottom() {
    // Use setTimeout to ensure DOM has updated before scrolling
    setTimeout(() => {
      UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
    }, 50);
  }
  
  /**
   * Get the current time formatted as "HH:MM AM/PM"
   * @returns {string} - The formatted time string
   */
  function getFormattedTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    return `${hours}:${minutes} ${ampm}`;
  }
  
  // =========================================================================
  // TEXT FORMATTING
  // =========================================================================
  
  /**
   * Format message text with enhanced markdown support
   * @param {string} text - The raw message text
   * @returns {string} - HTML formatted text
   */
  function formatMessageText(text) {
    if (!text) return '';
    
    // Process text formatting in a specific order to avoid conflicts
    
    // 1. Handle code blocks with language highlighting
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, language, code) {
      const langClass = language ? ` class="language-${language}"` : '';
      const langLabel = language ? `<div class="code-lang-label">${language}</div>` : '';
      return `<div class="code-block-wrapper">${langLabel}<pre class="code-block"${langClass}><code>${escapeHtml(code.trim())}</code></pre></div>`;
    });
    
    // 2. Handle headings (# Heading)
    text = text.replace(/^(#{1,6})\s+(.+)$/gm, function(match, hashes, content) {
      const level = hashes.length;
      return `<h${level} class="message-heading message-heading-${level}">${content}</h${level}>`;
    });
    
    // 3. Handle inline code (`code`)
    text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
    
    // 4. Handle bold text (**text**)
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 5. Handle italic text (*text*)
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // 6. Handle blockquotes
    text = text.replace(/^\s*>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 7. Handle unordered lists with proper nesting
    let inList = false;
    text = text.split('\n').map(line => {
      // Check for list items
      if (/^\s*[\-\*•]\s+/.test(line)) {
        const content = line.replace(/^\s*[\-\*•]\s+/, '');
        if (!inList) {
          inList = true;
          return `<ul class="message-list"><li>${content}</li>`;
        }
        return `<li>${content}</li>`;
      } else if (inList && line.trim() !== '') {
        inList = false;
        return `</ul>\n${line}`;
      } else if (inList && line.trim() === '') {
        inList = false;
        return '</ul>';
      }
      return line;
    }).join('\n');
    
    // Close any unclosed list
    if (inList) {
      text += '</ul>';
    }
    
    // 8. Handle ordered lists with proper nesting
    inList = false;
    text = text.split('\n').map(line => {
      if (/^\s*\d+\.\s+/.test(line)) {
        const content = line.replace(/^\s*\d+\.\s+/, '');
        if (!inList) {
          inList = true;
          return `<ol class="message-list"><li>${content}</li>`;
        }
        return `<li>${content}</li>`;
      } else if (inList && line.trim() !== '') {
        inList = false;
        return `</ol>\n${line}`;
      } else if (inList && line.trim() === '') {
        inList = false;
        return '</ol>';
      }
      return line;
    }).join('\n');
    
    // Close any unclosed list
    if (inList) {
      text += '</ol>';
    }
    
    // 9. Handle horizontal rules
    text = text.replace(/^\s*---+\s*$/gm, '<hr class="message-hr">');
    
    // 10. Handle links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="message-link">$1</a>');
    
    // 11. Convert remaining paragraphs
    // Split by double newlines and wrap each paragraph
    text = text.split('\n\n').map(para => 
      para.trim() ? `<p class="message-paragraph">${para.replace(/\n/g, '<br>')}</p>` : ''
    ).join('');
    
    return text;
  }
  
  /**
   * Escape HTML special characters to prevent XSS in code blocks
   * @param {string} unsafe - Raw text that might contain HTML
   * @returns {string} - HTML-escaped text
   */
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  // Add event listener to handle messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'check-saved-state') {
      // Check if current session is saved
      loadSavedChats().then(savedChats => {
        const isSaved = savedChats.some(chat => chat.sessionId === currentSessionId);
        updateSaveButtonState(isSaved);
        sendResponse({ isSaved: isSaved });
      });
      return true;
    }
  });

  // Start the chat panel
  initializePanel();
});