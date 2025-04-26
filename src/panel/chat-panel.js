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
    backToChatBtn: document.getElementById('back-to-chat-btn')
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
    // Load settings from local storage
    loadApiSettings();
    
    // Configure event listeners for message sending
    setupEventListeners();

    // Setup session ID
    generateOrRestoreSessionId();
    
    // Setup additional event listeners for saving
    setupSavingEventListeners();
    
    // Check if the panel should open directly to saved chats view
    checkForSavedChatsView();
    
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
   * Set up event listeners for user interactions
   */
  function setupEventListeners() {
    // Send button click event
    UI.sendButton.addEventListener('click', sendMessage);
    
    // Enter key press event (without shift for newline)
    UI.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
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
    
    // Update save button if chat was previously saved
    if (isChatSaved) {
      // Visual indication that there are unsaved changes
      UI.saveChatBtn.classList.add('has-changes');
      UI.saveChatBtn.title = 'Save changes to this chat';
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
    
    if (showSaved === 'true') {
      loadSavedChatsAndShow();
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
        let chatTitle = chat.title;
        if (!chatTitle && chat.messages.length > 0) {
          // Use first few words of first message
          const firstMsg = chat.messages[0].content;
          chatTitle = firstMsg.split(' ').slice(0, 7).join(' ') + '...';
        }
        
        chatItem.innerHTML = `
          <div class="saved-chat-title">${chatTitle}</div>
          <div class="saved-chat-info">
            <span>${new URL(chat.url).hostname || 'Unknown site'}</span>
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
          
          if (confirm('Delete this saved chat?')) {
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
          }
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