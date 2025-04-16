/**
 * Popup.js - Handles the extension popup UI interactions
 * Responsible for extracting text from webpages, communicating with AI APIs via
 * the background script, and displaying formatted summaries to the user.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =====================================================================
  // DOM Element References
  // =====================================================================
  const summarizeBtn = document.getElementById('summarize-btn');
  const summaryFormat = document.getElementById('summary-format');
  const translateEnglish = document.getElementById('translate-english');
  const loading = document.getElementById('loading');
  const summaryResult = document.getElementById('summary-result');
  const summaryText = document.getElementById('summary-text');
  const apiProviderText = document.getElementById('api-provider-text');
  const apiIndicator = document.getElementById('api-indicator');
  const apiMethodIndicator = document.getElementById('api-method-indicator');
  const chatBtn = document.getElementById('chat-btn');
  const expandBtn = document.getElementById('expand-btn');

  // =====================================================================
  // Initialization
  // =====================================================================
  
  /**
   * Initialize the popup by checking for existing content and loading settings
   */
  function init() {
    // Check if we have a saved summary for this page
    checkForExistingSummary();
    
    // Load user preferences and set up the UI
    initializePopup();
  }
  
  // Run initialization on load
  init();
  
  // =====================================================================
  // Event Listeners
  // =====================================================================
  
  // Generate summary button
  summarizeBtn.addEventListener('click', summarizeCurrentPage);
  
  // Save translation preference when changed
  translateEnglish.addEventListener('change', () => {
    chrome.storage.local.set({ translateToEnglish: translateEnglish.checked });
  });

  // Save summary format preference when changed
  summaryFormat.addEventListener('change', () => {
    console.log("Format changed to:", summaryFormat.value);
    chrome.storage.local.set({ defaultFormat: summaryFormat.value });
  });

  // Chat button functionality
  chatBtn.addEventListener('click', handleChatButtonClick);

  // Expand/Collapse summary functionality
  expandBtn.addEventListener('click', createFullscreenView);

  // =====================================================================
  // Core Functions
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
      translateEnglish.checked = result.translateToEnglish === true;
      
      // Ensure the preference is explicitly set in storage if undefined
      if (result.translateToEnglish === undefined) {
        chrome.storage.local.set({ translateToEnglish: false });
      }
      
      // Set summary format preference
      if (result.defaultFormat) {
        console.log("Setting format to saved value:", result.defaultFormat);
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          summaryFormat.value = result.defaultFormat;
        }, 10);
      }
      
      // Get the selected model name based on API mode
      const apiMode = result.apiMode;
      let selectedModel = '';
      switch(apiMode) {
        case 'openai':
          selectedModel = result.openaiModel;
          break;
        case 'lmstudio':
          selectedModel = result.lmstudioModel;
          break;
        case 'ollama':
          selectedModel = result.ollamaModel;
          break;
        case 'openrouter':
          selectedModel = result.openrouterModel;
          break;
      }
      
      // Update API indicator with current provider and model name
      updateApiIndicator(apiMode, selectedModel);
      
      // Disable chat button if no content has been generated
      chatBtn.disabled = !result.latestSummary;
      if (!result.latestSummary) {
        chatBtn.classList.add('disabled');
      } else {
        chatBtn.classList.remove('disabled');
      }
    });
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

  /**
   * Updates the chat button state based on whether content exists
   * @param {boolean} hasContent - Whether content exists to chat about
   */
  function updateChatButtonState(hasContent) {
    chatBtn.disabled = !hasContent;
    if (!hasContent) {
      chatBtn.classList.add('disabled');
    } else {
      chatBtn.classList.remove('disabled');
    }
  }

  /**
   * Handles the Chat button click event
   * Opens a chat panel with the latest summary as context
   */
  async function handleChatButtonClick() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get the generated text from storage directly rather than from HTML
      let generatedText = '';
      
      await new Promise(resolve => {
        chrome.storage.local.get(['latestSummary'], (result) => {
          if (result.latestSummary) {
            generatedText = result.latestSummary;
          }
          resolve();
        });
      });
      
      // Send message to background script to open the chat panel
      chrome.runtime.sendMessage({
        action: 'open-chat-panel',
        tabId: tab.id,
        generatedText: generatedText
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error opening chat panel:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          // Close the popup after initiating the chat panel
          window.close();
        }
      });
    } catch (error) {
      console.error("Error handling chat button click:", error);
    }
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
   * Check for an existing summary for the current page
   * Compares the current URL with the stored URL and displays the summary if they match
   */
  function checkForExistingSummary() {
    chrome.storage.local.get(['latestSummary', 'latestUrl'], (result) => {
      if (result.latestSummary && result.latestUrl) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs[0]) return;
          
          const currentUrl = normalizeUrl(tabs[0].url);
          const storedUrl = normalizeUrl(result.latestUrl);
          
          console.log("Checking summary availability:");
          console.log("Current URL:", tabs[0].url);
          console.log("Normalized current URL:", currentUrl);
          console.log("Stored URL:", result.latestUrl);
          console.log("Normalized stored URL:", storedUrl);
          
          if (currentUrl === storedUrl) {
            console.log("URLs match! Displaying saved summary");
            
            // Enable the chat button
            chatBtn.disabled = false;
            chatBtn.classList.remove('disabled');
            
            // Show the result container, hide loading
            loading.classList.add('hidden');
            summaryResult.classList.remove('hidden');
            
            // Format the summary for display
            const formattedSummary = formatSummaryText(result.latestSummary);
            
            // Update the content in the summary container
            summaryText.innerHTML = formattedSummary;
            
            // Change button text to "Regenerate"
            summarizeBtn.querySelector('span').textContent = "Regenerate";
            
            // Make sure the expand button is visible when showing existing summary
            if (expandBtn) {
              expandBtn.style.display = 'block';
            }
            
            // Adjust window height to fit content
            adjustWindowHeight();
          } else {
            console.log("URLs don't match. No stored summary for this page.");
            // Disable chat button since we don't have content for this page
            chatBtn.disabled = true;
            chatBtn.classList.add('disabled');
          }
        });
      } else {
        console.log("No saved summary found in storage");
        // Disable chat button since we don't have any content
        chatBtn.disabled = true;
        chatBtn.classList.add('disabled');
      }
    });
  }

  /**
   * Summarize the content of the current page
   * Extracts text from the page and sends it to the background script for summarization
   */
  async function summarizeCurrentPage() {
    // Store original button text
    const originalButtonText = summarizeBtn.querySelector('span').textContent;
    
    // Update UI to show we're generating
    updateUIForGenerating();
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // First try: See if content script is already loaded
      try {
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
            resetUIAfterGeneration(originalButtonText);
          }
        }, 200);
      }
    } catch (error) {
      showError("An error occurred: " + error.message);
      console.error("General error:", error);
      // Reset UI
      resetUIAfterGeneration(originalButtonText);
    }
  }
  
  /**
   * Update UI elements to show generation is in progress
   */
  function updateUIForGenerating() {
    // Update button state
    summarizeBtn.querySelector('span').textContent = "Generating...";
    summarizeBtn.disabled = true;

    // Hide summary format dropdown during generation
    summaryFormat.classList.add('hidden-during-generation');
    
    // Clear any previous summary
    summaryText.textContent = '';
    
    // Show loading state, hide result state
    loading.classList.remove('hidden');
    summaryResult.classList.add('hidden');
  }
  
  /**
   * Reset UI elements after generation completes or fails
   * 
   * @param {string} buttonText - Text to set on the button
   */
  function resetUIAfterGeneration(buttonText) {
    summarizeBtn.querySelector('span').textContent = buttonText;
    summarizeBtn.disabled = false;
    summaryFormat.classList.remove('hidden-during-generation');
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
    const format = summaryFormat.value;
    const translateToEnglish = translateEnglish.checked;
    
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
      const loadingText = loading.querySelector('span');
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
      displaySummary(result.summary, summaryFormat.value);
    };
  }
  
  /**
   * Display the generated summary in the popup
   * 
   * @param {string} summary - The generated summary text
   * @param {string} format - The format of the summary
   */
  function displaySummary(summary, format) {
    // Hide loading indicator, show results
    loading.classList.add('hidden');
    summaryResult.classList.remove('hidden');
    
    // Reset UI elements
    resetUIAfterGeneration("Regenerate");
    
    // Format the summary text with better structure
    const formattedSummary = formatSummaryText(summary);
    
    // Set the summary text with proper formatting
    summaryText.innerHTML = formattedSummary;
    
    // Show the expand button when summary is displayed
    if (expandBtn) {
      expandBtn.style.display = 'block';
    }
    
    // Enable the chat button
    chatBtn.disabled = false;
    chatBtn.classList.remove('disabled');
    
    // Save the summary and current URL to storage
    saveCurrentSummary(summary);
    
    // Adjust window height to fit content
    adjustWindowHeight();
  }

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
   * Adjust the popup window height based on content
   * Ensures optimal size for different content lengths
   * 
   * @param {boolean} isError - Whether we're showing an error message
   */
  function adjustWindowHeight(isError = false) {
    // Delay to ensure DOM is updated
    setTimeout(() => {
      // Get the heights of each major section
      const headerHeight = document.querySelector('header').offsetHeight;
      const controlsHeight = document.querySelector('.controls').offsetHeight;
      const checkboxHeight = document.querySelector('.checkbox-option').offsetHeight;
      const footerHeight = document.querySelector('footer').offsetHeight;
      
      // For summary height, ensure minimum height for errors
      const summaryContentHeight = summaryText.scrollHeight;
      const summaryContainerHeight = isError 
        ? Math.max(150, Math.min(350, summaryContentHeight)) // Minimum 150px for errors
        : Math.min(350, summaryContentHeight);
      
      // Add padding/margins (more for errors)
      const padding = isError ? 70 : 50;
      
      // Calculate optimal window height
      const optimalHeight = headerHeight + controlsHeight + checkboxHeight + summaryContainerHeight + footerHeight + padding;
      
      // Limit to reasonable bounds
      const minHeight = isError ? 400 : 300; // Higher minimum for errors
      const maxHeight = 600;
      
      // Set height with constraints
      const finalHeight = Math.max(minHeight, Math.min(maxHeight, optimalHeight));
      
      // Apply the height to body to let Chrome resize the popup window
      document.body.style.height = `${finalHeight}px`;
    }, 100);
  }
  
  /**
   * Format the summary text with better structure
   * Detects titles, paragraphs, and bullet points for improved readability
   * 
   * @param {string} text - Raw summary text
   * @returns {string} HTML-formatted summary
   */
  function formatSummaryText(text) {
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
    
    // First pass - identify if first line is a title
    if (allLines.length > 0) {
      const firstLine = allLines[0];
      
      // Check if it's a markdown-formatted title within a bullet point
      if ((firstLine.match(/^[•*]\s*\*\*.*\*\*/) || firstLine.match(/^[•*]\s*\*.*\*/))) {
        // Extract title from markup
        const titleMatch = firstLine.match(/\*\*(.*?)\*\*/) || firstLine.match(/\*(.*?)\*/);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
          foundTitle = true;
          // Don't remove the line, as it might contain important content
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
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      
      // Skip processing this line if it was already identified as the title
      if (foundTitle && i === 0 && line.includes(title)) {
        continue;
      }
      
      // Check if it's a bullet point
      if (line.startsWith('•') || line.startsWith('*') || /^\d+\./.test(line)) {
        bulletPoints.push(line);
      } 
      // Otherwise it's regular content
      else {
        contentLines.push(line);
      }
    }
    
    // Generate the formatted HTML
    let formattedHtml = '';
    
    // Add translation badge if necessary
    if (isTranslated) {
      formattedHtml += '<span class="translation-badge">Translated</span>';
    }
    
    // Add title at the top if we found one
    if (title) {
      formattedHtml += `<div class="summary-title">${title}</div>`;
      
      // Also add a title in markdown format for transfer to chat panel
      processedText = `# ${title}\n\n${processedText}`;
    }
    
    // Add regular content
    if (contentLines.length > 0) {
      // If multiple content lines, treat as paragraphs
      if (contentLines.length > 1) {
        contentLines.forEach(para => {
          formattedHtml += `<div class="summary-paragraph">${para}</div>`;
        });
      } 
      // For a single long paragraph, consider breaking it up
      else if (contentLines[0].length > 150) {
        const sentences = contentLines[0].match(/[^.!?]+[.!?]+/g) || [contentLines[0]];
        const sentencesPerParagraph = sentences.length <= 3 ? sentences.length : Math.ceil(sentences.length / 3);
        
        for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
          const paragraph = sentences.slice(i, i + sentencesPerParagraph).join(' ');
          formattedHtml += `<div class="summary-paragraph">${paragraph}</div>`;
        }
      } 
      // Just add the single paragraph
      else {
        formattedHtml += `<div class="summary-paragraph">${contentLines[0]}</div>`;
      }
    }
    
    // Add bullet points
    bulletPoints.forEach(point => {
      // Clean up the bullet point formatting
      const cleanedPoint = point.replace(/^[•*]\s*/, '')  // Remove bullet
                                .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
                                .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
                                .trim();
      formattedHtml += `<div class="key-point">${cleanedPoint}</div>`;
    });
    
    // If we have no content at all, display the entire text formatted as paragraphs
    if (formattedHtml === '' || (title && !contentLines.length && !bulletPoints.length)) {
      formattedHtml = processedText.split('\n').map(line => 
        line.trim() ? `<div class="summary-paragraph">${line.trim()}</div>` : ''
      ).join('');
    }
    
    return formattedHtml;
  }
  
  /**
   * Show an error message in the popup
   * 
   * @param {string} message - Error message to display
   */
  function showError(message) {
    // Hide loading indicator, show results container
    loading.classList.add('hidden');
    summaryResult.classList.remove('hidden');
    
    // Reset button state
    resetUIAfterGeneration("Generate");

    // Show summary format dropdown after generation
    summaryFormat.classList.remove('hidden-during-generation');
  
    // Hide the expand button when there's an error
    if (expandBtn) {
      expandBtn.style.display = 'none';
    }
    
    // Format the error message with better styling
    summaryText.innerHTML = `
      <div class="error-container">
        <div class="error-icon"><i class="fa-solid fa-circle-exclamation"></i></div>
        <div class="error-content">
          <strong>Error:</strong> ${message}
          <div class="error-help">Try refreshing the page or checking your settings.</div>
        </div>
      </div>
    `;
    
    // Disable chat button
    chatBtn.disabled = true;
    chatBtn.classList.add('disabled');
  }

  function createFullscreenView() {
    console.log("Creating fullscreen view in the active tab");
    
    // Get the current summary content and title
    const summaryContent = summaryText.innerHTML;
    
    // Try to extract the title
    let contentTitle = "Page Summary";
    const titleElement = summaryText.querySelector('.summary-title');
    if (titleElement) {
      contentTitle = titleElement.textContent;
    }
    
    // First, get the base64 data of the icon
    // We'll use a canvas to convert the image to base64
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
    
    // Get the base64 image first, then create the fullscreen view
    getBase64Image(function(base64Image) {
      // Create a function that will be injected into the page
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
        
        // Create the main container
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
    });
  }
});