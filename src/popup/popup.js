// Popup.js - Handles the extension popup UI interactions

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const summarizeBtn = document.getElementById('summarize-btn');
  const summaryFormat = document.getElementById('summary-format');
  const translateEnglish = document.getElementById('translate-english');
  const loading = document.getElementById('loading');
  const summaryResult = document.getElementById('summary-result');
  const summaryText = document.getElementById('summary-text');
  const apiProviderText = document.getElementById('api-provider-text');
  const apiIndicator = document.getElementById('api-indicator');
  const apiMethodIndicator = document.getElementById('api-method-indicator');
  
  // Initialize popup by loading saved settings and IMMEDIATELY check for existing summary
  checkForExistingSummary();
  initializePopup();
  
  // Event Listeners
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
  document.getElementById('chat-btn').addEventListener('click', async () => {
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
  });
  
  // Function to initialize popup with saved settings
  function initializePopup() {
    // Load saved preferences with ALL model information
    chrome.storage.local.get([
      'translateToEnglish', 
      'apiMode', 
      'defaultFormat',
      'openaiModel',
      'lmstudioModel',
      'ollamaModel',
      'openrouterModel'
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
        setTimeout(() => {
          summaryFormat.value = result.defaultFormat;
        }, 10);
      }
      
      // Get the appropriate model name based on the API mode
      const apiMode = result.apiMode || 'openai';
      let modelName = '';
      
      // Get the model name for the current API mode
      if (apiMode === 'openai') {
        modelName = result.openaiModel || '';
      } else if (apiMode === 'lmstudio') {
        modelName = result.lmstudioModel || '';
      } else if (apiMode === 'ollama') {
        modelName = result.ollamaModel || '';
      } else if (apiMode === 'openrouter') {
        modelName = result.openrouterModel || '';
      }
      
      console.log(`Updating indicator with API mode: ${apiMode}, model: ${modelName}`);
      
      // Update the indicator in the DOM
      const apiMethodIndicator = document.querySelector('.api-method-indicator');
      if (apiMethodIndicator) {
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
    });
  }

  // Function to update the API mode indicator
  function updateApiModeIndicator(apiMode, modelName = '') {
    const apiMethodIndicator = document.getElementById('api-method-indicator');
    if (!apiMethodIndicator) return;
    
    let displayInfo = { class: '', name: '' };
    
    // Set color class based on API source
    if (apiMode === 'lmstudio') {
      displayInfo.class = 'indicator-lmstudio';
    } else if (apiMode === 'ollama') {
      displayInfo.class = 'indicator-ollama';
    } else if (apiMode === 'openrouter') {
      displayInfo.class = 'indicator-openrouter';
    } else {
      displayInfo.class = 'indicator-openai';
    }
    
    // Use model name if provided, otherwise use API name
    if (modelName) {
      displayInfo.name = truncateModelName(modelName);
    } else {
      if (apiMode === 'lmstudio') displayInfo.name = 'LM Studio';
      else if (apiMode === 'ollama') displayInfo.name = 'Ollama';
      else if (apiMode === 'openrouter') displayInfo.name = 'OpenRouter';
      else displayInfo.name = 'OpenAI';
    }
    
    // Update the indicator
    apiMethodIndicator.textContent = displayInfo.name;
    apiMethodIndicator.className = 'api-method-indicator ' + displayInfo.class;
    
    // Update provider text if it exists
    const apiProviderText = document.getElementById('api-provider-text');
    if (apiProviderText) {
      let providerName = apiMode === 'lmstudio' ? 'LM Studio' : 
                        apiMode === 'ollama' ? 'Ollama' : 
                        apiMode === 'openrouter' ? 'OpenRouter' : 'OpenAI';
      apiProviderText.textContent = `Powered by ${providerName}`;
    }
  }

  // Helper function to truncate model name to reasonable length
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

  // Better URL normalization function
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

  // Improved check for existing summary
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
            displaySummary(result.latestSummary, result.latestUrl);
          } else {
            console.log("URLs don't match. No stored summary for this page.");
          }
        });
      } else {
        console.log("No saved summary found in storage");
      }
    });
  }

  // Function to summarize the current page
  async function summarizeCurrentPage() {
    // Store original button text
    const originalButtonText = summarizeBtn.querySelector('span').textContent;
    
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
            // Reset button state
            summarizeBtn.querySelector('span').textContent = originalButtonText;
            summarizeBtn.disabled = false;

            // Show summary format dropdown after generation
            summaryFormat.classList.remove('hidden-during-generation');
          }
        }, 200);
      }
    } catch (error) {
      showError("An error occurred: " + error.message);
      console.error("General error:", error);
      // Reset button state
      summarizeBtn.querySelector('span').textContent = originalButtonText;
      summarizeBtn.disabled = false;

      // Show summary format dropdown after generation
      summaryFormat.classList.remove('hidden-during-generation');
    }
  }
  
  // Helper function to send a message to the content script with a Promise interface
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
  
  // Helper function to inject the content script
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
  
  // Function to process the summarization after text extraction
  function processSummarization(response, url) {
    if (!response || !response.text) {
      showError("No content found to summarize.");
      // Reset button state
      summarizeBtn.querySelector('span').textContent = "Generate";
      summarizeBtn.disabled = false;

      // Show summary format dropdown after generation
      summaryFormat.classList.remove('hidden-during-generation');
      return;
    }
    
    console.log("Sending text to background script for summarization");
    
    // Send extracted text to background script for API call
    const format = summaryFormat.value;
    const translateToEnglish = translateEnglish.checked;
    
    // Save current format to storage to persist between popup sessions
    chrome.storage.local.set({ defaultFormat: format });
    
    console.log("Translation to English:", translateToEnglish ? "Enabled" : "Disabled");
    console.log("Using summary format:", format);
    
    chrome.runtime.sendMessage(
      { 
        action: "summarize", 
        text: response.text,
        format: format,
        translateToEnglish: translateToEnglish
      }, 
      (result) => {
        // Always reset button state when we get a response
        summarizeBtn.querySelector('span').textContent = "Generate";
        summarizeBtn.disabled = false;

        // Show summary format dropdown after generation
        summaryFormat.classList.remove('hidden-during-generation');
        
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
        displaySummary(result.summary, url);
      }
    );
  }
  
  // Improved display summary function
  function displaySummary(summary, storedUrl = null) {
    loading.classList.add('hidden');
    summaryResult.classList.remove('hidden');
    
    const formattedSummary = formatSummaryText(summary);
    summaryText.innerHTML = formattedSummary;
    adjustWindowHeight();
    
    // Save the current URL and summary 
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

  // Function to adjust window height based on content
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
  
  // Helper function to format summary text with better structure
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
    
    // First pass - identify if first line is a title with markdown formatting in a bullet
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
  
  // Function to show error with consistent sizing
  function showError(message) {
    loading.classList.add('hidden');
    summaryResult.classList.remove('hidden');
    
    // Reset button state
    summarizeBtn.querySelector('span').textContent = "Generate";
    summarizeBtn.disabled = false;

    // Show summary format dropdown after generation
    summaryFormat.classList.remove('hidden-during-generation');
    
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
    
    // Don't attempt to resize the popup window
    // This maintains consistent size between normal and error states
  }
});