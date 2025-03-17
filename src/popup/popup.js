// Popup.js - Handles the extension popup UI interactions

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const summarizeBtn = document.getElementById('summarize-btn');
  const summaryFormat = document.getElementById('summary-format');
  const loading = document.getElementById('loading');
  const summaryResult = document.getElementById('summary-result');
  const summaryText = document.getElementById('summary-text');
  const summaryActions = document.getElementById('summary-actions');
  const copyBtn = document.getElementById('copy-btn');
  const saveBtn = document.getElementById('save-btn');

  // Event Listeners
  summarizeBtn.addEventListener('click', summarizeCurrentPage);
  copyBtn.addEventListener('click', copyToClipboard);
  saveBtn.addEventListener('click', saveSummary);
  
  // Check if we have a saved summary from this session
  checkForExistingSummary();

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
          }
        }, 200);
      }
    } catch (error) {
      showError("An error occurred: " + error.message);
      console.error("General error:", error);
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
      return;
    }
    
    console.log("Sending text to background script for summarization");
    
    // Send extracted text to background script for API call
    const format = summaryFormat.value;
    chrome.runtime.sendMessage(
      { 
        action: "summarize", 
        text: response.text,
        format: format 
      }, 
      (result) => {
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
  
  // Function to display the summary
  function displaySummary(summary, url = null) {
    loading.classList.add('hidden'); // Hide the loading message
    summaryResult.classList.remove('hidden');
    summaryText.textContent = summary;
    summaryActions.classList.remove('hidden');
    
    // Store the latest summary in local storage
    const storageData = {
      latestSummary: summary
    };
    
    // If URL was provided, store it too
    if (url) {
      storageData.latestUrl = url;
    }
    
    chrome.storage.local.set(storageData);
  }
  
  // Function to copy the summary to clipboard
  function copyToClipboard() {
    navigator.clipboard.writeText(summaryText.textContent)
      .then(() => {
        // Show a brief "Copied!" notification
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  }
  
  // Function to save the summary
  function saveSummary() {
    chrome.storage.local.get(['savedSummaries'], (result) => {
      const savedSummaries = result.savedSummaries || [];
      
      // Get the current tab's info
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        
        // Create a new summary object
        const newSummary = {
          id: Date.now(),
          content: summaryText.textContent,
          date: new Date().toISOString(),
          url: currentTab.url,
          title: currentTab.title || 'Untitled Page'
        };
        
        // Add to the beginning of the array
        savedSummaries.unshift(newSummary);
        
        // Save back to storage
        chrome.storage.local.set({ savedSummaries }, () => {
          // Show a brief "Saved!" notification
          const originalText = saveBtn.textContent;
          saveBtn.textContent = "Saved!";
          setTimeout(() => {
            saveBtn.textContent = originalText;
          }, 1500);
        });
      });
    });
  }
  
  // Function to display error message
  function showError(message) {
    loading.classList.add('hidden'); // Make sure to hide the loading indicator
    summaryResult.classList.remove('hidden');
    summaryText.innerHTML = `<p class="error">${message}</p>`;
    summaryActions.classList.add('hidden'); // Hide the actions since there's nothing to copy/save
  }
});