/**
 * background.js - Handles API calls and background processes for the Sparrow extension
 * 
 * This script manages:
 * - API communication with various LLM providers (OpenAI, LM Studio, Ollama, OpenRouter)
 * - Text summarization processing
 * - Chat functionality
 * - Side panel operations
 */

// ==========================================================================================
// CONSTANTS AND CONFIGURATION
// ==========================================================================================

// OpenAI API endpoint for chat completions
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Default configuration for API calls
let CONFIG = {
  API_MODE: 'openai',  // Default API mode
  MAX_TOKENS: 500,     // Maximum tokens in response
  TEMPERATURE: 0.5     // Creativity level (higher = more creative)
};

// Text processing limits
const MAX_CHUNK_SIZE = 3500;  // Maximum size for a single text chunk (in characters)
const MAX_CHUNKS = 5;         // Maximum number of chunks to process (prevents excessive API calls)

// ==========================================================================================
// ENCRYPTION UTILITIES
// ==========================================================================================

// Encryption utilities
const encryptionUtils = {
  // Generate a consistent encryption key based on extension ID and other browser-specific values
  getEncryptionKey: function() {
    // Use extension ID as part of the encryption key
    return chrome.runtime.id + "-sparrow-secure-key";
  },
  
  // Encrypt a string using AES
  encrypt: function(text) {
    if (!text) return '';
    // Simple XOR-based encryption (for demonstration)
    // In production, use a library like crypto-js for proper encryption
    const key = this.getEncryptionKey();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result); // Base64 encode
  },
  
  // Decrypt a string
  decrypt: function(encryptedText) {
    if (!encryptedText) return '';
    try {
      const key = this.getEncryptionKey();
      const text = atob(encryptedText); // Base64 decode
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch (e) {
      console.error('Decryption failed', e);
      return '';
    }
  }
};

// Secure key management
const secureKeyStore = {
  keys: {}, // In-memory key cache
  
  // Store a key both in memory and encrypted in storage
  storeKey: function(service, key) {
    if (!key) return false;
    
    // Store in memory
    this.keys[service] = key;
    
    // Store encrypted in chrome.storage.local
    const encryptedKey = encryptionUtils.encrypt(key);
    const storageKey = `encrypted_${service}_key`;
    const storageObj = {};
    storageObj[storageKey] = encryptedKey;
    
    chrome.storage.local.set(storageObj);
    return true;
  },
  
  // Get a key from memory or storage
  getKey: function(service) {
    // If key is in memory, return it
    if (this.keys[service]) {
      return this.keys[service];
    }
    
    // Otherwise, try to load from storage
    return this.loadKeyFromStorage(service);
  },
  
  // Load key from storage (synchronous version returns null, use async for actual value)
  loadKeyFromStorage: function(service) {
    // Use a placeholder - this will be replaced when the async version completes
    this.loadKeyFromStorageAsync(service);
    return null;
  },
  
  // Asynchronously load key from storage
  loadKeyFromStorageAsync: function(service) {
    const storageKey = `encrypted_${service}_key`;
    chrome.storage.local.get([storageKey], (result) => {
      if (result[storageKey]) {
        // Decrypt and store in memory
        this.keys[service] = encryptionUtils.decrypt(result[storageKey]);
      }
    });
  },
  
  // Check if a key exists
  hasKey: function(service, callback) {
    // If already in memory
    if (this.keys[service]) {
      callback(true);
      return;
    }
    
    // Check storage
    const storageKey = `encrypted_${service}_key`;
    chrome.storage.local.get([storageKey], (result) => {
      callback(!!result[storageKey]);
    });
  }
};

// Initialize by loading keys from storage
function initializeSecureKeyStore() {
  const services = ['openai', 'openrouter', 'lmstudio', 'ollama'];
  services.forEach(service => {
    secureKeyStore.loadKeyFromStorageAsync(service);
  });
}

// Load keys when background script starts
initializeSecureKeyStore();

// ==========================================================================================
// MODEL AND DISPLAY UTILITIES
// ==========================================================================================

/**
 * Gets model display information based on API provider and model name
 * 
 * @param {string} apiMode - The API provider (openai, lmstudio, ollama, openrouter)
 * @param {string} modelName - The full model name
 * @returns {Object} Object containing display class and shortened model name
 */
function getModelDisplayInfo(apiMode, modelName) {
  let statusClass = '';
  
  // Set color class based on API source
  switch (apiMode) {
    case 'lmstudio':
      statusClass = 'indicator-lmstudio';
      break;
    case 'ollama':
      statusClass = 'indicator-ollama';
      break;
    case 'openrouter':
      statusClass = 'indicator-openrouter';
      break;
    default: // Default to OpenAI
      statusClass = 'indicator-openai';
  }
  
  // Get shortened model name for display
  let displayName = truncateModelName(modelName);
  
  return {
    class: statusClass,
    name: displayName
  };
}

/**
 * Truncates model name for display purposes
 * 
 * @param {string} modelName - The full model name
 * @returns {string} Truncated model name
 */
