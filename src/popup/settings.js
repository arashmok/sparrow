// Settings.js - Handles the settings page functionality

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const settingsForm = document.getElementById('settings-form');
  const apiModeRadios = document.querySelectorAll('input[name="api-mode"]');
  const openaiSection = document.getElementById('openai-section');
  const lmstudioSection = document.getElementById('lmstudio-section');
  const ollamaSection = document.getElementById('ollama-section');
  
  // OpenAI elements
  const openaiApiKeyInput = document.getElementById('openai-api-key');
  const openaiModelSelect = document.getElementById('openai-model');
  
  // LM Studio elements
  const lmstudioApiUrlInput = document.getElementById('lmstudio-api-url');
  const lmstudioApiKeyInput = document.getElementById('lmstudio-api-key');
  
  // Ollama elements
  const ollamaApiUrlInput = document.getElementById('ollama-api-url');
  const ollamaModelInput = document.getElementById('ollama-model');
  
  // Shared elements
  const defaultFormatSelect = document.getElementById('default-format');
  const cancelBtn = document.getElementById('cancel-btn');
  const messageDiv = document.getElementById('message');
  
  // Load saved settings
  loadSettings();
  
  // Event Listeners
  settingsForm.addEventListener('submit', saveSettings);
  document.getElementById('save-btn').addEventListener('click', function(e) {
    // Prevent the default button behavior
    e.preventDefault();
    // Manually trigger the form submission
    settingsForm.dispatchEvent(new Event('submit'));
  });
  cancelBtn.addEventListener('click', () => {
    window.location.href = "popup.html";
  });
  
  // Toggle between API sections when radio buttons are clicked
  apiModeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateApiSectionVisibility();
    });
  });
  
  // Function to update API section visibility based on selected mode
  function updateApiSectionVisibility() {
    const selectedApiMode = document.querySelector('input[name="api-mode"]:checked').value;
    
    // Hide all sections first
    openaiSection.classList.add('hidden');
    lmstudioSection.classList.add('hidden');
    ollamaSection.classList.add('hidden');
    
    // Show only the selected section
    if (selectedApiMode === 'openai') {
      openaiSection.classList.remove('hidden');
    } else if (selectedApiMode === 'lmstudio') {
      lmstudioSection.classList.remove('hidden');
    } else if (selectedApiMode === 'ollama') {
      ollamaSection.classList.remove('hidden');
    }
  }
  
  // Function to load settings from storage
  function loadSettings() {
    chrome.storage.local.get([
      'apiMode',
      'apiKey',
      'openaiModel',
      'lmstudioApiUrl',
      'lmstudioApiKey',
      'ollamaApiUrl',
      'ollamaModel',
      'defaultFormat' // Use defaultFormat consistently
    ], (result) => {
      console.log("Loaded settings:", result);
      
      // Set API mode
      const apiMode = result.apiMode || 'openai';
      document.querySelector(`input[name="api-mode"][value="${apiMode}"]`).checked = true;
      updateApiSectionVisibility();
      
      // OpenAI settings
      if (result.apiKey) {
        // Show dots instead of the actual key for security
        openaiApiKeyInput.value = '••••••••••••••••••••••••••';
        openaiApiKeyInput.dataset.hasKey = 'true';
      }
      
      if (result.openaiModel) {
        openaiModelSelect.value = result.openaiModel;
      }
      
      // LM Studio settings
      if (result.lmstudioApiUrl) {
        lmstudioApiUrlInput.value = result.lmstudioApiUrl;
      }
      
      if (result.lmstudioApiKey) {
        lmstudioApiKeyInput.value = '••••••••••••••••••••••••••';
        lmstudioApiKeyInput.dataset.hasKey = 'true';
      }
      
      // Ollama settings
      if (result.ollamaApiUrl) {
        ollamaApiUrlInput.value = result.ollamaApiUrl;
      }
      
      if (result.ollamaModel) {
        ollamaModelInput.value = result.ollamaModel;
      }
      
      // Format settings - IMPORTANT: use defaultFormat consistently
      if (result.defaultFormat) {
        console.log("Setting default format to:", result.defaultFormat);
        defaultFormatSelect.value = result.defaultFormat;
      } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_SUMMARY_FORMAT) {
        defaultFormatSelect.value = CONFIG.DEFAULT_SUMMARY_FORMAT;
      }
    });
  }
  
  // Function to save settings to storage
  function saveSettings(e) {
    e.preventDefault();
    
    const apiMode = document.querySelector('input[name="api-mode"]:checked').value;
    
    const settings = {
      apiMode: apiMode,
      defaultFormat: defaultFormatSelect.value, // Use defaultFormat consistently
      openaiModel: openaiModelSelect.value
    };
    
    console.log("Saving settings:", settings);
    
    // Only update the OpenAI API key if it was changed (not just dots)
    if (openaiApiKeyInput.value && openaiApiKeyInput.value !== '••••••••••••••••••••••••••') {
      settings.apiKey = openaiApiKeyInput.value;
    }
    
    // Save LM Studio settings
    settings.lmstudioApiUrl = lmstudioApiUrlInput.value;
    
    // Only update the LM Studio API key if it was changed
    if (lmstudioApiKeyInput.value && lmstudioApiKeyInput.value !== '••••••••••••••••••••••••••') {
      settings.lmstudioApiKey = lmstudioApiKeyInput.value;
    }
    
    // Save Ollama settings
    settings.ollamaApiUrl = ollamaApiUrlInput.value;
    settings.ollamaModel = ollamaModelInput.value;
    
    // Validation based on selected API mode
    if (apiMode === 'openai' && !openaiApiKeyInput.dataset.hasKey && !openaiApiKeyInput.value) {
      if (!confirm("You are trying to use the OpenAI API without an API key. This won't work. Continue anyway?")) {
        return; // Don't save if they cancel
      }
    } else if (apiMode === 'lmstudio' && !lmstudioApiUrlInput.value) {
      showMessage('Please provide a valid LM Studio server URL.', 'error');
      return;
    } else if (apiMode === 'ollama' && !ollamaApiUrlInput.value) {
      showMessage('Please provide a valid Ollama server URL.', 'error');
      return;
    } else if (apiMode === 'ollama' && !ollamaModelInput.value) {
      showMessage('Please provide an Ollama model name.', 'error');
      return;
    }
    
    // Remove any legacy popup size settings
    chrome.storage.local.remove(['popupWidth', 'popupHeight', 'popupSize']);
    
    chrome.storage.local.set(settings, () => {
      showMessage('Settings saved successfully!', 'success');
      
      // Update the status of API keys
      if (settings.apiKey) {
        openaiApiKeyInput.value = '••••••••••••••••••••••••••';
        openaiApiKeyInput.dataset.hasKey = 'true';
      }
      
      if (settings.lmstudioApiKey) {
        lmstudioApiKeyInput.value = '••••••••••••••••••••••••••';
        lmstudioApiKeyInput.dataset.hasKey = 'true';
      }
      
      // Delay navigation to allow user to see the success message (2 seconds delay)
      setTimeout(() => {
        window.location.href = "popup.html";
      }, 2000);
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