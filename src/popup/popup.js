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
  
  // Event Listeners
  summarizeBtn.addEventListener('click', summarizeCurrentPage);
  
  // Load saved preference for translation
  chrome.storage.local.get(['translateToEnglish', 'apiMode'], (result) => {
    if (result.translateToEnglish !== undefined) {
      translateEnglish.checked = result.translateToEnglish;
    }
    
    // Update API mode indicator
    updateApiModeIndicator(result.apiMode);
  });
  
  // Save translation preference when changed
  translateEnglish.addEventListener('change', () => {
    chrome.storage.local.set({ translateToEnglish: translateEnglish.checked });
  });
  
  // Check if we have a saved summary from this session
  checkForExistingSummary();

  // Function to update the API mode indicator
  function updateApiModeIndicator(apiMode) {
    // Determine the API provider info based on mode
    let providerText = '';
    let statusText = '';
    let statusClass = '';
    
    if (apiMode === 'lmstudio') {
      // LM Studio mode
      providerText = 'Powered by LM Studio';
      statusText = 'LOCAL';
      statusClass = 'indicator-lmstudio';
    } else if (apiMode === 'ollama') {
      // Ollama mode
      providerText = 'Powered by Ollama';
      statusText = 'LOCAL';
      statusClass = 'indicator-ollama';
    } else {
      // OpenAI mode
      providerText = 'Powered by OpenAI';
      statusText = 'OPENAI';
      statusClass = 'indicator-openai';
    }
    
    // Update the UI elements
    apiProviderText.textContent = providerText;
    apiIndicator.textContent = statusText;
    
    // Remove any existing indicator classes
    apiIndicator.className = 'api-indicator';
    // Add the appropriate class
    apiIndicator.classList.add(statusClass);
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
    const originalButtonText = summarizeBtn.textContent;
    
    // Update button state
    summarizeBtn.textContent = "Generating...";
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
            summarizeBtn.textContent = originalButtonText;
            summarizeBtn.disabled = false;
          }
        }, 200);
      }
    } catch (error) {
      showError("An error occurred: " + error.message);
      console.error("General error:", error);
      // Reset button state
      summarizeBtn.textContent = originalButtonText;
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
      summarizeBtn.textContent = "Generate";
      summarizeBtn.disabled = false;
      return;
    }
    
    console.log("Sending text to background script for summarization");
    
    // Send extracted text to background script for API call
    const format = summaryFormat.value;
    const translateToEnglish = translateEnglish.checked;
    
    console.log("Translation to English:", translateToEnglish ? "Enabled" : "Disabled");
    
    chrome.runtime.sendMessage(
      { 
        action: "summarize", 
        text: response.text,
        format: format,
        translateToEnglish: translateToEnglish
      }, 
      (result) => {
        // Always reset button state when we get a response
        summarizeBtn.textContent = "Generate";
        summarizeBtn.disabled = false;
        
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
    
    // Detect the format type based on content
    const hasKeyPoints = processedText.includes("•") || processedText.includes("*");
    
    let formattedHtml = '';
    
    // Add translation badge if necessary
    if (isTranslated) {
      formattedHtml += '<span class="translation-badge">Translated</span>';
    }
    
    // For key points format
    if (hasKeyPoints) {
      // Split by bullet points
      const lines = processedText.split('\n');
      
      // Extract title if present (first line without bullet)
      let title = '';
      let points = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && (line.startsWith('•') || line.startsWith('*'))) {
          // This is a key point
          points.push(line.replace(/^[•*]\s*/, ''));
        } else if (line && title === '') {
          // This is likely a title or introduction
          title = line;
        }
      }
      
      // Add title if found
      if (title) {
        formattedHtml += `<div class="summary-title">${title}</div>`;
      }
      
      // Add key points
      points.forEach(point => {
        formattedHtml += `<div class="key-point">${point}</div>`;
      });
    } else {
      // For paragraph-based summaries
      const paragraphs = processedText.split('\n\n');
      
      // If it's a single paragraph, look for sentences to split it better
      if (paragraphs.length === 1 && paragraphs[0].length > 150) {
        const sentences = paragraphs[0].match(/[^.!?]+[.!?]+/g) || [paragraphs[0]];
        
        // Group sentences into reasonable paragraphs (2-3 sentences per paragraph)
        const sentencesPerParagraph = sentences.length <= 3 ? sentences.length : Math.ceil(sentences.length / 2);
        
        for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
          const paragraph = sentences.slice(i, i + sentencesPerParagraph).join(' ');
          formattedHtml += `<div class="summary-paragraph">${paragraph}</div>`;
        }
      } else {
        // Extract first paragraph as title if it's short
        if (paragraphs.length > 1 && paragraphs[0].length < 100) {
          formattedHtml += `<div class="summary-title">${paragraphs[0]}</div>`;
          
          // Add remaining paragraphs
          for (let i = 1; i < paragraphs.length; i++) {
            if (paragraphs[i].trim()) {
              formattedHtml += `<div class="summary-paragraph">${paragraphs[i]}</div>`;
            }
          }
        } else {
          // Just format all paragraphs normally
          paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              formattedHtml += `<div class="summary-paragraph">${paragraph}</div>`;
            }
          });
        }
      }
    }
    
    return formattedHtml;
  }
  
  // Function to display error message
// Function to show error with dynamic sizing
function showError(message) {
  loading.classList.add('hidden'); // Make sure to hide the loading indicator
  summaryResult.classList.remove('hidden');
  
  // Reset button state
  summarizeBtn.textContent = "Generate";
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