function truncateModelName(modelName) {
  if (!modelName) {
    return '';
  }
  
  // Get last part of model name if it contains slashes (e.g., "organization/model-name")
  if (modelName.includes('/')) {
    modelName = modelName.split('/').pop();
  }
  
  // Truncate if too long for UI display
  if (modelName.length > 15) {
    return modelName.substring(0, 12) + '...';
  }
  return modelName;
}

// ==========================================================================================
// SIDE PANEL AND MESSAGING HANDLERS
// ==========================================================================================

/**
 * Message listener for handling various extension actions
 * Processes side panel operations and chat functionality
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle side panel opening requests
  if (request.action === 'open-chat-panel') {
    // Store the generated text for the side panel to access
    if (request.generatedText) {
      // Preserve and enhance formatting for chat panel
      const enhancedText = prepareTextForChatPanel(request.generatedText);
      chrome.storage.local.set({ latestSummary: enhancedText });
    }
    
    // Open the side panel with the chat interface
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id;
      chrome.sidePanel.open({ tabId: tabId }).then(() => {
        // Set the side panel page to the chat panel HTML
        chrome.sidePanel.setOptions({
          path: 'src/panel/chat-panel.html',
          enabled: true
        });
        
        // Send a message to initialize the chat panel with the generated text
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'chat-initiate',
            tabId: tabId,
            pageContent: request.generatedText,
            chatAction: request.chatAction
          });
        }, 500); // Give the side panel time to load
        
        sendResponse({ success: true });
      }).catch(error => {
        console.error("Error opening side panel:", error);
        sendResponse({ success: false, error: error.message });
      });
    });
    
    return true; // Keep the messaging channel open for asynchronous sendResponse
  }
  
  // Handle chat message requests (for API communication)
  if (request.action === 'chat-message') {
    handleChatMessage(request)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    
    return true; // Indicate asynchronous response
  }
  
  // Handle secure key storage
  if (request.action === 'store-api-key') {
    secureKeyStore.storeKey(request.service, request.key);
    sendResponse({ success: true });
    return true;
  }
  
  // Handle API key checks
  if (request.action === 'check-api-key') {
    secureKeyStore.hasKey(request.service, (hasKey) => {
      sendResponse({ hasKey: hasKey });
    });
    return true;
  }
});

/**
 * Message listener for popup requests
 * Handles summarization requests from the popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    // Get current settings from storage
    chrome.storage.local.get([
      'apiMode', 
      'apiKey', 
      'openaiModel',
      'lmstudioApiUrl',
      'lmstudioApiKey',
      'lmstudioModel',
      'ollamaApiUrl',
      'ollamaModel',
      'openrouterApiKey',
      'openrouterModel'
    ], async (settings) => {
      try {
        // Determine which API to use based on settings
        const apiMode = settings.apiMode || 'openai';
        console.log("Using API mode:", apiMode);
        
        let summary;
        
        // Route to the appropriate API handler based on selected mode
        switch (apiMode) {
          case 'openai':
            // Use OpenAI API
            const apiKey = settings.apiKey;
            const model = settings.openaiModel || 'gpt-3.5-turbo';
            
            if (!apiKey) {
              sendResponse({ error: 'No OpenAI API key found. Please add your API key in the extension settings.' });
              return;
            }
            
            summary = await generateOpenAISummary(request.text, request.format, apiKey, model, request.translateToEnglish);
            break;
            
          case 'lmstudio':
            // Use LM Studio API
            const lmStudioUrl = settings.lmstudioApiUrl || 'http://localhost:1234/v1';
            const lmStudioKey = settings.lmstudioApiKey || '';
            const lmStudioModel = settings.lmstudioModel || '';
            
            if (!lmStudioUrl) {
              sendResponse({ error: 'No LM Studio server URL found. Please check your settings.' });
              return;
            }
            
            summary = await generateLMStudioSummary(request.text, request.format, lmStudioUrl, lmStudioKey, request.translateToEnglish, lmStudioModel);
            break;
            
          case 'ollama':
            // Use Ollama API
            const ollamaApiUrl = settings.ollamaApiUrl || 'http://localhost:11434/api';
            const ollamaModel = settings.ollamaModel || 'llama2';
            
            if (!ollamaApiUrl) {
              sendResponse({ error: 'No Ollama server URL found. Please check your settings.' });
              return;
            }
            
            summary = await generateOllamaSummary(request.text, request.format, ollamaApiUrl, ollamaModel, request.translateToEnglish);
            break;
            
          case 'openrouter':
            // Use OpenRouter API
            const openRouterKey = settings.openrouterApiKey;
            const openRouterModel = settings.openrouterModel;
            
            if (!openRouterKey) {
              sendResponse({ error: 'No OpenRouter API key found. Please add your API key in the extension settings.' });
              return;
            }
            
            summary = await generateOpenRouterSummary(request.text, request.format, openRouterKey, openRouterModel, request.translateToEnglish);
            break;
            
          default:
            sendResponse({ error: `Unknown API mode: ${apiMode}` });
            return;
        }
        
        // Return the summary to the popup
        sendResponse({ summary: summary });
      } catch (error) {
        console.error('Error generating summary:', error);
        sendResponse({ error: error.message });
      }
    });
    
    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

// ==========================================================================================
// CONTENT EXTRACTION FUNCTIONS
// ==========================================================================================

/**
 * Extracts content from the current page
 * Note: This function runs in the context of web pages through the content script
 * 
 * @returns {string} The extracted content with page metadata
 */
