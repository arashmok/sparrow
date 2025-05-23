/**
 * Popup.js - Handles the extension popup UI interactions
 * Responsible for extracting text from webpages, communicating with AI APIs via
 * the background script, and displaying formatted summaries to the user.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =====================================================================
  // DOM ELEMENT REFERENCES
  // =====================================================================
  const elements = {
    summarizeBtn: document.getElementById('summarize-btn'),
    summaryFormat: document.getElementById('summary-format'),
    translateEnglish: document.getElementById('translate-english'),
    loading: document.getElementById('loading'),
    summaryResult: document.getElementById('summary-result'),
    summaryText: document.getElementById('summary-text'),
    apiProviderText: document.getElementById('api-provider-text'),
    apiIndicator: document.getElementById('api-indicator'),
    apiMethodIndicator: document.getElementById('api-method-indicator'),
    chatBtn: document.getElementById('chat-btn'),
    expandBtn: document.getElementById('expand-btn'),
    savedChatsBtn: document.getElementById('saved-chats-btn'),
    savedCountSpan: document.getElementById('saved-count')
  };

  // =====================================================================
  // DEBUG UTILITIES
  // =====================================================================
  function debugLog(message, data) {
    console.log(`%c[DEBUG] ${message}`, 'background: #f0f0f0; color: #0066cc; padding: 2px 5px; border-radius: 3px;', data || '');
  }

  // Add this function to dump the state of important variables for debugging
  function dumpState() {
    chrome.storage.local.get(['latestSummary', 'sparrowSavedChats'], function(result) {
      debugLog('Current State:', {
        'Has Summary': !!result.latestSummary,
        'Summary Length': result.latestSummary ? result.latestSummary.length : 0,
        'Saved Chats Count': (result.sparrowSavedChats || []).length,
        'Chat Button Element': !!elements.chatBtn,
        'Button Classes': elements.chatBtn ? elements.chatBtn.className : 'N/A',
        'Button Disabled': elements.chatBtn ? elements.chatBtn.disabled : 'N/A'
      });
    });
  }

  // =====================================================================
  // INITIALIZATION
  // =====================================================================
  
  /**
   * Enhanced storage initialization that returns a Promise
   */
  function initializeSavedChatsStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sparrowSavedChats'], function(result) {
        console.log("Checking saved chats storage:", result);
        
        if (!result || !result.sparrowSavedChats) {
          console.log("No saved chats found in storage, creating empty array");
          chrome.storage.local.set({ sparrowSavedChats: [] }, function() {
            console.log("Empty saved chats array created");
            resolve([]);
          });
        } else {
          console.log(`Found ${result.sparrowSavedChats.length} saved chats in storage`);
          resolve(result.sparrowSavedChats);
        }
      });
    });
  }

  /**
   * Enhanced initialization function that ensures proper sequence
   */
  async function init() {
    try {
      // First, make sure storage is properly initialized
      const savedChats = await initializeSavedChatsStorage();
      console.log(`Initialization complete, found ${savedChats.length} saved chats`);
      
      // Check for existing summary
      checkForExistingSummary();
      
      // Initialize popup settings
      initializePopup();
      
      // Make sure this runs after storage operations complete
      setTimeout(function() {
        updateSavedChatsCount();
        dumpState();
      }, 300);
    } catch (error) {
      console.error("Error during initialization:", error);
    }
  }

  // Initialize the popup
  init();
  
  // =====================================================================
  // EVENT LISTENERS
  // =====================================================================
  
  function setupEventListeners() {
    // Generate summary button
    elements.summarizeBtn.addEventListener('click', summarizeCurrentPage);
    
    // Save translation preference when changed
    elements.translateEnglish.addEventListener('change', () => {
      chrome.storage.local.set({ translateToEnglish: elements.translateEnglish.checked });
    });
  
    // Save summary format preference when changed
    elements.summaryFormat.addEventListener('change', () => {
      console.log("Format changed to:", elements.summaryFormat.value);
      chrome.storage.local.set({ defaultFormat: elements.summaryFormat.value });
    });
  
    // Chat button functionality
    elements.chatBtn.addEventListener('click', handleChatButtonClick);
  
    // Expand/Collapse summary functionality
    elements.expandBtn.addEventListener('click', createFullscreenView);
    
    // Format change event for footer adjustment
    elements.summaryFormat.addEventListener('change', () => {
      setTimeout(() => {
        adjustFooterPlacement();
      }, 50);
    });
    
    // Add saved chats button click handler
    if (elements.savedChatsBtn) {
      elements.savedChatsBtn.addEventListener('click', openSavedChatsPanel);
    }
  }
  
  setupEventListeners();

  // Add message listener for saved chats count updates
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'update-saved-count') {
      debugLog('Received update-saved-count message', request);
      // Update UI state in case button is in saved mode
      updateSavedChatsCount();
      sendResponse({ success: true });
    }
  });

  // =====================================================================
  // INITIALIZATION FUNCTIONS
  // =====================================================================
  
  /**
   * Initialize popup with saved settings
   * Loads user preferences and sets up the UI accordingly
   */
  function initializePopup() {
    // Load saved preferences with all model information
    chrome.storage.local.get([
      'translateToEnglish', 
      'apiMode', 
      'defaultFormat',
      'openaiModel',
      'lmstudioModel',
      'ollamaModel',
      'openrouterModel',
      'latestSummary'
    ], (result) => {
      console.log("Loaded settings:", result);
      
      // Set translation preference with explicit default to false
      elements.translateEnglish.checked = result.translateToEnglish === true;
      
      // Ensure the preference is explicitly set in storage if undefined
      if (result.translateToEnglish === undefined) {
        chrome.storage.local.set({ translateToEnglish: false });
      }
      
      // Set summary format preference
      if (result.defaultFormat) {
        console.log("Setting format to saved value:", result.defaultFormat);
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          elements.summaryFormat.value = result.defaultFormat;
        }, 10);
      }
  
      // Reset button/dropdown proportions to default
      elements.summarizeBtn.style.flexGrow = "4";
      elements.summaryFormat.style.flexGrow = "3";
      
      // Get the selected model name based on API mode
      const apiMode = result.apiMode;
      let selectedModel = getSelectedModelForApiMode(result);
      
      // Update API indicator with current provider and model name
      updateApiIndicator(apiMode, selectedModel);
      
      // REMOVE THIS LINE - Let the updateSavedChatsCount function handle button state
      // updateChatButtonState(!!result.latestSummary);
    });
  }
  
  /**
   * Get the selected model name based on API mode
   * 
   * @param {Object} settings - The settings object from storage
   * @returns {string} The selected model name
   */
  function getSelectedModelForApiMode(settings) {
    switch(settings.apiMode) {
      case 'openai':
        return settings.openaiModel;
      case 'lmstudio':
        return settings.lmstudioModel;
      case 'ollama':
        return settings.ollamaModel;
      case 'openrouter':
        return settings.openrouterModel;
      default:
        return '';
    }
  }

  /**
   * Check for an existing summary for the current page
   * Compares the current URL with the stored URL and displays the summary if they match
   */
  function checkForExistingSummary() {
    debugLog('Checking for existing summary');
    chrome.storage.local.get(['latestSummary', 'latestUrl'], (result) => {
      if (result.latestSummary && result.latestUrl) {
        debugLog('Found stored summary and URL');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs[0]) {
            debugLog('ERROR: No active tab found');
            return;
          }
          
          const currentUrl = normalizeUrl(tabs[0].url);
          const storedUrl = normalizeUrl(result.latestUrl);
          
          logUrlComparisonInfo(tabs[0].url, result.latestUrl, currentUrl, storedUrl);
          
          if (currentUrl === storedUrl) {
            debugLog('URLs match - displaying existing summary');
            displayExistingSummary(result.latestSummary);
          } else {
            debugLog('URLs do not match - updating button for saved chats');
            // Update button state to show saved chats if available
            updateSavedChatsCount();
          }
        });
      } else {
        debugLog('No saved summary found in storage');
        // Update button state to show saved chats if available
        updateSavedChatsCount();
      }
    });
  }

  /**
   * Log URL comparison information for debugging
   */
  function logUrlComparisonInfo(rawCurrentUrl, rawStoredUrl, normalizedCurrentUrl, normalizedStoredUrl) {
    console.log("Checking summary availability:");
    console.log("Current URL:", rawCurrentUrl);
    console.log("Normalized current URL:", normalizedCurrentUrl);
    console.log("Stored URL:", rawStoredUrl);
    console.log("Normalized stored URL:", normalizedStoredUrl);
  }

  /**
   * Display an existing summary that was found for the current URL
   */
  function displayExistingSummary(summaryText) {
    console.log("URLs match! Displaying saved summary");
    
    // Enable the chat button
    elements.chatBtn.disabled = false;
    elements.chatBtn.classList.remove('disabled');
    
    // Show the result container, hide loading
    elements.loading.classList.add('hidden');
    elements.summaryResult.classList.remove('hidden');
    
    // Format and display the summary text
    elements.summaryText.innerHTML = formatSummaryText(summaryText);
    
    // Change button text to "Regenerate"
    elements.summarizeBtn.querySelector('span').textContent = "Regenerate";
    
    // Make sure the expand button is visible when showing existing summary
    if (elements.expandBtn) {
      elements.expandBtn.style.display = 'block';
    }
    
    // Adjust window height to fit content
    adjustWindowHeight();
  }

  /**
   * Disable chat button when there's no content available
   */
  function disableChatForNoContent() {
    updateChatButtonState(false);
  }

  // =====================================================================
  // CORE FUNCTIONALITY
  // =====================================================================
  
  /**
   * Summarize the content of the current page
   * Extracts text from the page and sends it to the background script for summarization
   */
  async function summarizeCurrentPage() {
    // Store original button text
    const originalButtonText = elements.summarizeBtn.querySelector('span').textContent;
    
    // Update UI to show we're generating
    updateUIForGenerating();
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Try to extract text from the page
      await extractAndProcessText(tab);
    } catch (error) {
      showError("An error occurred: " + error.message);
      console.error("General error:", error);
      // Reset UI
      resetUIAfterGeneration(originalButtonText);
    }
  }

  /**
   * Extract text from the page and process it for summarization
   */
  async function extractAndProcessText(tab) {
    try {
      // First try: See if content script is already loaded
      const response = await sendMessageToContentScript(tab.id, { action: "extract_text" });
      processSummarization(response, tab.url);
    } catch (error) {
      console.log("Content script not ready, injecting it now:", error);
      
      // Second try: Inject the content script and try again
      await injectContentScript(tab.id);
      
      // Wait a short moment for the script to initialize
      setTimeout(async () => {
        try {
          const response = await sendMessageToContentScript(tab.id, { action: "extract_text" });
          processSummarization(response, tab.url);
        } catch (error) {
          showError("Could not extract text from the page. Please refresh the page and try again.");
          console.error("Error after injection:", error);
          // Reset UI
          resetUIAfterGeneration("Generate");
        }
      }, 200);
    }
  }

  /**
   * Send a message to the content script with Promise interface
   * 
   * @param {number} tabId - Chrome tab ID
   * @param {object} message - Message to send to content script
   * @returns {Promise} Promise that resolves with the response
   */
  function sendMessageToContentScript(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (!response || !response.text) {
          reject(new Error("No content found to summarize."));
          return;
        }
        
        resolve(response);
      });
    });
  }
  
  /**
   * Inject the content script into the current tab
   * 
   * @param {number} tabId - Chrome tab ID
   * @returns {Promise} Promise that resolves when injection is complete
   */
  function injectContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/scripts/content.js']
      }).then(() => {
        console.log("Content script injected successfully");
        resolve();
      }).catch(error => {
        console.error("Error injecting content script:", error);
        reject(error);
      });
    });
  }
  
  /**
   * Process the summarization after text extraction
   * Sends extracted text to background script and handles response
   * 
   * @param {object} response - Response from content script containing extracted text
   * @param {string} url - URL of the current page
   */
  function processSummarization(response, url) {
    if (!response || !response.text) {
      showError("No content found to summarize.");
      // Reset button state
      resetUIAfterGeneration("Generate");
      return;
    }
    
    console.log("Sending text to background script for summarization");
    
    // Get user preferences for summary
    const format = elements.summaryFormat.value;
    const translateToEnglish = elements.translateEnglish.checked;
    
    // Save current format to storage to persist between popup sessions
    chrome.storage.local.set({ defaultFormat: format });
    
    console.log("Translation to English:", translateToEnglish ? "Enabled" : "Disabled");
    console.log("Using summary format:", format);
    
    // Send to background script for processing
    chrome.runtime.sendMessage(
      { 
        action: "summarize", 
        text: response.text,
        format: format,
        translateToEnglish: translateToEnglish
      }, 
      handleSummarizationResponse(url)
    );
  }
  
  /**
   * Create a handler for summarization response
   * 
   * @param {string} url - The URL of the page being summarized
   * @returns {function} Callback function to handle the response
   */
  function handleSummarizationResponse(url) {
    return (result) => {
      // Always reset button state when we get a response
      resetUIAfterGeneration("Generate");
      
      // Reset loading message if it exists
      const loadingText = elements.loading.querySelector('span');
      if (loadingText) {
        loadingText.textContent = "Generating summary...";
      }
      
      // Check for runtime errors first
      if (chrome.runtime.lastError) {
        showError("Background script error: " + chrome.runtime.lastError.message);
        console.error("Background script error:", chrome.runtime.lastError);
        return;
      }
      
      // Check if we got a response at all
      if (!result) {
        showError("No response received from background script.");
        return;
      }
      
      console.log("Received response from background:", result);
      
      // Check for error in the response
      if (result.error) {
        showError(result.error);
        return;
      }
      
      // Check if summary exists
      if (!result.summary) {
        showError("No summary was generated. Please try again.");
        return;
      }
      
      // Display the summary
      displaySummary(result.summary, elements.summaryFormat.value);
    };
  }

  // =====================================================================
  // UI MANIPULATION
  // =====================================================================
  
  /**
   * Update UI elements to show generation is in progress
   */
  function updateUIForGenerating() {
    // Store the current height of the summary container before making changes
    const summaryContainer = document.querySelector('.summary-container');
    const currentHeight = summaryContainer.offsetHeight;
    
    // Update button state
    elements.summarizeBtn.querySelector('span').textContent = "Generating...";
    elements.summarizeBtn.disabled = true;
  
    // Hide summary format dropdown during generation
    elements.summaryFormat.classList.add('hidden-during-generation');
    
    // Hide expand button
    if (elements.expandBtn) {
      elements.expandBtn.style.display = 'none';
    }
    
    // Important: Set explicit height on container before switching content
    if (currentHeight > 0) {
      summaryContainer.style.height = `${currentHeight}px`;
    } else {
      summaryContainer.style.height = '200px'; // Default minimum height
    }
    
    // Clear previous summary content
    elements.summaryText.textContent = '';
    
    // Show loading state, hide result state
    elements.loading.classList.remove('hidden');
    elements.summaryResult.classList.add('hidden');
    
    // Position the loading indicator absolutely within the container
    elements.loading.style.position = 'absolute';
    elements.loading.style.top = '50%';
    elements.loading.style.left = '50%';
    elements.loading.style.transform = 'translate(-50%, -50%)';
  }

  /**
   * Reset UI elements after generation completes or fails
   * 
   * @param {string} buttonText - Text to set on the button
   */
  function resetUIAfterGeneration(buttonText) {
    // Update button text
    elements.summarizeBtn.querySelector('span').textContent = buttonText;
    
    // If the button text is "Regenerate", make specific adjustments
    if (buttonText === "Regenerate") {
      // Create a more optimal distribution for the container
      const controlsContainer = document.querySelector('.controls');
      if (controlsContainer) {
        // Set a fixed width for the entire controls container
        controlsContainer.style.width = "calc(100% - 8px)"; // Account for any padding
        
        // Set more appropriate widths for button and dropdown
        elements.summarizeBtn.style.width = "110px"; // Fixed width for the button
        elements.summaryFormat.style.width = "calc(100% - 118px)"; // Remaining width minus button width and gap
        
        // Reduce the gap between elements
        controlsContainer.style.gap = "8px"; // Default is 12px
      }
    } else {
      // Reset to default styles for "Generate"
      const controlsContainer = document.querySelector('.controls');
      if (controlsContainer) {
        controlsContainer.style.width = "";
        controlsContainer.style.gap = "";
      }
      elements.summarizeBtn.style.width = "";
      elements.summaryFormat.style.width = "";
    }
    
    // Enable button
    elements.summarizeBtn.disabled = false;
    
    // Show summary format dropdown
    elements.summaryFormat.classList.remove('hidden-during-generation');
  }

  /**
   * Display the generated summary in the popup
   * 
   * @param {string} summary - The generated summary text
   * @param {string} format - The format of the summary
   */
  function displaySummary(summary, format) {
    // Hide loading indicator, show results
    elements.loading.classList.add('hidden');
    elements.summaryResult.classList.remove('hidden');
  
    // Reset loading position styles
    elements.loading.style.position = '';
    elements.loading.style.top = '';
    elements.loading.style.left = '';
    elements.loading.style.transform = '';
  
    // Reset the summary container height to auto for content
    const summaryContainer = document.querySelector('.summary-container');
    summaryContainer.style.height = 'auto';
    
    // Apply the format as a data attribute for CSS styling
    summaryContainer.dataset.format = format;
    
    // Reset UI elements
    resetUIAfterGeneration("Regenerate");
    
    // Format the summary text with better structure
    const formattedSummary = formatSummaryText(summary, format);
    
    // Set the summary text with proper formatting
    elements.summaryText.innerHTML = formattedSummary;
    
    // Show the expand button when summary is displayed
    if (elements.expandBtn) {
      elements.expandBtn.style.display = 'block';
    }
    
    // Enable the chat button
    updateChatButtonState(true);
    
    // Save the summary and current URL to storage
    saveCurrentSummary(summary);
    
    // Adjust window height to fit content
    adjustWindowHeight();
  }

  /**
   * Updates the chat button state based on whether content exists
   * When no content is available, transforms it to a "Saved Chats" button
   * 
   * @param {boolean} hasContent - Whether content exists to chat about
   */
  function updateChatButtonState(hasContent) {
    console.log("updateChatButtonState called with hasContent =", hasContent);
    
    if (!elements.chatBtn) {
      console.error("Chat button element not found!");
      return;
    }
    
    // Remove any existing event listeners to prevent duplicates
    elements.chatBtn.removeEventListener('click', handleChatButtonClick);
    elements.chatBtn.removeEventListener('click', openSavedChatsPanel);
    
    if (hasContent) {
      // Content available - show normal Chat button
      console.log("Showing normal chat button");
      elements.chatBtn.className = 'chat-button'; // Reset classes
      elements.chatBtn.innerHTML = `
        <i class="fa-solid fa-comment"></i>
        Chat
      `;
      elements.chatBtn.title = "Chat about this content";
      elements.chatBtn.disabled = false;
      elements.chatBtn.addEventListener('click', handleChatButtonClick);
    } else {
      // Force check for saved chats
      chrome.storage.local.get(['sparrowSavedChats'], function(result) {
        const savedChats = result.sparrowSavedChats || [];
        const chatCount = savedChats.length;
        
        console.log("No content - Saved chats count:", chatCount);
        
        if (chatCount > 0) {
          // Has saved chats - show Saved Chats button with specific styling
          console.log("Showing saved chats button");
          elements.chatBtn.className = 'chat-button saved-mode'; // Use className to completely replace
          
          // Apply direct styles to ensure proper appearance
          elements.chatBtn.style.backgroundColor = '#5f6368'; 
          elements.chatBtn.style.color = 'white';
          elements.chatBtn.style.fontWeight = '500';
          
          elements.chatBtn.innerHTML = `
            <i class="fa-solid fa-bookmark"></i>
            Saved Chats <span class="saved-count">${chatCount}</span>
          `;
          elements.chatBtn.title = "View your saved chats";
          elements.chatBtn.disabled = false;
          
          // Make sure we attach the correct event listener
          elements.chatBtn.addEventListener('click', openSavedChatsPanel);
        } else {
          // No saved chats - keep disabled Chat button
          console.log("No saved chats - disabling chat button");
          elements.chatBtn.className = 'chat-button disabled';
          elements.chatBtn.innerHTML = `
            <i class="fa-solid fa-comment"></i>
            Chat
          `;
          elements.chatBtn.title = "Generate content first to enable chat";
          elements.chatBtn.disabled = true;
        }
      });
    }
  }

  /**
   * Update the saved chats count and refresh button state
   */
  function updateSavedChatsCount() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      
      const currentUrl = normalizeUrl(tabs[0].url);
      
      chrome.storage.local.get(['sparrowSavedChats', 'latestSummary', 'latestUrl'], function(result) {
        const savedChats = result.sparrowSavedChats || [];
        let hasContent = false;
        
        // Only consider content available if URL matches
        if (result.latestSummary && result.latestUrl) {
          const storedUrl = normalizeUrl(result.latestUrl);
          hasContent = (currentUrl === storedUrl);
        }
        
        console.log("Saved chats count:", savedChats.length);
        console.log("Has matching content for current URL:", hasContent);
        
        // Update button state based on content availability
        updateChatButtonState(hasContent);
        
        // Update saved chats count in badge if available
        if (elements.savedCountSpan && savedChats.length > 0) {
          elements.savedCountSpan.textContent = savedChats.length;
        }
      });
    });
  }

  /**
   * Show an error message in the popup
   * 
   * @param {string} message - Error message to display
   */
  function showError(message) {
    // Hide loading indicator, show results container
    elements.loading.classList.add('hidden');
    elements.summaryResult.classList.remove('hidden');
    
    // Reset button state
    resetUIAfterGeneration("Generate");
  
    // Show summary format dropdown after generation
    elements.summaryFormat.classList.remove('hidden-during-generation');
  
    // Hide the expand button when there's an error
    if (elements.expandBtn) {
      elements.expandBtn.style.display = 'none';
    }
    
    // Initialize variables for error display
    let errorTitle = "Error";
    let errorDetails = message;
    let helpContent = 'Try refreshing the page or checking your settings.';
    let showCommandSnippet = false;
    let commandSnippet = '';
    
    // Detect and provide specialized messages for different error types
    
    // Case 1: Ollama CORS issues
    if (message.includes('403') || 
        message.includes('Forbidden') || 
        message.includes('CORS') || 
        message.includes('OLLAMA_ORIGINS')) {
      
      errorTitle = "CORS Configuration Error";
      errorDetails = "Ollama needs special permissions to work with browser extensions.";
      helpContent = "Run Ollama with the following command to fix this issue:";
      showCommandSnippet = true;
      commandSnippet = "OLLAMA_ORIGINS=\"*\" ollama serve";
    }
    
    // Case 2: Connection issues
    else if (message.includes('connect') || 
             message.includes('Failed to fetch') || 
             message.includes('NetworkError')) {
      
      errorTitle = "Connection Error";
      errorDetails = "Unable to connect to the AI provider.";
      
      // Check if it's an Ollama-specific connection issue
      if (message.includes('Ollama')) {
        helpContent = "Make sure Ollama is running and accessible at the configured URL.";
        showCommandSnippet = true;
        commandSnippet = "ollama serve";
      } else {
        helpContent = "Check your internet connection and the API server status.";
      }
    }
    
    // Case 3: API Key issues
    else if (message.includes('API key') || 
             message.includes('authentication') || 
             message.includes('401')) {
      
      errorTitle = "API Authentication Error";
      errorDetails = "Your API key appears to be invalid or missing.";
      helpContent = "Check your API key in the extension settings.";
    }
    
    // Format the error message with better styling
    elements.summaryText.innerHTML = `
      <div class="error-container">
        <div class="error-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
        <div class="error-content">
          <strong>${errorTitle}</strong>
          <div class="error-message">${errorDetails}</div>
          <div class="error-help">
            <p>${helpContent}</p>
            ${showCommandSnippet ? `
              <div class="error-code-wrapper">
                <pre class="error-code">${commandSnippet}</pre>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    // Adjust window height for the error display
    adjustWindowHeight(true);
    
    // Disable chat button
    updateChatButtonState(false);
  }

  /**
   * Format Ollama error messages for better user experience
   * 
   */
  function formatOllamaError(error, apiUrl) {
    // Specific CORS error
    if (error.message.includes('403') || 
        error.message.includes('Forbidden') || 
        error.message.includes('CORS')) {
      return 'CORS Configuration Error: Ollama requires CORS configuration. Run with: OLLAMA_ORIGINS="*" ollama serve';
    }
    
    // Connection errors
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError')) {
      return `Connection Error: Unable to connect to Ollama server at ${apiUrl}. Make sure Ollama is running.`;
    }
    
    // Default: return the original error
    return error.message;
  }

  /**
   * Update the API indicator in the UI with appropriate styling
   * 
   * @param {string} apiMode - Current API mode (openai, lmstudio, ollama, openrouter)
   * @param {string} modelName - The model name to display (optional)
   */
  function updateApiIndicator(apiMode, modelName = '') {
    const apiMethodIndicator = document.querySelector('.api-method-indicator');
    if (!apiMethodIndicator) return;
    
    // Set the appropriate CSS class for color coding
    apiMethodIndicator.className = 'api-method-indicator';
    if (apiMode === 'openai') {
      apiMethodIndicator.classList.add('indicator-openai');
    } else if (apiMode === 'lmstudio') {
      apiMethodIndicator.classList.add('indicator-lmstudio');
    } else if (apiMode === 'ollama') {
      apiMethodIndicator.classList.add('indicator-ollama');
    } else if (apiMode === 'openrouter') {
      apiMethodIndicator.classList.add('indicator-openrouter');
    }
    
    // Set the text to the model name or API name
    apiMethodIndicator.textContent = modelName ? truncateModelName(modelName) : apiMode;
  }

  // =====================================================================
  // UTILITY FUNCTIONS
  // =====================================================================
  
  /**
   * Save the current summary and URL to storage
   * 
   * @param {string} summary - Summary text to save
   * @param {string} storedUrl - URL associated with the summary (if provided)
   */
  function saveCurrentSummary(summary, storedUrl = null) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      
      const currentUrl = tabs[0].url;
      const urlToStore = storedUrl || currentUrl;
      
      console.log("Saving summary for URL:", urlToStore);
      chrome.storage.local.set({
        latestSummary: summary,
        latestUrl: urlToStore,
        lastSaved: Date.now() // Add timestamp for debugging
      }, () => {
        console.log("Summary saved successfully to storage");
      });
    });
  }

  /**
   * Truncate model name to a reasonable length for display
   * Handles models with slashes and long names
   * 
   * @param {string} modelName - Full model name
   * @returns {string} Truncated model name
   */
  function truncateModelName(modelName) {
    if (!modelName) {
      return '';
    }
    
    // Get last part of model name if it contains slashes
    if (modelName.includes('/')) {
      modelName = modelName.split('/').pop();
    }
    
    // Truncate if too long
    if (modelName.length > 15) {
      return modelName.substring(0, 12) + '...';
    }
    return modelName;
  }

  /**
   * Normalize URL to ensure consistent comparison
   * Handles common variations in URLs that refer to the same page
   * 
   * @param {string} urlStr - URL to normalize
   * @returns {string} Normalized URL
   */
  function normalizeUrl(urlStr) {
    try {
      // Handle empty or invalid URLs
      if (!urlStr) return '';
      
      const urlObj = new URL(urlStr);
      
      // Remove hash fragments
      urlObj.hash = '';
      
      // Remove trailing slashes from pathname
      urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');
      
      // Convert to lowercase for consistent comparison
      let normalized = urlObj.protocol + '//' + urlObj.host.toLowerCase() + urlObj.pathname + urlObj.search;
      
      // Remove common tracking parameters (UTM, etc.)
      const urlParams = new URLSearchParams(urlObj.search);
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      let trackingRemoved = false;
      
      paramsToRemove.forEach(param => {
        if (urlParams.has(param)) {
          urlParams.delete(param);
          trackingRemoved = true;
        }
      });
      
      // If we removed tracking params, rebuild the URL
      if (trackingRemoved) {
        const newSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
        normalized = urlObj.protocol + '//' + urlObj.host.toLowerCase() + urlObj.pathname + newSearch;
      }
      
      return normalized;
    } catch (e) {
      console.error("URL normalization error:", e);
      return urlStr || '';
    }
  }

  /**
   * Format the summary text with better structure
   * Detects titles, paragraphs, and bullet points for improved readability
   * 
   * @param {string} text - Raw summary text
   * @param {string} format - The summary format type
   * @returns {string} HTML-formatted summary
   */
  function formatSummaryText(text, format) {
    // Check if this is a translated summary
    const isTranslated = text.includes("[Translated to English]");
    
    // Remove the translation prefix for processing
    let processedText = text.replace("[Translated to English] ", "");
    
    // Split all content by new lines for easier processing
    const allLines = processedText.split('\n').map(line => line.trim()).filter(line => line);
    
    // Prepare variables for content organization
    let title = '';
    let contentLines = [];
    let bulletPoints = [];
    let foundTitle = false;
    
    // First pass - identify if first line is a title (not needed for short format)
    if (format !== 'short' && allLines.length > 0) {
      const firstLine = allLines[0];
      
      // Check if it's a markdown-formatted title within a bullet point
      if ((firstLine.match(/^[•*]\s*\*\*.*\*\*/) || firstLine.match(/^[•*]\s*\*.*\*/))) {
        // Extract title from markup
        const titleMatch = firstLine.match(/\*\*(.*?)\*\*/) || firstLine.match(/\*(.*?)\*/);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
          foundTitle = true;
        }
      }
      // Check if it's a short first line that looks like a title
      else if (firstLine.length < 80 && !firstLine.startsWith('•') && !firstLine.startsWith('*')) {
        title = firstLine
                .replace(/^\*+|\*+$/g, '')  // Remove surrounding asterisks
                .replace(/^"|"$/g, '')      // Remove surrounding quotes
                .replace(/^Title:\s*/i, '') // Remove "Title:" prefix
                .replace(/\*\*(.*?)\*\*/, '$1') // Remove markdown bold
                .trim();
        foundTitle = true;
        allLines.shift(); // Remove the title line from processing
      }
    }
    
    // Second pass - identify content vs bullet points
    allLines.forEach((line, i) => {
      // Skip processing this line if it was already identified as the title
      if (foundTitle && i === 0 && line.includes(title)) {
        return;
      }
      
      // Check if it's a bullet point
      if (line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line)) {
        bulletPoints.push(line);
      } 
      // Otherwise it's regular content
      else {
        contentLines.push(line);
      }
    });
    
    // Generate the formatted HTML
    let formattedHtml = generateFormattedHtml(
      isTranslated, 
      title, 
      contentLines, 
      bulletPoints, 
      format
    );
    
    return formattedHtml;
  }
  
  /**
   * Generate formatted HTML from processed summary components
   */
  function generateFormattedHtml(isTranslated, title, contentLines, bulletPoints, format) {
    let formattedHtml = '';
    
    // Add translation badge if necessary
    if (isTranslated) {
      formattedHtml += '<span class="translation-badge">Translated</span>';
    }
    
    // Add title at the top if we found one and it's not a short summary
    if (title && format !== 'short') {
      formattedHtml += `<div class="summary-title">${title}</div>`;
    }
    
    // Different handling based on format
    if (format === 'short') {
      // For short format, treat all lines as one concise paragraph
      const shortContent = contentLines.join(' ');
      formattedHtml += `<div class="summary-paragraph">${shortContent}</div>`;
    } else if (format === 'key-points') {
      // For key points, prioritize bullet points
      if (title) {
        // If we found a title separately, add standard paragraphs first if any
        contentLines.forEach(para => {
          formattedHtml += `<div class="summary-paragraph">${para}</div>`;
        });
      }
      
      // Add all bullet points
      bulletPoints.forEach(point => {
        // Clean up the bullet point formatting
        const cleanedPoint = cleanBulletPoint(point);
        formattedHtml += `<div class="key-point">${cleanedPoint}</div>`;
      });
    } else {
      // For detailed format, add paragraphs with proper spacing
      if (contentLines.length > 0) {
        // Add each paragraph with proper formatting
        contentLines.forEach(para => {
          formattedHtml += `<div class="summary-paragraph">${para}</div>`;
        });
      }
      
      // Add bullet points if any
      bulletPoints.forEach(point => {
        // Clean up the bullet point formatting
        const cleanedPoint = cleanBulletPoint(point);
        formattedHtml += `<div class="key-point">${cleanedPoint}</div>`;
      });
    }
    
    // If we have no content at all, display the entire text formatted as paragraphs
    if (formattedHtml === '' || (title && !contentLines.length && !bulletPoints.length)) {
      const processedText = (isTranslated ? text.replace("[Translated to English] ", "") : text);
      formattedHtml = processedText.split('\n')
        .map(line => line.trim() ? `<div class="summary-paragraph">${line.trim()}</div>` : '')
        .join('');
    }
    
    return formattedHtml;
  }
  
  /**
   * Clean up bullet point formatting
   */
  function cleanBulletPoint(point) {
    return point.replace(/^[•*]\s*/, '')  // Remove bullet
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert **bold** to <strong>
                .replace(/\*(.*?)\*/g, '<em>$1</em>') // Convert *italic* to <em>
                .trim();
  }

  // =====================================================================
  // LAYOUT & DISPLAY FUNCTIONS
  // =====================================================================

  /**
   * Force layout recovery procedure
   */
  function forceLayoutRecovery() {
    console.log("Initiating layout recovery procedure");
    
    // Force layout to known-good dimensions with !important styles
    const style = document.createElement('style');
    style.textContent = `
      body {
        height: 480px !important;
        overflow: hidden !important;
      }
      
      #app-wrapper, #popup-container {
        height: 100% !important;
        max-height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      
      main {
        flex: 1 !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important; /* Critical for flexbox scrolling */
      }
      
      .summary-container {
        flex: 1 !important;
        overflow-y: auto !important;
        min-height: 200px !important;
        max-height: 300px !important;
        height: auto !important;
        margin-bottom: 12px !important;
      }
      
      footer {
        flex-shrink: 0 !important;
        height: auto !important;
        min-height: 40px !important;
        position: relative !important;
        bottom: 0 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999 !important;
        background: white !important;
      }
      
      .bottom-actions {
        display: flex !important;
        justify-content: space-between !important;
        width: 100% !important;
        padding: 8px 0 !important;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Adjust footer placement based on summary format
   */
  function adjustFooterPlacement() {
    // Get current format
    const formatType = elements.summaryFormat ? elements.summaryFormat.value : 'short';
    console.log("Adjusting footer placement for format:", formatType);
    
    // Create specific styling for footer placement based on format
    const style = document.createElement('style');
    style.id = 'footer-placement-fix';
    
    // Remove any existing style element we've added previously
    const existingStyle = document.getElementById('footer-placement-fix');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Maintain overall height but improve spacing
    const bodyHeight = '580px';
    const containerMaxHeight = formatType === 'short' ? '350px' : '400px';
    
    // Create CSS with improved container sizing and centering
    style.textContent = `
      /* Base styles for all formats */
      body {
        height: ${bodyHeight} !important;
        overflow: hidden !important;
        padding: 16px !important;
      }
      
      #app-wrapper, #popup-container {
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      
      main {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        padding-bottom: 70px !important; /* Bottom padding for footer */
      }
      
      .summary-container {
        max-height: ${containerMaxHeight} !important;
        min-height: 280px !important;
        overflow-y: auto !important;
        margin-bottom: 24px !important;
        background-color: white !important;
        border-radius: 12px !important;
        padding: 16px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        border: 1px solid rgba(0, 0, 0, 0.04) !important;
        width: 100% !important; /* Full width of parent */
      }
      
      footer {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        width: 100% !important;
        background-color: #f8f9fb !important;
        border-top: 1px solid rgba(0,0,0,0.05) !important;
        padding: 12px 0 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 100 !important;
      }
      
      .bottom-actions {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        width: 100% !important;
        padding: 0 16px !important;
      }
      
      /* Chat button styling */
      .chat-button {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 6px 16px !important;
        background-color: #2b7de9 !important;
        color: white !important;
        border-radius: 8px !important;
        border: none !important;
        font-size: 14px !important;
        font-weight: 500 !important;
      }
      
      /* Title styling */
      .summary-title {
        font-weight: 600 !important;
        font-size: 16px !important;
        margin-bottom: 12px !important;
        color: #2980b9 !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
      }
      
      /* API indicator styling */
      .api-method-indicator {
        display: inline-block !important;
        padding: 4px 10px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        color: #fff !important;
        line-height: 1.2 !important;
      }
    `;
    
    // Add the style to the document
    document.head.appendChild(style);
    
    // Force consistent dimensions and positioning
    document.body.style.height = bodyHeight;
    
    // Apply direct styles to container elements
    applyDirectStyles(containerMaxHeight);
    
    console.log(`Container sizing improved: ${formatType}`);
  }
  
  /**
   * Apply direct styles to container elements
   */
  function applyDirectStyles(containerMaxHeight) {
    // Directly style the container and content for precise control
    const summaryContainer = document.querySelector('.summary-container');
    if (summaryContainer) {
      // Full width container
      summaryContainer.style.width = '100%';
      summaryContainer.style.maxHeight = containerMaxHeight;
      summaryContainer.style.minHeight = '280px';
      summaryContainer.style.margin = '0 0 24px 0'; // No horizontal margin
      summaryContainer.style.boxSizing = 'border-box';
      
      // Ensure the container background color and shadows are visible
      summaryContainer.style.backgroundColor = 'white';
      summaryContainer.style.borderRadius = '12px';
      summaryContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      summaryContainer.style.border = '1px solid rgba(0, 0, 0, 0.04)';
    }
    
    // Ensure main has proper padding but no horizontal padding
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.style.paddingBottom = '70px';
      // No horizontal padding for main
      mainElement.style.paddingLeft = '0';
      mainElement.style.paddingRight = '0';
    }
  }

  /**
   * Adjust the popup window height based on content
   * Ensures optimal size for different content lengths
   * 
   * @param {boolean} isError - Whether we're showing an error message
   */
  function adjustWindowHeight(isError = false) {
    // Make sure adjustFooterPlacement is called last
    setTimeout(() => {
      try {
        // Get the heights of each major section
        const headerHeight = document.querySelector('header').offsetHeight || 0;
        const controlsHeight = document.querySelector('.controls').offsetHeight || 0;
        const checkboxHeight = document.querySelector('.checkbox-option').offsetHeight || 0;
        const footerHeight = document.querySelector('footer').offsetHeight || 0;
        
        // For summary height, ensure minimum height for errors
        const summaryContentHeight = elements.summaryText.scrollHeight || 200;
        const summaryContainerHeight = isError 
          ? Math.max(150, Math.min(350, summaryContentHeight))
          : Math.min(350, summaryContentHeight);
        
        // Add padding/margins
        const padding = isError ? 70 : 50;
        
        // Calculate optimal window height
        const optimalHeight = headerHeight + controlsHeight + checkboxHeight + summaryContainerHeight + footerHeight + padding;
        
        // Limit to reasonable bounds
        const minHeight = isError ? 400 : 350;
        const maxHeight = 600;
        
        // Set height with constraints
        const finalHeight = Math.max(minHeight, Math.min(maxHeight, optimalHeight));
        
        // Apply the height to body to let Chrome resize the popup window
        document.body.style.height = `${finalHeight}px`;
        
        // Check layout integrity and apply fixes if needed
        checkLayoutIntegrity();
      } catch (error) {
        console.error("Error in height adjustment:", error);
        forceLayoutRecovery();
        adjustFooterPlacement();
      }
    }, 100);
  }
  
  /**
   * Check if the layout is broken and apply fixes if needed
   */
  function checkLayoutIntegrity() {
    setTimeout(() => {
      const footer = document.querySelector('footer');
      const footerRect = footer ? footer.getBoundingClientRect() : null;
      const chatBtn = document.querySelector('#chat-btn');
      
      if (!footer || footerRect.height < 5 || !chatBtn || chatBtn.offsetParent === null) {
        console.warn("Footer or chat button not visible, applying emergency fix");
        forceLayoutRecovery();
      }
      
      // Always apply footer placement adjustments
      adjustFooterPlacement();
    }, 200);
  }

  // Wait for the DOM to be fully loaded before checking for footer visibility
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for all content to render
    setTimeout(() => {
      const footer = document.querySelector('footer');
      if (!footer || footer.getBoundingClientRect().height < 5) {
        console.warn("Footer not visible on initial load, applying emergency fix");
        forceLayoutRecovery();
      }
    }, 500);
  });

  // =====================================================================
  // ACTION HANDLERS
  // =====================================================================

  /**
   * Handles the Chat button click event
   * Opens a chat panel with the latest summary as context
   */
  async function handleChatButtonClick() {
    debugLog('Chat button clicked');
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      debugLog('Active tab:', tab ? tab.id : 'none');
      
      // Get the generated text from storage directly rather than from HTML
      let generatedText = '';
      
      await new Promise(resolve => {
        chrome.storage.local.get(['latestSummary'], (result) => {
          if (result.latestSummary) {
            generatedText = result.latestSummary;
            debugLog('Retrieved summary from storage, length:', generatedText.length);
          } else {
            debugLog('WARNING: No summary found in storage');
          }
          resolve();
        });
      });
      
      // Send message to background script to open the chat panel
      debugLog('Sending open-chat-panel message to background script');
      chrome.runtime.sendMessage({
        action: 'open-chat-panel',
        tabId: tab.id,
        generatedText: generatedText
      }, (response) => {
        if (chrome.runtime.lastError) {
          debugLog('ERROR opening chat panel:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.success) {
          debugLog('Chat panel opened successfully, closing popup');
          // Close the popup after initiating the chat panel
          window.close();
        } else {
          debugLog('WARNING: Received unsuccessful response', response);
        }
      });
    } catch (error) {
      debugLog('ERROR in handleChatButtonClick:', error.message);
    }
  }

  /**
   * Creates a fullscreen view of the summary in the current tab
   */
  function createFullscreenView() {
    console.log("Creating fullscreen view in the active tab");
    
    // Get the current summary content and title
    const summaryContent = elements.summaryText.innerHTML;
    
    // Try to extract the title
    let contentTitle = "Page Summary";
    const titleElement = elements.summaryText.querySelector('.summary-title');
    if (titleElement) {
      contentTitle = titleElement.textContent;
    }
    
    // Get the base64 image and create the fullscreen view
    getBase64Image((base64Image) => {
      injectFullscreenView(summaryContent, contentTitle, base64Image);
    });
  }
  
  /**
   * Convert extension icon to base64 data
   * 
   * @param {Function} callback - Callback function with base64 data
   */
  function getBase64Image(callback) {
    try {
      const img = new Image();
      img.src = chrome.runtime.getURL('assets/icons/icon48.png');
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = 24; // Resizing to 24px width
        canvas.height = 24; // Resizing to 24px height
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 24, 24);
        
        const dataURL = canvas.toDataURL('image/png');
        callback(dataURL);
      };
      
      img.onerror = function() {
        // If image fails to load, use a fallback
        callback(null);
      };
    } catch (e) {
      console.error("Error converting image to base64:", e);
      callback(null);
    }
  }
  
  /**
   * Inject fullscreen view into the current tab
   */
  function injectFullscreenView(summaryContent, contentTitle, base64Image) {
    // Create an injectable function for the fullscreen view
    function createFullscreenInPage(summaryHtml, titleText, logoBase64) {
      // Remove any existing fullscreen view
      const existingView = document.getElementById('sparrow-fullscreen-view');
      if (existingView) {
        document.body.removeChild(existingView);
      }
      
      // Remove any existing style if present
      const existingStyle = document.getElementById('sparrow-fullscreen-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
      
      // Create a style element with all necessary CSS
      const styleElement = document.createElement('style');
      styleElement.id = 'sparrow-fullscreen-styles';
      styleElement.textContent = `
        #sparrow-fullscreen-view {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: white;
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
        
        #sparrow-fullscreen-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background-color: #f8f9fb;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          width: 100%;
          box-sizing: border-box;
        }
        
        #sparrow-fullscreen-title-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        #sparrow-fullscreen-logo {
          width: 24px;
          height: 24px;
          margin-right: 8px;
        }
        
        #sparrow-fullscreen-title {
          font-size: 20px;
          font-weight: 600;
          color: #2980b9;
          margin: 0;
        }
        
        #sparrow-fullscreen-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #666;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        
        #sparrow-fullscreen-close:hover {
          background-color: rgba(0,0,0,0.05);
        }
        
        #sparrow-fullscreen-content-area {
          width: 100%;
          height: calc(100% - 52px);
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          justify-content: center;
          box-sizing: border-box;
        }
        
        #sparrow-fullscreen-container {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 40px;
          box-sizing: border-box;
        }
        
        #sparrow-content-title {
          font-size: 32px;
          font-weight: 600;
          color: #2980b9;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          text-align: center;
        }
        
        #sparrow-content-text {
          font-size: 18px;
          line-height: 1.8;
        }
        
        #sparrow-content-text .summary-paragraph {
          font-size: 18px;
          margin-bottom: 20px;
          color: #333;
        }
        
        #sparrow-content-text .key-point {
          font-size: 18px;
          margin-bottom: 20px;
          padding-left: 24px;
          position: relative;
          color: #333;
        }
        
        #sparrow-content-text .key-point::before {
          content: "•";
          position: absolute;
          left: 8px;
          color: #2980b9;
          font-weight: bold;
        }
      `;
      document.head.appendChild(styleElement);
      
      // Create the DOM structure for fullscreen view
      const overlay = document.createElement('div');
      overlay.id = 'sparrow-fullscreen-view';
      
      // Create header
      const header = document.createElement('div');
      header.id = 'sparrow-fullscreen-header';
      
      // Create title container with logo
      const titleContainer = document.createElement('div');
      titleContainer.id = 'sparrow-fullscreen-title-container';
      
      // Create logo element using base64 image
      let logoElement;
      if (logoBase64) {
        logoElement = document.createElement('img');
        logoElement.id = 'sparrow-fullscreen-logo';
        logoElement.src = logoBase64;
        logoElement.alt = 'Sparrow logo';
        logoElement.width = 24;
        logoElement.height = 24;
      } else {
        // Fallback to a div with a symbol if no base64 image is available
        logoElement = document.createElement('div');
        logoElement.style.fontSize = '20px';
        logoElement.textContent = '🐦';
        logoElement.style.marginRight = '8px';
      }
      
      // Create title
      const title = document.createElement('h1');
      title.id = 'sparrow-fullscreen-title';
      title.textContent = 'Page Summary';
      
      // Add logo and title to container
      titleContainer.appendChild(logoElement);
      titleContainer.appendChild(title);
      
      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.id = 'sparrow-fullscreen-close';
      closeBtn.innerHTML = '×'; // Using × character instead of Font Awesome
      closeBtn.title = 'Close fullscreen view';
      
      // Add close button event listener
      closeBtn.addEventListener('click', function() {
        document.body.removeChild(overlay);
        document.head.removeChild(styleElement);
      });
      
      // Create content area
      const contentArea = document.createElement('div');
      contentArea.id = 'sparrow-fullscreen-content-area';
      
      // Create content container
      const contentContainer = document.createElement('div');
      contentContainer.id = 'sparrow-fullscreen-container';
      
      // Create content title
      const contentTitleEl = document.createElement('h2');
      contentTitleEl.id = 'sparrow-content-title';
      contentTitleEl.textContent = titleText;
      
      // Create content text
      const contentText = document.createElement('div');
      contentText.id = 'sparrow-content-text';
      
      // Add the summary content, removing any existing title
      contentText.innerHTML = summaryHtml.replace(/<div class="summary-title">.*?<\/div>/, '');
      
      // Assemble the DOM structure
      contentContainer.appendChild(contentTitleEl);
      contentContainer.appendChild(contentText);
      contentArea.appendChild(contentContainer);
      header.appendChild(titleContainer);
      header.appendChild(closeBtn);
      overlay.appendChild(header);
      overlay.appendChild(contentArea);
      
      // Add to document
      document.body.appendChild(overlay);
      
      // Add ESC key event listener to close
      function escKeyHandler(event) {
        if (event.key === 'Escape') {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            document.head.removeChild(styleElement);
          }
          document.removeEventListener('keydown', escKeyHandler);
        }
      }
      
      document.addEventListener('keydown', escKeyHandler);
    }
    
    // Execute in the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) return;
      
      // Execute the script with the base64 image
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: createFullscreenInPage,
        args: [summaryContent, contentTitle, base64Image]
      })
      .then(() => {
        console.log("Fullscreen view injected into page");
        // Close the popup to show the fullscreen view in the tab
        setTimeout(() => window.close(), 100);
      })
      .catch(err => {
        console.error("Failed to inject fullscreen view:", err);
        
        // Fallback to showing in popup if injection fails
        showError("Could not open fullscreen view. The page might be restricting scripts.");
      });
    });
  }

  function openSavedChatsPanel() {
    console.log("openSavedChatsPanel called");
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || !tabs[0]) {
        console.error("No active tab found");
        return;
      }
      
      console.log("Opening side panel with saved chats view");
      chrome.runtime.sendMessage({
        action: 'open-chat-panel',
        tabId: tabs[0].id,
        showSavedChats: true,
        directAccess: true
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error opening side panel:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          console.log("Side panel opened successfully, closing popup");
          window.close();
        } else {
          console.error("Received unsuccessful response", response);
        }
      });
    });
  }

  // Add this temporary test function to force save a chat for testing
  function createTestSavedChat() {
    const testChat = {
      sessionId: 'test-session-' + Date.now(),
      title: 'Test Saved Chat',
      url: 'https://example.com',
      messages: [{role: 'assistant', content: 'This is a test chat'}],
      firstSaved: Date.now(),
      lastUpdated: Date.now(),
      lastViewed: Date.now()
    };
    
    chrome.storage.local.get(['sparrowSavedChats'], function(result) {
      const savedChats = result.sparrowSavedChats || [];
      savedChats.push(testChat);
      
      chrome.storage.local.set({
        sparrowSavedChats: savedChats
      }, function() {
        console.log("Test chat saved, count:", savedChats.length);
        // Force button update
        updateSavedChatsCount();
      });
    });
  }

  /**
   * Force refresh the saved chats status regardless of current summary content
   */
  function forceRefreshSavedChatsStatus() {
    chrome.storage.local.get(['sparrowSavedChats'], function(result) {
      const chats = result.sparrowSavedChats || [];
      console.log("Force refresh - saved chats count:", chats.length);
      
      // Add a test chat if debugging
      // if (chats.length === 0) createTestSavedChat();
      
      setTimeout(() => updateChatButtonState(false), 200);
    });
  }

  // Add event listeners for button clicks
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'update-saved-count') {
      // Update UI state in case button is in saved mode
      updateSavedChatsCount();
      sendResponse({ success: true });
    }
  });
});