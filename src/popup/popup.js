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
  expandBtn.addEventListener('click', expandSummary);

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
    
    // Enable the chat button
    chatBtn.disabled = false;
    chatBtn.classList.remove('disabled');
    
    // Save the summary and current URL to storage
    saveCurrentSummary(summary);
    
    // Adjust window height to fit content
    adjustWindowHeight();

    // Show expand button
    expandBtn.style.display = 'block';
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

    // Hide expand button on error
    expandBtn.style.display = 'none';
  }

  /**
   * Toggle the expanded/collapsed state of the summary
   * Changes the icon and updates the body class for styling
   */

  function expandSummary() {
    // Get the current summary content
    const summaryContent = summaryText.innerHTML;
    
    // Try to extract the title from the content
    let contentTitle = "Page Summary";
    const titleElement = summaryText.querySelector('.summary-title');
    if (titleElement) {
      contentTitle = titleElement.textContent;
    }
    
    // Create full window overlay - using document.createElement for maximum control
    const fullWindow = document.createElement('div');
    fullWindow.className = 'expanded-window';
    fullWindow.style.width = '100vw';
    fullWindow.style.height = '100vh';
    fullWindow.style.position = 'fixed';
    fullWindow.style.top = '0';
    fullWindow.style.left = '0';
    fullWindow.style.padding = '0';
    fullWindow.style.margin = '0';
    fullWindow.style.boxSizing = 'border-box';
    fullWindow.style.zIndex = '10000';
    fullWindow.style.background = '#ffffff';
    fullWindow.style.overflow = 'hidden';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'expanded-header';
    header.style.width = '100%';
    header.style.padding = '12px 20px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.background = '#f8f9fb';
    header.style.borderBottom = '1px solid rgba(0, 0, 0, 0.08)';
    header.style.boxSizing = 'border-box';
    
    // Create title
    const title = document.createElement('h1');
    title.className = 'expanded-title';
    title.textContent = 'Page Summary';
    title.style.margin = '0';
    title.style.padding = '0';
    title.style.fontSize = '20px';
    title.style.fontWeight = '600';
    title.style.color = '#2980b9';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-expanded';
    closeButton.innerHTML = '<i class="fa-solid fa-times"></i>';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '18px';
    closeButton.style.color = '#666';
    closeButton.title = "Close fullscreen view";
    closeButton.addEventListener('click', () => {
      document.body.removeChild(fullWindow);
      document.removeEventListener('keydown', handleEscKey);
    });
    
    // Create content area - direct child of window
    const contentArea = document.createElement('div');
    contentArea.className = 'expanded-content';
    contentArea.style.width = '100%';
    contentArea.style.padding = '0';
    contentArea.style.margin = '0';
    contentArea.style.boxSizing = 'border-box';
    contentArea.style.display = 'block';
    
    // Create inner content container
    const contentInner = document.createElement('div');
    contentInner.className = 'expanded-content-inner';
    contentInner.style.width = '100%';
    contentInner.style.maxWidth = '100%';
    contentInner.style.padding = '40px 5%';
    contentInner.style.boxSizing = 'border-box';
    contentInner.style.margin = '0';
    
    // Create content title
    const contentTitleElement = document.createElement('div');
    contentTitleElement.className = 'expanded-content-title';
    contentTitleElement.textContent = contentTitle;
    contentTitleElement.style.fontSize = '32px';
    contentTitleElement.style.color = '#2980b9';
    contentTitleElement.style.textAlign = 'center';
    contentTitleElement.style.marginBottom = '30px';
    contentTitleElement.style.paddingBottom = '15px';
    contentTitleElement.style.borderBottom = '1px solid rgba(0, 0, 0, 0.08)';
    contentTitleElement.style.width = '100%';
    contentTitleElement.style.boxSizing = 'border-box';
    
    // Create content with full width
    const content = document.createElement('div');
    content.className = 'expanded-text';
    content.style.fontSize = '18px';
    content.style.lineHeight = '1.8';
    content.style.width = '100%';
    content.style.boxSizing = 'border-box';
    
    // Remove any existing title from the content
    const processedContent = summaryContent.replace(/<div class="summary-title">.*?<\/div>/, '');
    content.innerHTML = processedContent;
    
    // Convert to full width by adding explicit styles to any elements
    const paragraphs = content.querySelectorAll('.summary-paragraph, .key-point');
    paragraphs.forEach(para => {
      para.style.fontSize = '18px';
      para.style.marginBottom = '20px';
      para.style.width = '100%';
      para.style.boxSizing = 'border-box';
    });
    
    // Explicitly style bullet points
    const bullets = content.querySelectorAll('.key-point');
    bullets.forEach(bullet => {
      bullet.style.paddingLeft = '30px';
      bullet.style.position = 'relative';
    });
    
    // Assemble everything
    header.appendChild(title);
    header.appendChild(closeButton);
    
    contentInner.appendChild(contentTitleElement);
    contentInner.appendChild(content);
    
    contentArea.appendChild(contentInner);
    
    fullWindow.appendChild(header);
    fullWindow.appendChild(contentArea);
    
    // Add to document
    document.body.appendChild(fullWindow);
    
    // Add event listener for ESC key
    document.addEventListener('keydown', handleEscKey);
  }

  // Adjust the content size for full view
  function adjustContentForFullView(container) {
    // Get the content height
    const contentHeight = container.scrollHeight;
    const windowHeight = window.innerHeight;
    
    // If content is too large for the screen, adjust sizing
    if (contentHeight > windowHeight * 0.85) {
      // Calculate a smaller font size based on content amount
      const calculatedSize = Math.max(16, Math.min(18, 18 * (windowHeight * 0.85 / contentHeight)));
      
      // Apply the calculated size
      container.style.fontSize = calculatedSize + 'px';
      
      // Also adjust padding to gain more space
      container.style.padding = '20px 40px';
    }
  }

  // Close the expanded view when ESC key is pressed
  function handleEscKey(event) {
    if (event.key === 'Escape') {
      const expandedWindow = document.querySelector('.expanded-window');
      if (expandedWindow) {
        document.body.removeChild(expandedWindow);
        document.removeEventListener('keydown', handleEscKey);
      }
    }
  }
});