function extractPageContent() {
  try {
    // Get page metadata
    const pageTitle = document.title || '';
    const pageUrl = window.location.href;
    
    // Extract main content using similar logic to your existing content.js
    let mainContent = '';
    
    // Try to find the main content container using common selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.main-content',
      '#main-content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content'
    ];
    
    // Try each selector until we find content
    let contentElement = null;
    
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // Use the element with the most text content
        contentElement = Array.from(elements).reduce((largest, current) => {
          return (current.textContent.length > largest.textContent.length) ? current : largest;
        }, elements[0]);
        
        if (contentElement.textContent.length > 500) {
          break; // Found substantial content
        }
      }
    }
    
    // If we found a specific content element, use it
    if (contentElement && contentElement.textContent.trim().length > 0) {
      mainContent = contentElement.textContent;
    } else {
      // Otherwise, use a more general approach to extract relevant content
      // Get all paragraphs and headings
      const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      
      // Filter out elements that are likely not main content
      const contentElements = Array.from(paragraphs).filter(element => {
        // Skip very short paragraphs that might be UI elements
        if (element.textContent.trim().length < 20 && !element.tagName.startsWith('H')) {
          return false;
        }
        
        // Skip elements in navigation, footer, sidebar, etc.
        const parent = findParentOfType(element, [
          'nav', 'footer', 'aside', 
          '[role="navigation"]', '[role="complementary"]',
          '.nav', '.navigation', '.menu', '.footer', '.sidebar', '.widget', '.comment'
        ]);
        
        return !parent; // Keep elements that don't have these parents
      });
      
      // Combine the filtered elements
      mainContent = contentElements.map(el => el.textContent.trim()).join('\n\n');
    }
    
    // If we couldn't extract meaningful content, try a last resort approach
    if (mainContent.length < 500) {
      // Get all text from the body, removing scripts and styles
      const bodyClone = document.body.cloneNode(true);
      const scripts = bodyClone.querySelectorAll('script, style, noscript, svg, canvas, iframe');
      scripts.forEach(script => script.remove());
      
      mainContent = bodyClone.textContent.trim();
    }
    
    // Prepare the final text
    return `Title: ${pageTitle}\nURL: ${pageUrl}\n\n${mainContent}`;
    
  } catch (error) {
    console.error('Error extracting page content:', error);
    return `Error extracting content: ${error.message}`;
  }
}

// ==========================================================================================
// CHAT HANDLING FUNCTIONS
// ==========================================================================================

/**
 * Handles chat messages and routes to appropriate API provider
 * 
 * @param {Object} request - The message request containing text and history
 * @returns {Promise<Object>} The chat response
 */
