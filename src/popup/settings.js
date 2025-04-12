// Settings.js - Handles the settings page functionality

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const settingsForm = document.getElementById('settings-form');
  const apiModeSelect = document.getElementById('api-mode-select');
  const openaiSection = document.getElementById('openai-section');
  const lmstudioSection = document.getElementById('lmstudio-section');
  const ollamaSection = document.getElementById('ollama-section');
  const openrouterSection = document.getElementById('openrouter-section');
  
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
  
  // OpenRouter elements
  const openrouterApiKeyInput = document.getElementById('openrouter-api-key');
  const openrouterModelSelect = document.getElementById('openrouter-model');
  const openrouterSpinner = document.getElementById('openrouter-spinner');
  const openrouterModelMessage = document.getElementById('openrouter-model-message');
  
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
  
  // Add event listener for dropdown change
  apiModeSelect.addEventListener('change', updateApiSectionVisibility);
  
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

  // OpenRouter refresh button
  const openrouterRefreshButton = document.getElementById('openrouter-refresh');
  if (openrouterRefreshButton) {
    openrouterRefreshButton.addEventListener('click', function() {
      console.log("OpenRouter refresh button clicked");
      fetchOpenRouterModels(true); // Pass true to indicate manual refresh
    });
  }

  // Update the OpenRouter API key input event listener
  openrouterApiKeyInput.addEventListener('input', function() {
    const newKey = this.value.trim();
    
    // Immediately clear models and set message when key changes
    if (this.dataset.lastCheckedKey !== newKey) {
      // Reset the dropdown immediately
      openrouterModelSelect.innerHTML = '<option value="">Enter valid API key to load models</option>';
      updateOpenRouterModelMessage("Waiting for valid API key...");
      
      // Clear any previously stored validation state
      delete this.dataset.key;
      delete this.dataset.lastCheckedKey;
      
      // Cancel any pending validation
      if (this._validationTimeout) {
        clearTimeout(this._validationTimeout);
      }
      
      // Only validate if the key is reasonably long (to avoid unnecessary API calls)
      if (newKey.length > 20) {
        // Set a timeout to validate the key (debounce)
        this._validationTimeout = setTimeout(() => {
          console.log("Validating new OpenRouter API key");
          this.dataset.lastCheckedKey = newKey;
          fetchOpenRouterModels(true); // Force refresh with the new key
        }, 500);
      }
    }
  });

  // Handle clearing the masked bullets when the field gets focus
  openrouterApiKeyInput.addEventListener('focus', function() {
    if (/^•+$/.test(this.value)) {
      // Clear the bullet characters when focused
      this.value = '';
    }
  });

  // When the field loses focus and is empty but we had a key before
  openrouterApiKeyInput.addEventListener('blur', function() {
    if (this.value === '' && this.dataset.hasKey === 'true') {
      // Restore bullets if no new input was provided
      this.value = '••••••••••••••••••••••••••';
    }
  });
  
  // Function to update API section visibility based on selected mode
  function updateApiSectionVisibility() {
    const selectedApiMode = apiModeSelect.value;
    
    // Hide all sections first
    openaiSection.classList.add('hidden');
    lmstudioSection.classList.add('hidden');
    ollamaSection.classList.add('hidden');
    openrouterSection.classList.add('hidden');
    
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
    } else if (selectedApiMode === 'openrouter') {
      openrouterSection.classList.remove('hidden');
      // Try to fetch OpenRouter models if we haven't already
      if (openrouterModelSelect.options.length <= 1) {
        fetchOpenRouterModels();
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
      'openrouterApiKey',
      'openrouterModel',
      'defaultFormat'
    ], (result) => {
      console.log("Loaded settings:", result);
      
      // Set API mode in dropdown
      const apiMode = result.apiMode || 'openai';
      apiModeSelect.value = apiMode;
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
      
      // OpenRouter settings
      if (result.openrouterApiKey) {
        openrouterApiKeyInput.value = '••••••••••••••••••••••••••';
        openrouterApiKeyInput.dataset.hasKey = 'true';
        openrouterApiKeyInput.dataset.key = result.openrouterApiKey;
        
        // Also set the selected model if available
        if (result.openrouterModel) {
          openrouterModelSelect.dataset.selectedModel = result.openrouterModel;
        }
        
        // Don't show any message until we've tried to fetch models
        updateOpenRouterModelMessage("Loading models...");
        
        // Trigger model loading after a short delay to ensure DOM is ready
        setTimeout(() => {
          fetchOpenRouterModels();
        }, 300);
      }
      
      // Format settings - IMPORTANT: use defaultFormat consistently
      if (result.defaultFormat) {
        console.log("Setting default format to:", result.defaultFormat);
        defaultFormatSelect.value = result.defaultFormat;
      } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_SUMMARY_FORMAT) {
        defaultFormatSelect.value = CONFIG.DEFAULT_SUMMARY_FORMAT;
      }
      
      // If the LM Studio, Ollama, or OpenRouter sections are visible, fetch models
      if (apiMode === 'lmstudio') {
        fetchLMStudioModels();
      } else if (apiMode === 'ollama') {
        fetchOllamaModels();
      } else if (apiMode === 'openrouter') {
        fetchOpenRouterModels();
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
  
  // Function to fetch available models from OpenRouter
  async function fetchOpenRouterModels(isManualRefresh = false) {
    // Add this line to store the current key in the dataset
    const apiKey = openrouterApiKeyInput.value.trim();
    if (apiKey && apiKey !== '••••••••••••••••••••••••••') {
      openrouterApiKeyInput.dataset.key = apiKey;
    }

    // Check for visible API key or stored key
    let keyToUse = openrouterApiKeyInput.value.trim();
    
    // If the input shows bullets and we have a stored key, use that instead
    if ((/^•+$/.test(keyToUse) || keyToUse === '') && openrouterApiKeyInput.dataset.hasKey === 'true') {
      keyToUse = openrouterApiKeyInput.dataset.key || '';
      console.log("Using stored OpenRouter API key");
    }
    
    if (!keyToUse) {
      // Clear dropdown and show message
      openrouterModelSelect.innerHTML = '<option value="">No API key provided</option>';
      updateOpenRouterModelMessage("Please enter a valid API key.", "error");
      return;
    }
    
    // Always clear existing options when validating a key
    openrouterModelSelect.innerHTML = '<option value="">Validating API key...</option>';
    openrouterModelSelect.disabled = true;
    
    // Show spinner
    openrouterSpinner.classList.remove('hidden');
    
    // Clear any existing error message during loading
    updateOpenRouterModelMessage("Validating API key...");
    
    try {
      console.log("Fetching OpenRouter models with key:", keyToUse.substring(0, 4) + "...");
      
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("OpenRouter models response:", data);
      
      // Clear existing options
      openrouterModelSelect.innerHTML = '';
      
      if (!data.data || data.data.length === 0) {
        openrouterModelSelect.innerHTML = '<option value="">No models available</option>';
        updateOpenRouterModelMessage("No models found.", "error");
      } else {
        // Add models to the dropdown
        data.data.forEach(model => {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = model.id;
          openrouterModelSelect.appendChild(option);
        });
        
        // If we have a previously selected model, try to select it
        const previouslySelected = openrouterModelSelect.dataset.selectedModel;
        if (previouslySelected) {
          // Try to find the option with this value
          const option = Array.from(openrouterModelSelect.options).find(opt => opt.value === previouslySelected);
          if (option) {
            openrouterModelSelect.value = previouslySelected;
          }
        }
        
        updateOpenRouterModelMessage(`${data.data.length} models loaded successfully.`, "success");
        
        // Update the stored key as valid
        openrouterApiKeyInput.dataset.key = keyToUse;
      }
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
      // Clear the dropdown completely on error
      openrouterModelSelect.innerHTML = '<option value="">Could not load models</option>';
      updateOpenRouterModelMessage(`Error: ${error.message}`, "error");
      
      // Always clear the stored key on any validation error to force revalidation
      delete openrouterApiKeyInput.dataset.key;
      delete openrouterApiKeyInput.dataset.lastCheckedKey;
    } finally {
      // Hide spinner and enable select
      openrouterSpinner.classList.add('hidden');
      openrouterModelSelect.disabled = false;
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
  
  // Helper function to update the OpenRouter model message
  function updateOpenRouterModelMessage(message, type = "") {
    if (openrouterModelMessage) {
      openrouterModelMessage.textContent = message;
      openrouterModelMessage.className = ""; // Clear existing classes
      if (type === "error") {
        openrouterModelMessage.classList.add("error-text");
      } else if (type === "success") {
        openrouterModelMessage.classList.add("success-text");
      }
    }
  }
  
  // Function to save settings to storage
  function saveSettings(e) {
    e.preventDefault();
    
    const apiMode = apiModeSelect.value;
    
    // Build settings object with all required data
    const settings = {
      apiMode: apiMode,
      defaultFormat: defaultFormatSelect.value,
      openaiModel: openaiModelSelect.value
    };
    
    // Ensure we save all the API URLs regardless of current mode
    if (lmstudioApiUrlInput.value) {
      settings.lmstudioApiUrl = lmstudioApiUrlInput.value;
    }
    
    if (ollamaApiUrlInput.value) {
      settings.ollamaApiUrl = ollamaApiUrlInput.value;
    }
    
    // Handle the OpenAI API key
    if (openaiApiKeyInput.value && openaiApiKeyInput.value !== '••••••••••••••••••••••••••') {
      settings.apiKey = openaiApiKeyInput.value;
    } else if (openaiApiKeyInput.dataset.hasKey === 'true') {
      // Keep the existing key
    }
    
    // Save the models for each service regardless of current mode
    if (lmstudioModelSelect.value) {
      settings.lmstudioModel = lmstudioModelSelect.value;
    }
    
    if (ollamaModelSelect.value) {
      settings.ollamaModel = ollamaModelSelect.value;
    }
    
    if (openrouterModelSelect.value) {
      settings.openrouterModel = openrouterModelSelect.value;
    }
    
    // Improved OpenRouter API key handling
    if (openrouterApiKeyInput.value && openrouterApiKeyInput.value !== '••••••••••••••••••••••••••') {
      settings.openrouterApiKey = openrouterApiKeyInput.value;
    } else if (openrouterApiKeyInput.dataset.key) {
      settings.openrouterApiKey = openrouterApiKeyInput.dataset.key;
    }
    
    // Use chrome.storage.local.get first to preserve any settings not explicitly set
    chrome.storage.local.get(null, (existingSettings) => {
      // Merge the new settings with existing ones
      const mergedSettings = {...existingSettings, ...settings};
      
      // Save the merged settings
      chrome.storage.local.set(mergedSettings, () => {
        showMessage('Settings saved successfully!', 'success');
        
        // Increase the timeout slightly to ensure the message is seen
        setTimeout(() => {
          window.location.href = "popup.html";
        }, 1000);
      });
    });
  }
  
  // Function to show a message
  function showMessage(text, type) {
    // Get the status message element
    const statusMessage = document.getElementById('status-message');
    
    // Set the message text
    statusMessage.textContent = text;
    
    // Set color based on message type
    if (type === 'success') {
      statusMessage.style.color = '#388e3c';
    } else if (type === 'error') {
      statusMessage.style.color = '#d32f2f';
    }
    
    // Show the message
    statusMessage.classList.add('visible');
    
    // No need to hide the message with timeout since we'll be redirecting
  }
  
  // Debounce helper function
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
});