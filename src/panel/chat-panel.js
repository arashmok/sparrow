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
    apiIndicator: document.getElementById('api-indicator')
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
  
  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  
  /**
   * Initialize the chat panel
   * - Loads settings from storage
   * - Sets up event listeners
   * - Configures API indicators
   */
  async function initializePanel() {
    // Load settings from local storage
    loadApiSettings();
    
    // Configure event listeners for message sending
    setupEventListeners();
    
    // Listen for messages from the background script
    setupBackgroundMessageListener();
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
  function addMessage(text, role) {
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
  
  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  
  // Start the chat panel
  initializePanel();
});