async function handleChatMessage(request) {
  try {
    // Get the settings from storage
    const settings = await chrome.storage.local.get([
      'apiMode', 
      'apiKey', 
      'openaiModel',
      'lmstudioApiUrl',
      'lmstudioApiKey',
      'lmstudioModel',
      'ollamaApiUrl',
      'ollamaModel',
      'openrouterApiKey',
      'openrouterModel'
    ]);
    
    // Determine which API to use
    const apiMode = settings.apiMode || 'openai';
    console.log("Using API mode for chat:", apiMode);
    
    // User message from request
    const userMessage = request.text;
    
    // Generate response based on API mode
    let reply;
    
    // Route to appropriate API handler
    switch (apiMode) {
      case 'openai':
        // Use OpenAI API
        const apiKey = settings.apiKey || secureKeyStore.getKey('openai');
        const model = settings.openaiModel || 'gpt-3.5-turbo';
        
        if (!apiKey) {
          throw new Error('No OpenAI API key found. Please add your API key in the extension settings.');
        }
        
        reply = await generateOpenAIChatResponse(userMessage, request.history || [], apiKey, model, false);
        break;
        
      case 'lmstudio':
        // Use LM Studio API
        const lmStudioUrl = settings.lmstudioApiUrl || 'http://localhost:1234/v1';
        const lmStudioKey = settings.lmstudioApiKey || '';
        const lmStudioModel = settings.lmstudioModel || '';
        
        if (!lmStudioUrl) {
          throw new Error('No LM Studio server URL found. Please check your settings.');
        }
        
        reply = await generateLMStudioChatResponse(userMessage, request.history || [], lmStudioUrl, lmStudioKey, lmStudioModel);
        break;
        
      case 'ollama':
        // Use Ollama API
        const ollamaApiUrl = settings.ollamaApiUrl || 'http://localhost:11434/api';
        const ollamaModel = settings.ollamaModel || 'llama2';
        
        if (!ollamaApiUrl) {
          throw new Error('No Ollama server URL found. Please check your settings.');
        }
        
        if (!ollamaModel) {
          throw new Error('No Ollama model specified. Please check your settings.');
        }
        
        reply = await generateOllamaChatResponse(userMessage, request.history || [], ollamaApiUrl, ollamaModel, false);
        break;
        
      case 'openrouter':
        // Use OpenRouter API
        const openRouterApiKey = settings.openrouterApiKey;
        const openRouterModel = settings.openrouterModel || 'gpt-3.5-turbo';
        
        if (!openRouterApiKey) {
          throw new Error('No OpenRouter API key found. Please add your API key in the extension settings.');
        }
        
        reply = await generateOpenRouterChatResponse(userMessage, request.history || [], openRouterApiKey, openRouterModel, false);
        break;
        
      default:
        throw new Error(`Unknown API mode: ${apiMode}`);
    }
    
    // Format the response for display
    if (typeof reply === 'string') {
      // Ensure code blocks have proper spacing
      reply = reply.replace(/```(\w*)\n/g, '```$1\n');
      
      // Make sure lists have proper spacing for markdown conversion
      reply = reply.replace(/^([*-])/gm, '\n$1');
    } else if (reply && reply.text) {
      // Handle case where reply is an object with text property
      reply.text = reply.text.replace(/```(\w*)\n/g, '```$1\n');
      reply.text = reply.text.replace(/^([*-])/gm, '\n$1');
      reply = reply.text;
    }
    
    return { reply };
  } catch (error) {
    console.error('Error handling chat message:', error);
    return { error: error.message };
  }
}

// ==========================================================================================
// CHAT API FUNCTIONS
// ==========================================================================================

/**
 * Format conversation history into the structure expected by chat APIs
 * 
 * @param {Array} history - The conversation history array
 * @returns {Array} Formatted history array
 */
function formatChatHistory(history) {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return [];
  }
  
  // Filter out any invalid entries and ensure proper formatting
  return history.filter(entry => 
    entry && typeof entry === 'object' && 
    entry.role && typeof entry.role === 'string' &&
    entry.content && typeof entry.content === 'string'
  );
}

/**
 * Generate a chat response using OpenAI's API
 * 
 * @param {string} userMessage - The user's message
 * @param {Array} history - Conversation history
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model name
 * @returns {Promise<string>} The generated response
 */
async function generateOpenAIChatResponse(userMessage, history, apiKey, model) {
  try {
    // Prepare conversation messages
    let messages = [];
    
    // System message to set the context
    messages.push({
      role: 'system',
      content: 'You are Sparrow, an AI assistant integrated with a Chrome extension. You help users understand and interact with web content. Be concise, helpful, and conversational.'
    });
    
    // Add conversation history if available
    if (history && history.length > 0) {
      messages = messages.concat(history);
    }
    
    // Add the current user message if not already in history
    if (!history || !history.some(msg => msg.role === 'user' && msg.content === userMessage)) {
      messages.push({
        role: 'user',
        content: userMessage
      });
    }
    
    // Use stored key if none provided
    const keyToUse = apiKey || secureKeyStore.getKey('openai');
    if (!keyToUse) {
      throw new Error('No OpenAI API key found. Please check your settings.');
    }
    
    // Make the API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    // Handle API errors
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to generate response (Status: ${response.status})`);
    }
    
    // Process the response
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating OpenAI chat response:', error);
    throw error;
  }
}

/**
 * Generate a chat response using LM Studio's API
 * 
 * @param {string} userMessage - The user's message
 * @param {Array} history - Conversation history
 * @param {string} apiUrl - LM Studio API URL
 * @param {string} apiKey - LM Studio API key
 * @param {string} model - Model name to use
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {Promise<string>} The generated chat reply
 */
async function generateLMStudioChatResponse(userMessage, history, apiUrl, apiKey, model, translateToEnglish = false) {
  // Prepare conversation messages similar to OpenAI
  let messages = [{
    role: 'system',
    content: 'You are Sparrow, an AI assistant integrated with a Chrome extension. You help users understand and interact with web content. Be concise, helpful, and conversational.'
  }];
  
  // Add conversation history if available
  if (history && history.length > 0) {
    messages = messages.concat(history);
  }
  
  // Add the current message if not present
  if (!history || !history.some(msg => msg.role === 'user' && msg.content === userMessage)) {
    messages.push({
      role: 'user',
      content: userMessage
    });
  }

  // Build the LM Studio API endpoint URL
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  
  // Add API key if provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  try {
    // Prepare request body
    const requestBody = {
      messages: messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE
    };
    
    // Only add model if it's provided and not empty
    if (model && model.trim()) {
      requestBody.model = model;
    }
    
    console.log("Sending LM Studio chat request to:", endpoint);
    
    // Make the API request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    // Handle API errors
    if (!response.ok) {
      // Try to get detailed error info
      let errorMessage = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If JSON parsing fails, use the status code
      }
      
      // Log additional debug info
      console.error("LM Studio request details:", {
        endpoint,
        modelProvided: !!model,
        bodySize: JSON.stringify(requestBody).length,
        responseStatus: response.status
      });
      
      throw new Error(`Failed to generate response: ${errorMessage}`);
    }
    
    // Process the response
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating LM Studio chat response:', error);
    
    // Attempt fallback if the chat endpoint failed
    if (error.message.includes("Status: 400") || error.message.includes("Status: 404")) {
      try {
        console.log("Trying fallback approach for LM Studio...");
        // Create a single prompt with all messages concatenated
        const systemMessage = 'You are Sparrow, an AI assistant integrated with a Chrome extension. You help users understand and interact with web content. Be concise, helpful, and conversational.';
        
        // Format history as a conversation
        let conversationText = systemMessage + "\n\n";
        
        if (history && history.length > 0) {
          history.forEach(msg => {
            const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
            conversationText += `${role}: ${msg.content}\n\n`;
          });
        }
        
        conversationText += `User: ${userMessage}\n\nAssistant:`;
        
        // Build the completions endpoint URL
        const completionsEndpoint = `${apiUrl.replace(/\/+$/, '')}/completions`;
        
        // Make the API request
        const response = await fetch(completionsEndpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            prompt: conversationText,
            max_tokens: CONFIG.MAX_TOKENS,
            temperature: CONFIG.TEMPERATURE,
            model: model || undefined,
            stream: false
          })
        });
        
        if (!response.ok) {
          throw new Error(`Fallback failed, status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].text.trim();
      } catch (fallbackError) {
        console.error('LM Studio fallback also failed:', fallbackError);
        // Re-throw the original error if fallback fails
        throw error;
      }
    }
    
    throw error;
  }
}

