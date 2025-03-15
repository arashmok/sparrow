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
        
        // Send message to content script to extract text
        chrome.tabs.sendMessage(
          tab.id, 
          { action: "extract_text" }, 
          async (response) => {
            if (chrome.runtime.lastError) {
              showError("Could not extract text from the page. Please try again.");
              return;
            }
            
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
                if (chrome.runtime.lastError || !result || !result.summary) {
                  showError("Failed to generate summary. Please try again.");
                  return;
                }
                
                // Display the summary
                displaySummary(result.summary);
              }
            );
          }
        );
      } catch (error) {
        showError("An error occurred: " + error.message);
      }
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