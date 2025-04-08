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
  
  // Initialize popup by loading saved settings
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
      
      // Send message to background script to open the chat panel
      chrome.runtime.sendMessage({
        action: 'open-chat-panel',
        tabId: tab.id
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
  
  // Initialize popup with saved settings
  function initializePopup() {
    // Load saved preferences
    chrome.storage.local.get(['translateToEnglish', 'apiMode', 'defaultFormat'], (result) => {
      console.log("Loaded settings:", result);
      
      // Set translation preference
      if (result.translateToEnglish !== undefined) {
        translateEnglish.checked = result.translateToEnglish;
      }
      
      // Set summary format preference - ensure this happens AFTER the DOM is fully loaded
      if (result.defaultFormat) {
        console.log("Setting format to saved value:", result.defaultFormat);
        
        // Add a small delay to make sure the dropdown is ready
        setTimeout(() => {
          summaryFormat.value = result.defaultFormat;
          console.log("Format set to:", summaryFormat.value);
        }, 10);
      } else {
        console.log("No saved format found");
      }
      
      // Update API mode indicator
      updateApiModeIndicator(result.apiMode);
      
      // Check if we have a saved summary from this session
      checkForExistingSummary();
    });
  }

  // Function to update the API mode indicator
  function updateApiModeIndicator(apiMode) {
    // Determine the API method name based on mode
    let methodName = '';
    let statusClass = '';
    
    if (apiMode === 'lmstudio') {
      // LM Studio mode
      methodName = 'LM Studio';
      statusClass = 'indicator-lmstudio';
    } else if (apiMode === 'ollama') {
      // Ollama mode
      methodName = 'Ollama';
      statusClass = 'indicator-ollama';
    } else {
      // OpenAI mode
      methodName = 'OpenAI';
      statusClass = 'indicator-openai';
    }
    
    // Update the method indicator
    apiMethodIndicator.textContent = methodName;
    
    // Remove any existing indicator classes
    apiMethodIndicator.className = 'api-method-indicator';
    // Add the appropriate class
    apiMethodIndicator.classList.add(statusClass);
    
    // Also update the original footer elements (keeping this for compatibility)
    if (apiProviderText) {
      apiProviderText.textContent = `Powered by ${methodName}`;
    }
    if (apiIndicator) {
      apiIndicator.textContent = apiMode === 'openai' ? 'OPENAI' : 'LOCAL';
      apiIndicator.className = 'api-indicator';
      apiIndicator.classList.add(statusClass);
    }
  }

  // Function to check for an existing summary
  function checkForExistingSummary() {
    chrome.storage.local.get(['latestSummary', 'latestUrl'], (result) => {
      if (result.latestSummary) {
        // Get the current URL to compare
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const currentUrl = tabs[0].url;
          
          // Only restore if we're still on the same page
          if (result.latestUrl === currentUrl) {
            displaySummary(result.latestSummary);
          }
        });
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
          }
        }, 200);
      }
    } catch (error) {
      showError("An error occurred: " + error.message);
      console.error("General error:", error);
      // Reset button state
      summarizeBtn.querySelector('span').textContent = originalButtonText;
      summarizeBtn.disabled = false;
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
  
  // Function to display the summary with dynamic sizing
  function displaySummary(summary, url = null) {
    loading.classList.add('hidden'); // Hide the loading message
    summaryResult.classList.remove('hidden');
    
    // Format the summary with better structure
    const formattedSummary = formatSummaryText(summary);
    
    // Replace the text content with formatted HTML
    summaryText.innerHTML = formattedSummary;
    
    // Adjust the window height based on content
    adjustWindowHeight();
    
    // Store the latest summary in local storage
    const storageData = {
      latestSummary: summary // Store the original unformatted summary
    };
    
    // If URL was provided, store it too
    if (url) {
      storageData.latestUrl = url;
    }
    
    chrome.storage.local.set(storageData);
  }

  // Function to adjust window height based on content
  function adjustWindowHeight() {
    // Delay to ensure DOM is updated
    setTimeout(() => {
      // Get the heights of each major section
      const headerHeight = document.querySelector('header').offsetHeight;
      const controlsHeight = document.querySelector('.controls').offsetHeight;
      const checkboxHeight = document.querySelector('.checkbox-option').offsetHeight;
      const summaryHeight = summaryResult.offsetHeight;
      const footerHeight = document.querySelector('footer').offsetHeight;
      
      // Add padding/margins
      const padding = 50; // Extra padding for margins and spacing
      
      // Calculate optimal window height
      const optimalHeight = headerHeight + controlsHeight + checkboxHeight + summaryHeight + footerHeight + padding;
      
      // Limit to reasonable bounds
      const minHeight = 300;
      const maxHeight = 600; // Chrome has limitations on maximum popup height
      
      // Set height with constraints
      const finalHeight = Math.max(minHeight, Math.min(maxHeight, optimalHeight));
      
      // Apply the height to body to let Chrome resize the popup window
      document.body.style.height = `${finalHeight}px`;
      
      console.log(`Resized to ${finalHeight}px based on content height`);
    }, 100); // Small delay to ensure DOM is fully updated
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
  
  // Function to show error with dynamic sizing
  function showError(message) {
    loading.classList.add('hidden'); // Make sure to hide the loading indicator
    summaryResult.classList.remove('hidden');
    
    // Reset button state
    summarizeBtn.querySelector('span').textContent = "Generate";
    summarizeBtn.disabled = false;
    
    // Format the error message with an icon and better styling
    summaryText.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${message}
      </div>
      <div class="summary-paragraph">
        Try refreshing the page or checking your settings.
      </div>
    `;
    
    // Adjust the window height
    adjustWindowHeight();
  }
});