/**
 * Generate a chat response using Ollama's API
 * 
 * @param {string} userMessage - The user's message
 * @param {Array} history - Conversation history
 * @param {string} apiUrl - Ollama API base URL
 * @param {string} model - Ollama model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated chat reply
 */
async function generateOllamaChatResponse(userMessage, history, apiUrl, model, translateToEnglish = false) {
  // Prepare conversation messages similar to OpenAI
  let messages = [{
    role: 'system',
    content: 'You are Sparrow, an AI assistant integrated with a Chrome extension. You help users understand and interact with web content. Be concise, helpful, and conversational.'
  }];
  
  // Add conversation history if available
  if (history && history.length > 0) {
    messages = messages.concat(history);
  }
  
  // Add the current user message if not already in history
  if (!history || !history.some(msg => msg.role === 'user' && msg.content === userMessage)) {
    messages.push({
      role: 'user',
      content: userMessage
    });
  }

  // Build the Ollama API chat endpoint
  const endpoint = `${apiUrl.replace(/\/+$/, '')}/chat`;
  
  try {
    console.log("Sending Ollama chat request:", { endpoint, model, messageCount: messages.length });
    
    // Make the API request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        options: { temperature: CONFIG.TEMPERATURE },
        stream: false
      })
    });
    
    // Handle API errors
    if (!response.ok) {
      let errorMessage = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If JSON parsing fails
      }
      throw new Error(`Failed to generate response: ${errorMessage}`);
    }
    
    // Process the response
    const data = await response.json();
    let reply = '';
    
    // Handle different response formats from Ollama
    if (data.message && data.message.content) {
      reply = data.message.content.trim();
    } else if (data.response) {
      reply = data.response.trim();
    } else {
      throw new Error('Unexpected response format from Ollama API');
    }
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      reply = "[Translated to English] " + reply;
    }
    
    return reply;
  } catch (error) {
    console.error('Error generating Ollama chat response:', error);
    throw error;
  }
}

/**
 * Generate a chat response using OpenRouter's API
 * 
 * @param {string} userMessage - The user's message
 * @param {Array} history - Conversation history
 * @param {string} apiKey - OpenRouter API key
 * @param {string} model - Model name
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated chat reply
 */
async function generateOpenRouterChatResponse(userMessage, history, apiKey, model, translateToEnglish = false) {
  try {
    // Prepare conversation messages
    let messages = [];
    
    // System message to set the context
    messages.push({
      role: 'system',
      content: 'You are Sparrow, an AI assistant integrated with a Chrome extension. You help users understand and interact with web content. Be concise, helpful, and conversational.'
    });
    
    // Add conversation history if available
    if (history && history.length > 0) {
      messages = messages.concat(history);
    }
    
    // Add the current user message if not already in history
    if (!history || !history.some(msg => msg.role === 'user' && msg.content === userMessage)) {
      messages.push({
        role: 'user',
        content: userMessage
      });
    }
    
    // Use stored key if none provided
    const keyToUse = apiKey || secureKeyStore.getKey('openrouter');
    if (!keyToUse) {
      throw new Error('No OpenRouter API key found. Please check your settings.');
    }
    
    // Make the API call
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`,
        'HTTP-Referer': 'https://github.com/arashmok/sparrow', // Replace with your actual repo URL
        'X-Title': 'Sparrow Extension'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    // Handle API errors
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to generate response (Status: ${response.status})`);
    }
    
    // Process the response
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating OpenRouter chat response:', error);
    throw error;
  }
}

// ==========================================================================================
// SUMMARIZATION API FUNCTIONS
// ==========================================================================================

