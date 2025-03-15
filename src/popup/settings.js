// Settings.js - Handles the settings page functionality

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const settingsForm = document.getElementById('settings-form');
    const apiKeyInput = document.getElementById('api-key');
    const defaultFormatSelect = document.getElementById('default-format');
    const cancelBtn = document.getElementById('cancel-btn');
    const messageDiv = document.getElementById('message');
    
    // Load saved settings
    loadSettings();
    
    // Event Listeners
    settingsForm.addEventListener('submit', saveSettings);
    cancelBtn.addEventListener('click', () => {
      window.close();
    });
    
    // Function to load settings from storage
    function loadSettings() {
      chrome.storage.local.get(['apiKey', 'defaultFormat'], (result) => {
        if (result.apiKey) {
          // Show dots instead of the actual key for security
          apiKeyInput.value = '••••••••••••••••••••••••••';
          apiKeyInput.dataset.hasKey = 'true';
        }
        
        if (result.defaultFormat) {
          defaultFormatSelect.value = result.defaultFormat;
        } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_SUMMARY_FORMAT) {
          defaultFormatSelect.value = CONFIG.DEFAULT_SUMMARY_FORMAT;
        }
      });
    }
    
    // Function to save settings to storage
    function saveSettings(e) {
      e.preventDefault();
      
      const settings = {
        defaultFormat: defaultFormatSelect.value
      };
      
      // Only update the API key if it was changed (not just dots)
      if (apiKeyInput.value && apiKeyInput.value !== '••••••••••••••••••••••••••') {
        settings.apiKey = apiKeyInput.value;
      }
      
      chrome.storage.local.set(settings, () => {
        showMessage('Settings saved successfully!', 'success');
        
        // If the API key was provided, update the status
        if (settings.apiKey) {
          apiKeyInput.value = '••••••••••••••••••••••••••';
          apiKeyInput.dataset.hasKey = 'true';
        }
      });
    }
    
    // Function to show a message
    function showMessage(text, type) {
      messageDiv.textContent = text;
      messageDiv.className = `message ${type}`;
      
      // Hide the message after 3 seconds
      setTimeout(() => {
        messageDiv.className = 'message hidden';
      }, 3000);
    }
  });