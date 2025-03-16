// Popup.js - Handles the extension popup UI interactions

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const summarizeBtn = document.getElementById('summarize-btn');
  const summaryFormat = document.getElementById('summary-format');
  const loading = document.getElementById('loading');
  const summaryResult = document.getElementById('summary-result');
  const summaryText = document.getElementById('summary-text');
  const copyBtn = document.getElementById('copy-btn');
  const saveBtn = document.getElementById('save-btn');

  // Event Listeners
  summarizeBtn.addEventListener('click', summarizeCurrentPage);
  copyBtn.addEventListener('click', copyToClipboard);
  saveBtn.addEventListener('click', saveSummary);

  // Function to summarize the current page
  async function summarizeCurrentPage() {
    // Show loading state
    loading.classList.remove('hidden');
    summaryResult.classList.add('hidden');
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // First try: See if content script is already loaded
      try {
        const response = await sendMessageToContentScript(tab.id, { action: "extract_text" });
        processSummarization(response);
      } catch (error) {
        console.log("Content script not ready, injecting it now:", error);
        
        // Second try: Inject the content script and try again
        await injectContentScript(tab.id);
        
        // Wait a short moment for the script to initialize
        setTimeout(async () => {
          try {
            const response = await sendMessageToContentScript(tab.id, { action: "extract_text" });
            processSummarization(response);
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
  function processSummarization(response) {
    if (!response || !response.text) {
      showError("No content found to summarize.");
      return;
    }
    
    // Send extracted text to background script for API call
    const format = summaryFormat.value;
    chrome.runtime.sendMessage(
      { 
        action: "summarize", 
        text: response.text,
        format: format 
      }, 
      (result) => {
        if (chrome.runtime.lastError || !result) {
          showError("Failed to generate summary. Please try again.");
          console.error("Background script error:", chrome.runtime.lastError);
          return;
        }
        
        if (result.error) {
          showError(result.error);
          return;
        }
        
        // Display the summary
        displaySummary(result.summary);
      }
    );
  }
  
  // Function to display the summary
  function displaySummary(summary) {
    loading.classList.add('hidden');
    summaryResult.classList.remove('hidden');
    summaryText.textContent = summary;
    
    // Store the latest summary in local storage
    chrome.storage.local.set({ latestSummary: summary });
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
      
      // Create a new summary object
      const newSummary = {
        id: Date.now(),
        content: summaryText.textContent,
        date: new Date().toISOString(),
        url: document.referrer,
        title: document.title || 'Untitled Page'
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
  }
  
  // Function to display error message
  function showError(message) {
    loading.classList.add('hidden');
    summaryResult.classList.remove('hidden');
    summaryText.innerHTML = `<p class="error">${message}</p>`;
  }
});