/**
 * Generates a summary using OpenAI's API
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiKey - The OpenAI API key
 * @param {string} model - The OpenAI model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOpenAISummary(text, format, apiKey, model, translateToEnglish = false) {
  try {
    // Check if we need to use chunking (if the text is larger than our maximum chunk size)
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callOpenAIAPI(chunk, chunkFormat, apiKey, model, isTranslate);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callOpenAIAPI(text, format, apiKey, model, translateToEnglish);
    }
  } catch (error) {
    console.error('Error in OpenAI summarization:', error);
    throw new Error('Failed to generate summary with OpenAI. Please check your API key and try again.');
  }
}

/**
 * Makes the actual API call to OpenAI
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiKey - The OpenAI API key
 * @param {string} model - The model to use
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {Promise<string>} The generated summary
 */
async function callOpenAIAPI(text, format, apiKey, model, translateToEnglish = false) {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);
  
  // Use stored key if none provided
  const keyToUse = apiKey || secureKeyStore.getKey('openai');
  if (!keyToUse) {
    throw new Error('No OpenAI API key found. Please check your settings.');
  }

  try {
    // Make the API call
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.5
      })
    });
    
    // Handle API errors
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to generate summary (Status: ${response.status})`);
    }
    
    // Process the response
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Generates a summary using the LM Studio API
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The LM Studio API URL
 * @param {string} apiKey - The LM Studio API key (optional)
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @param {string} model - The model to use (optional)
 * @returns {Promise<string>} The generated summary
 */
async function generateLMStudioSummary(text, format, apiUrl, apiKey = '', translateToEnglish = false, model = '') {
  try {
    // Check if we need to use chunking
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callLMStudioAPI(chunk, chunkFormat, apiUrl, apiKey, isTranslate, model);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callLMStudioAPI(text, format, apiUrl, apiKey, translateToEnglish, model);
    }
  } catch (error) {
    console.error('Error in LM Studio summarization:', error);
    throw new Error(`Failed to connect to LM Studio server at ${apiUrl}. Please check that LM Studio is running and your settings are correct.`);
  }
}

/**
 * Makes the actual API call to LM Studio
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiUrl - The LM Studio API URL
 * @param {string} apiKey - The API key (optional)
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @param {string} model - The model to use (optional)
 * @returns {Promise<string>} The generated summary
 */
async function callLMStudioAPI(text, format, apiUrl, apiKey = '', translateToEnglish = false, model = '') {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);
  
  // Use stored key if provided, but don't require it
  const keyToUse = apiKey || secureKeyStore.getKey('lmstudio') || '';

  // Ensure apiUrl has the correct endpoint
  const chatEndpoint = apiUrl.endsWith('/chat/completions') ? 
    apiUrl : 
    `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  
  try {
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json'
    };

    // Only add Authorization header if we have a key
    if (keyToUse) {
      headers['Authorization'] = `Bearer ${keyToUse}`;
    }
    
    // Prepare request body - IMPORTANT: DON'T include empty model
    const requestBody = {
      messages: [
        { 
          role: 'system', 
          content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.5,
      stream: false
    };
    
    // Only add model if it's non-empty and meaningful
    if (model && model.trim() !== '' && model !== 'default') {
      requestBody.model = model;
    }
    
    // Make the API call to LM Studio
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    // Handle API errors
    if (!response.ok) {
      let errorMessage = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status code
      }
      throw new Error(`Failed to generate summary: ${errorMessage}`);
    }
    
    // Process the response
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling LM Studio API:', error);
    throw error;
  }
}

/**
 * Generates a summary using the Ollama API
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The Ollama API URL (base URL)
 * @param {string} model - The Ollama model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOllamaSummary(text, format, apiUrl, model, translateToEnglish = false) {
  try {
    // Check if we need to use chunking
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callOllamaAPI(chunk, chunkFormat, apiUrl, model, isTranslate);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callOllamaAPI(text, format, apiUrl, model, translateToEnglish);
    }
  } catch (error) {
    console.error('Error in Ollama summarization:', error);
    throw new Error(`Failed to connect to Ollama server at ${apiUrl}. Please ensure Ollama is running, the model is loaded, and CORS is properly configured.`);
  }
}

/**
 * Makes the actual API call to Ollama
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiUrl - The Ollama API URL
 * @param {string} model - The model to use
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {Promise<string>} The generated summary
 */
async function callOllamaAPI(text, format, apiUrl, model, translateToEnglish = false) {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);

  try {
    // Ensure apiUrl has the correct format (remove trailing slash if present)
    const baseUrl = apiUrl.replace(/\/+$/, '');
    
    // Ollama uses a different endpoint structure than OpenAI
    // For chat completions we need to use /api/chat
    const chatEndpoint = `${baseUrl}/chat`;
    
    console.log("Ollama API request to:", chatEndpoint);
    
    // Make the API call to Ollama
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
          },
          { role: 'user', content: prompt }
        ],
        options: {
          temperature: 0.5
        },
        stream: false
      })
    });
    
    // Try fallback if the chat endpoint fails
    if (!response.ok) {
      // Try a fallback to the older Ollama API format if the chat endpoint fails
      return await generateOllamaFallbackSummary(text, format, apiUrl, model, translateToEnglish);
    }
    
    // Process the response
    const data = await response.json();
    
    // Ollama might have a slightly different response format than OpenAI
    let summary = '';
    if (data.message && data.message.content) {
      summary = data.message.content.trim();
    } else if (data.response) {
      // Fallback for older Ollama versions
      summary = data.response.trim();
    } else {
      throw new Error('Unexpected response format from Ollama API');
    }
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
}

