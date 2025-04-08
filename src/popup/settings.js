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
  const lmstudioModelSelect = document.getElementById('lmstudio-model');
  const lmstudioRefreshBtn = document.getElementById('lmstudio-refresh-btn');
  const lmstudioSpinner = document.getElementById('lmstudio-spinner');
  const lmstudioModelMessage = document.getElementById('lmstudio-model-message');
  
  // Ollama elements
  const ollamaApiUrlInput = document.getElementById('ollama-api-url');
  const ollamaModelSelect = document.getElementById('ollama-model');
  const ollamaRefreshBtn = document.getElementById('ollama-refresh-btn');
  const ollamaSpinner = document.getElementById('ollama-spinner');
  const ollamaModelMessage = document.getElementById('ollama-model-message');
  
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
  
  // Add event listeners for server URL changes
  lmstudioApiUrlInput.addEventListener('blur', () => {
    fetchLMStudioModels();
  });
  
  ollamaApiUrlInput.addEventListener('blur', () => {
    fetchOllamaModels();
  });
  
  // Add event listeners for refresh buttons
  lmstudioRefreshBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fetchLMStudioModels(true);
  });
  
  ollamaRefreshBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fetchOllamaModels(true);
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
      // Try to fetch LM Studio models if we haven't already
      if (lmstudioModelSelect.options.length <= 1) {
        fetchLMStudioModels();
      }
    } else if (selectedApiMode === 'ollama') {
      ollamaSection.classList.remove('hidden');
      // Try to fetch Ollama models if we haven't already
      if (ollamaModelSelect.options.length <= 1) {
        fetchOllamaModels();
      }
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
      'lmstudioModel',
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
      
      // Store the current LM Studio model to select later after fetching
      if (result.lmstudioModel) {
        lmstudioModelSelect.dataset.selectedModel = result.lmstudioModel;
      }
      
      // Ollama settings
      if (result.ollamaApiUrl) {
        ollamaApiUrlInput.value = result.ollamaApiUrl;
      }
      
      // Store the current Ollama model to select later after fetching
      if (result.ollamaModel) {
        ollamaModelSelect.dataset.selectedModel = result.ollamaModel;
      }
      
      // Format settings - IMPORTANT: use defaultFormat consistently
      if (result.defaultFormat) {
        console.log("Setting default format to:", result.defaultFormat);
        defaultFormatSelect.value = result.defaultFormat;
      } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_SUMMARY_FORMAT) {
        defaultFormatSelect.value = CONFIG.DEFAULT_SUMMARY_FORMAT;
      }
      
      // If the LM Studio or Ollama sections are visible, fetch models
      if (apiMode === 'lmstudio') {
        fetchLMStudioModels();
      } else if (apiMode === 'ollama') {
        fetchOllamaModels();
      }
    });
  }
  
  // Function to fetch available models from LM Studio
  async function fetchLMStudioModels(isManualRefresh = false) {
    const serverUrl = lmstudioApiUrlInput.value.trim();
    
    if (!serverUrl) {
      updateLMStudioModelMessage("Please enter a valid server URL.", "error");
      return;
    }
    
    // Only show "Loading models..." when the dropdown is empty or on manual refresh
    if (lmstudioModelSelect.options.length <= 1 || isManualRefresh) {
      // Clear existing options and add loading option
      lmstudioModelSelect.innerHTML = '<option value="">Loading models...</option>';
      lmstudioModelSelect.disabled = true;
    }
    
    // Show spinner
    lmstudioSpinner.classList.remove('hidden');
    
    try {
      // Format the URL correctly (removing trailing slash if present)
      const baseUrl = serverUrl.replace(/\/+$/, '');
      const modelsUrl = `${baseUrl}/models`;
      
      console.log("Fetching LM Studio models from:", modelsUrl);
      
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("LM Studio models response:", data);
      
      // LM Studio (like OpenAI API) returns a "data" array of models
      if (data && data.data && Array.isArray(data.data)) {
        // Clear existing options
        lmstudioModelSelect.innerHTML = '';
        
        if (data.data.length === 0) {
          lmstudioModelSelect.innerHTML = '<option value="">No models available</option>';
          updateLMStudioModelMessage("No models found on the server.", "error");
        } else {
          // Add models to the dropdown
          data.data.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            lmstudioModelSelect.appendChild(option);
          });
          
          // If we have a previously selected model, try to select it
          const previouslySelected = lmstudioModelSelect.dataset.selectedModel;
          if (previouslySelected) {
            // Try to find the option with this value
            const option = Array.from(lmstudioModelSelect.options).find(opt => opt.value === previouslySelected);
            if (option) {
              lmstudioModelSelect.value = previouslySelected;
            }
          }
          
          updateLMStudioModelMessage(`${data.data.length} models loaded successfully.`, "success");
        }
      } else {
        throw new Error("Invalid response format from LM Studio server");
      }
    } catch (error) {
      console.error("Error fetching LM Studio models:", error);
      lmstudioModelSelect.innerHTML = '<option value="">Could not load models</option>';
      updateLMStudioModelMessage(`Error: ${error.message}`, "error");
    } finally {
      // Hide spinner and enable select
      lmstudioSpinner.classList.add('hidden');
      lmstudioModelSelect.disabled = false;
    }
  }
  
  // Function to fetch available models from Ollama
  async function fetchOllamaModels(isManualRefresh = false) {
    const serverUrl = ollamaApiUrlInput.value.trim();
    
    if (!serverUrl) {
      updateOllamaModelMessage("Please enter a valid server URL.", "error");
      return;
    }
    
    // Only show "Loading models..." when the dropdown is empty or on manual refresh
    if (ollamaModelSelect.options.length <= 1 || isManualRefresh) {
      // Clear existing options and add loading option
      ollamaModelSelect.innerHTML = '<option value="">Loading models...</option>';
      ollamaModelSelect.disabled = true;
    }
    
    // Show spinner
    ollamaSpinner.classList.remove('hidden');
    
    try {
      // Format the URL correctly (removing trailing slash if present)
      const baseUrl = serverUrl.replace(/\/+$/, '');
      const tagsUrl = `${baseUrl.replace('/api', '')}/api/tags`;
      
      console.log("Fetching Ollama models from:", tagsUrl);
      
      const response = await fetch(tagsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Ollama models response:", data);
      
      // Ollama returns a "models" array
      if (data && Array.isArray(data.models)) {
        // Clear existing options
        ollamaModelSelect.innerHTML = '';
        
        if (data.models.length === 0) {
          ollamaModelSelect.innerHTML = '<option value="">No models available</option>';
          updateOllamaModelMessage("No models found on the server.", "error");
        } else {
          // Add models to the dropdown
          data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            ollamaModelSelect.appendChild(option);
          });
          
          // If we have a previously selected model, try to select it
          const previouslySelected = ollamaModelSelect.dataset.selectedModel;
          if (previouslySelected) {
            // Try to find the option with this value
            const option = Array.from(ollamaModelSelect.options).find(opt => opt.value === previouslySelected);
            if (option) {
              ollamaModelSelect.value = previouslySelected;
            }
          }
          
          updateOllamaModelMessage(`${data.models.length} models loaded successfully.`, "success");
        }
      } else {
        throw new Error("Invalid response format from Ollama server");
      }
    } catch (error) {
      console.error("Error fetching Ollama models:", error);
      ollamaModelSelect.innerHTML = '<option value="">Could not load models</option>';
      updateOllamaModelMessage(`Error: ${error.message}`, "error");
    } finally {
      // Hide spinner and enable select
      ollamaSpinner.classList.add('hidden');
      ollamaModelSelect.disabled = false;
    }
  }
  
  // Helper function to update the LM Studio model message
  function updateLMStudioModelMessage(message, type = "") {
    lmstudioModelMessage.textContent = message;
    lmstudioModelMessage.className = ""; // Clear existing classes
    if (type === "error") {
      lmstudioModelMessage.classList.add("error-text");
    } else if (type === "success") {
      lmstudioModelMessage.classList.add("success-text");
    }
  }
  
  // Helper function to update the Ollama model message
  function updateOllamaModelMessage(message, type = "") {
    ollamaModelMessage.textContent = message;
    ollamaModelMessage.className = ""; // Clear existing classes
    if (type === "error") {
      ollamaModelMessage.classList.add("error-text");
    } else if (type === "success") {
      ollamaModelMessage.classList.add("success-text");
    }
  }
  
  // Function to save settings to storage
  function saveSettings(e) {
    e.preventDefault();
    
    const apiMode = document.querySelector('input[name="api-mode"]:checked').value;
    
    const settings = {
      apiMode: apiMode,
      defaultFormat: defaultFormatSelect.value,
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
    
    // Save the selected LM Studio model
    if (lmstudioModelSelect.value) {
      settings.lmstudioModel = lmstudioModelSelect.value;
    }
    
    // Save Ollama settings
    settings.ollamaApiUrl = ollamaApiUrlInput.value;
    
    // Save the selected Ollama model
    if (ollamaModelSelect.value) {
      settings.ollamaModel = ollamaModelSelect.value;
    }
    
    // Validation based on selected API mode
    if (apiMode === 'openai' && !openaiApiKeyInput.dataset.hasKey && !openaiApiKeyInput.value) {
      if (!confirm("You are trying to use the OpenAI API without an API key. This won't work. Continue anyway?")) {
        return; // Don't save if they cancel
      }
    } else if (apiMode === 'lmstudio') {
      if (!lmstudioApiUrlInput.value) {
        showMessage('Please provide a valid LM Studio server URL.', 'error');
        return;
      }
      if (!lmstudioModelSelect.value) {
        if (!confirm("No LM Studio model selected. This may cause issues. Continue anyway?")) {
          return;
        }
      }
    } else if (apiMode === 'ollama') {
      if (!ollamaApiUrlInput.value) {
        showMessage('Please provide a valid Ollama server URL.', 'error');
        return;
      }
      if (!ollamaModelSelect.value) {
        if (!confirm("No Ollama model selected. This may cause issues. Continue anyway?")) {
          return;
        }
      }
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
    messageDiv.classList.remove('hidden');
    
    // Hide the message after 3 seconds
    setTimeout(() => {
      messageDiv.className = 'message hidden';
    }, 3000);
  }
});