/**
 * Fallback for older Ollama API versions that use the /api/generate endpoint
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The Ollama API URL (base URL)
 * @param {string} model - The Ollama model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOllamaFallbackSummary(text, format, apiUrl, model, translateToEnglish = false) {
  // Create the optimized prompt with system message included
  const systemMessage = 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.';
  const userPrompt = createPrompt(text, format, translateToEnglish);
  const fullPrompt = `${systemMessage}\n\n${userPrompt}`;
  
  try {
    // Ensure apiUrl has the correct format (remove trailing slash if present)
    const baseUrl = apiUrl.replace(/\/+$/, '');
    
    // Old Ollama endpoint for completions
    const generateEndpoint = `${baseUrl}/generate`;
    
    console.log("Ollama API fallback request to:", generateEndpoint);
    
    // Make the API call to Ollama's generate endpoint
    const response = await fetch(generateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        options: {
          temperature: 0.5
        },
        stream: false
      })
    });
    
    // Handle API errors
    if (!response.ok) {
      let errorMessage = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status code
      }
      throw new Error(`Failed to generate summary: ${errorMessage}`);
    }
    
    // Process the response
    const data = await response.json();
    
    // Extract the response from Ollama
    let summary = '';
    if (data.response) {
      summary = data.response.trim();
    } else {
      throw new Error('Unexpected response format from Ollama API');
    }
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling Ollama generate API:', error);
    throw error;
  }
}

/**
 * Generates a summary using the OpenRouter API
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiKey - The OpenRouter API key
 * @param {string} model - The OpenRouter model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOpenRouterSummary(text, format, apiKey, model, translateToEnglish = false) {
  try {
    // Check if we need to use chunking
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callOpenRouterAPI(chunk, chunkFormat, apiKey, model, isTranslate);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callOpenRouterAPI(text, format, apiKey, model, translateToEnglish);
    }
  } catch (error) {
    console.error('Error in OpenRouter summarization:', error);
    throw new Error('Failed to generate summary with OpenRouter. Please check your API key and try again.');
  }
}

/**
 * Makes the actual API call to OpenRouter
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiKey - The OpenRouter API key
 * @param {string} model - The model to use
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {Promise<string>} The generated summary
 */
async function callOpenRouterAPI(text, format, apiKey, model, translateToEnglish = false) {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);
  
  // Use stored key if none provided
  const keyToUse = apiKey || secureKeyStore.getKey('openrouter');
  if (!keyToUse) {
    throw new Error('No OpenRouter API key found. Please check your settings.');
  }

  try {
    // Make the API call
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.5
      })
    });
    
    // Handle API errors
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to generate summary (Status: ${response.status})`);
    }
    
    // Process the response
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed - ONLY if requested
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    throw error;
  }
}

// ==========================================================================================
// TEXT PROCESSING UTILITIES
// ==========================================================================================

/**
 * Process large text by splitting it into chunks, summarizing each chunk,
 * and then creating a final summary of all the chunk summaries.
 * 
 * @param {string} text - The full text to summarize
 * @param {string} format - The desired summary format
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @param {Function} apiCallFn - Function to call the specific API for summarization
 * @returns {Promise<string>} The final summary
 */
async function processLargeText(text, format, translateToEnglish, apiCallFn) {
  try {
    console.log(`Processing large text of length: ${text.length}`);
    
    // Split the text into chunks
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_SIZE);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Limit to maximum number of chunks to avoid excessive API calls
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
    if (chunks.length > MAX_CHUNKS) {
      console.log(`Only processing first ${MAX_CHUNKS} chunks due to size constraints`);
    }
    
    // Use 'detailed' format for individual chunks to preserve more information
    const chunkFormat = 'detailed';
    
    // Process each chunk and collect summaries
    const chunkSummaries = [];
    for (let i = 0; i < chunksToProcess.length; i++) {
      console.log(`Processing chunk ${i+1} of ${chunksToProcess.length}`);
      const chunk = chunksToProcess[i];
      
      // Add chunk number information to help with context
      const chunkWithContext = `[PART ${i+1} OF ${chunksToProcess.length}]\n\n${chunk}`;
      
      // Get summary for this chunk
      let chunkSummary = await apiCallFn(chunkWithContext, chunkFormat, translateToEnglish);
      
      // Remove translation prefix if present (we'll add it back to the final summary)
      chunkSummary = chunkSummary.replace("[Translated to English] ", "");
      
      chunkSummaries.push(chunkSummary);
    }
    
    // If we only have one chunk, return it directly
    if (chunkSummaries.length === 1) {
      return translateToEnglish ? 
        "[Translated to English] " + chunkSummaries[0] : 
        chunkSummaries[0];
    }
    
    // Combine chunk summaries
    const combinedText = chunkSummaries.join("\n\n");
    
    // Generate final summary from the combined chunk summaries
    console.log("Generating final summary from combined chunk summaries");
    const finalPrompt = createFinalSummaryPrompt(combinedText, format, chunks.length);
    
    // Use a simpler system message for the final summarization
    const finalSummary = await apiCallFn(finalPrompt, format, false);
    
    // Add translation prefix if the original request was for translation
    return translateToEnglish ? 
      "[Translated to English] " + finalSummary : 
      finalSummary;
    
  } catch (error) {
    console.error("Error processing large text:", error);
    throw error;
  }
}

/**
 * Splits text into manageable chunks, trying to preserve paragraphs
 * 
 * @param {string} text - The text to split
 * @param {number} maxChunkSize - Maximum size for each chunk
 * @returns {Array<string>} Array of text chunks
 */
function splitTextIntoChunks(text, maxChunkSize) {
  // Split by paragraphs first (double newlines)
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";
  
  // First pass: combine paragraphs into chunks without exceeding maxChunkSize
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the chunk size
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      // Store the current chunk and start a new one
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      // Add to the current chunk
      if (currentChunk.length > 0) {
        currentChunk += "\n\n";
      }
      currentChunk += paragraph;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  // Second pass: handle the case where a single paragraph is larger than maxChunkSize
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      finalChunks.push(chunk);
    } else {
      // Split by sentences for very large paragraphs
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
      let sentenceChunk = "";
      
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length > maxChunkSize && sentenceChunk.length > 0) {
          finalChunks.push(sentenceChunk);
          sentenceChunk = sentence;
        } else {
          sentenceChunk += sentence;
        }
      }
      
      if (sentenceChunk.length > 0) {
        finalChunks.push(sentenceChunk);
      }
    }
  }
  
  return finalChunks;
}

/**
 * Creates a prompt for the final summarization of multiple chunk summaries
 * 
 * @param {string} combinedSummaries - The combined summaries from all chunks
 * @param {string} format - The desired format for the final summary
 * @param {number} totalChunks - The total number of chunks processed
 * @returns {string} The formatted prompt
 */
function createFinalSummaryPrompt(combinedSummaries, format, totalChunks) {
  return `The following text contains a series of summaries from different sections of a long webpage.
Your task is to create a coherent final summary that captures the key information from ALL sections.
Make sure to include key information from each section in your final summary.

${combinedSummaries}

Please provide a ${format} summary that covers all the important points from all sections.`;
}

/**
 * Creates an optimized prompt for the summary based on format and translation preference
 * 
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {string} The formatted prompt
 */
function createPrompt(text, format, translateToEnglish = false) {
  // Add translation instruction ONLY if explicitly requested
  const translationPrefix = translateToEnglish 
    ? "Translate the following content to English and then " 
    : "Summarize in the original language. DO NOT translate to English. ";
  
  let prompt;
  
  // Create prompt based on requested format
  switch (format) {
    case 'short':
      prompt = `${translationPrefix}You must create an EXTREMELY concise summary (maximum 2-3 sentences, no more) of the following text. 
Focus only on the most essential information. Your response must be very brief.
Do not include any explanations or additional details beyond the core message.
First provide a very short title (3-5 words only), then a tiny summary paragraph:\n\n${text}`;
      break;
      
    case 'detailed':
      prompt = `${translationPrefix}Please provide a detailed yet focused summary (1-2 paragraphs) of the following text.
Cover the main points and key information.
Structure your response with:
1. A clear, descriptive title (one line)
2. Well-organized paragraphs with proper line breaks between them
3. Ensure the most important information is prioritized\n\n${text}`;
      break;
      
    case 'key-points':
      prompt = `${translationPrefix}Extract exactly 3-5 of the most important key points from the following text.
Format your response as:
1. A brief title (one line only)
2. A bullet list where each key point:
   - Starts with a bullet point (•)
   - Is concise (preferably one sentence)
   - Captures a distinct important idea
   - Is directly relevant to the main topic\n\n${text}`;
      break;
      
    default:
      prompt = `${translationPrefix}Please summarize the following text with a clear structure.
Use paragraph breaks to separate main ideas.
Highlight the most important aspects while maintaining reasonable brevity:\n\n${text}`;
  }
  
  return prompt;
}

/**
 * Helper function to prepare text for chat panel display
 * Enhances formatting for better markdown rendering
 * 
 * @param {string} text - The text to format
 * @returns {string} Formatted text
 */
function prepareTextForChatPanel(text) {
  // Ensure code blocks have proper spacing
  text = text.replace(/```(\w*)\n/g, '```$1\n');
  
  // Make sure lists have proper spacing for markdown conversion
  text = text.replace(/^([\*\-])/gm, '\n$1');
  
  // Convert bullet formats to consistent markdown
  text = text.replace(/^[•]\s*(.*)/gm, '* $1');
  
  // Ensure ordered lists are properly formatted
  text = text.replace(/^(\d+)\.\s*/gm, '$1. ');
  
  // Add spacing around headings
  text = text.replace(/^(#{1,6}\s.*)/gm, '\n$1\n');
  
  // Properly format blockquotes
  text = text.replace(/^>\s*/gm, '> ');
  
  return text;
}