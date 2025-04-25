/**
 * Settings.js - Handles the settings page functionality
 * Manages user preferences for API configurations, model selection,
 * and other settings for the Sparrow extension.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =====================================================================
  // DOM Element References
  // =====================================================================
  
  // Form elements
  const settingsForm = document.getElementById('settings-form');
  const apiModeSelect = document.getElementById('api-mode-select');
  
  // API section containers
  const openaiSection = document.getElementById('openai-section');
  const lmstudioSection = document.getElementById('lmstudio-section');
  const ollamaSection = document.getElementById('ollama-section');
  const openrouterSection = document.getElementById('openrouter-section');
  
  // OpenAI elements
  const openaiApiKeyInput = document.getElementById('openai-api-key');
  const openaiModelSelect = document.getElementById('openai-model');
  const openaiRefreshBtn = document.getElementById('openai-refresh-btn');
  const openaiSpinner = document.getElementById('openai-spinner');
  
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
  const openrouterRefreshBtn = document.getElementById('openrouter-refresh');
  const openrouterSpinner = document.getElementById('openrouter-spinner');
  const openrouterModelMessage = document.getElementById('openrouter-model-message');
  
  // OpenWebUI elements
  const enableOpenWebUI = document.getElementById('enable-openwebui');
  const openWebUISettings = document.getElementById('openwebui-settings');
  const openWebUIUrl = document.getElementById('openwebui-url');
  const openWebUIApiKey = document.getElementById('openwebui-api-key');
  
  // Shared elements
  const defaultFormatSelect = document.getElementById('default-format');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveBtn = document.getElementById('save-btn');
  const statusMessage = document.getElementById('status-message');
  
  // =====================================================================
  // Initialization
  // =====================================================================
  
  /**
   * Initialize the settings page
   * Loads saved settings and sets up event listeners
   */
  function init() {
    // Load saved settings from storage
    loadSettings();
    
    // Set up event listeners
    setupEventListeners();
  }
  
  // Run initialization
  init();
  
  // =====================================================================
  // Event Listeners Setup
  // =====================================================================
  
  /**
   * Set up all event listeners for the settings page
   */
  function setupEventListeners() {
    // Form submission
    settingsForm.addEventListener('submit', saveSettings);
    
    // Save button click (triggers form submission)
    saveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      settingsForm.dispatchEvent(new Event('submit'));
    });
    
    // Cancel button returns to popup
    cancelBtn.addEventListener('click', () => {
      window.location.href = "popup.html";
    });
    
    // API mode dropdown changes which section is visible
    apiModeSelect.addEventListener('change', updateApiSectionVisibility);
    
    // Server URL changes trigger model fetching
    lmstudioApiUrlInput.addEventListener('blur', () => {
      fetchLMStudioModels();
    });
    
    ollamaApiUrlInput.addEventListener('blur', () => {
      fetchOllamaModels();
    });
    
    // Refresh buttons for model lists
    openaiRefreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fetchOpenAIModels(true);
    });
    
    lmstudioRefreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fetchLMStudioModels(true);
    });
    
    ollamaRefreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fetchOllamaModels(true);
    });
    
    if (openrouterRefreshBtn) {
      openrouterRefreshBtn.addEventListener('click', function() {
        console.log("OpenRouter refresh button clicked");
        fetchOpenRouterModels(true); // Pass true to indicate manual refresh
      });
    }
    
    // Add OpenAI API key input events
    openaiApiKeyInput.addEventListener('blur', function() {
      const apiKey = this.value.trim();
      if (apiKey && apiKey !== '••••••••••••••••••••••••••') {
        fetchOpenAIModels(true);
      }
    });

    // Handle clearing the masked bullets when the field gets focus
    openaiApiKeyInput.addEventListener('focus', function() {
      if (/^•+$/.test(this.value)) {
        // Clear the bullet characters when focused
        this.value = '';
      }
    });

    // When the field loses focus and is empty but we had a key before
    openaiApiKeyInput.addEventListener('blur', function() {
      if (this.value === '' && this.dataset.hasKey === 'true') {
        // Restore bullets if no new input was provided
        this.value = '••••••••••••••••••••••••••';
      }
    });
    
    // OpenRouter API key input events
    setupOpenRouterKeyEvents();
    
    // OpenWebUI checkbox
    enableOpenWebUI.addEventListener('change', function() {
      if (this.checked) {
        openWebUISettings.classList.remove('hidden');
      } else {
        openWebUISettings.classList.add('hidden');
      }
    });
    
    // OpenWebUI API key input events
    openWebUIApiKey.addEventListener('focus', function() {
      if (/^•+$/.test(this.value)) {
        // Clear the bullet characters when focused
        this.value = '';
      }
    });

    openWebUIApiKey.addEventListener('blur', function() {
      if (this.value === '' && this.dataset.hasKey === 'true') {
        // Restore bullets if no new input was provided
        this.value = '••••••••••••••••••••••••••';
      }
    });
  }
  
  /**
   * Set up special event handling for OpenRouter API key input
   */
  function setupOpenRouterKeyEvents() {
    // Handle input changes with debouncing
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
  }
  
  // =====================================================================
  // Settings Management Functions
  // =====================================================================
  
  /**
   * Load all settings from Chrome storage
   */
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
      'defaultFormat',
      'enableOpenWebUI',
      'openWebUIUrl',
      'openWebUIApiKey'
    ], (result) => {
      console.log("Loaded settings:", result);
      
      // Set API mode in dropdown
      const apiMode = result.apiMode || 'openai';
      apiModeSelect.value = apiMode;
      updateApiSectionVisibility();
      
      // OpenAI settings
      chrome.runtime.sendMessage({ action: 'check-api-key', service: 'openai' }, (result) => {
        if (result.hasKey) {
          openaiApiKeyInput.value = '••••••••••••••••••••••••••';
          openaiApiKeyInput.dataset.hasKey = 'true';
          // Fetch OpenAI models after confirming we have a key
          fetchOpenAIModels();
        }
      });
      
      // Similarly for other services
      
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
      
      // OpenWebUI settings
      if (result.enableOpenWebUI) {
        enableOpenWebUI.checked = true;
        openWebUISettings.classList.remove('hidden');
      } else {
        enableOpenWebUI.checked = false;
        openWebUISettings.classList.add('hidden');
      }
      
      if (result.openWebUIUrl) {
        openWebUIUrl.value = result.openWebUIUrl;
      }
      
      // Check if OpenWebUI API key exists
      chrome.runtime.sendMessage({ action: 'check-api-key', service: 'openwebui' }, (result) => {
        if (result.hasKey) {
          openWebUIApiKey.value = '••••••••••••••••••••••••••';
          openWebUIApiKey.dataset.hasKey = 'true';
        }
      });
      
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
  
  /**
   * Save settings to Chrome storage
   * Triggered on form submission
   * 
   * @param {Event} e - Form submission event
   */
  function saveSettings(e) {
    e.preventDefault();
    
    const apiMode = apiModeSelect.value;
    
    // Build settings object with all required data
    const settings = {
      apiMode: apiMode,
      defaultFormat: defaultFormatSelect.value,
      openaiModel: openaiModelSelect.value,
      enableOpenWebUI: enableOpenWebUI.checked,
      openWebUIUrl: openWebUIUrl.value
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
      // Store key securely using the background script
      chrome.runtime.sendMessage({
        action: 'store-api-key',
        service: 'openai',
        key: openaiApiKeyInput.value
      });
    }
    
    // Handle OpenWebUI API key
    if (openWebUIApiKey.value && openWebUIApiKey.value !== '••••••••••••••••••••••••••') {
      chrome.runtime.sendMessage({
        action: 'store-api-key',
        service: 'openwebui',
        key: openWebUIApiKey.value
      });
    }
    
    // Similarly for OpenRouter and other services
    if (openrouterApiKeyInput.value && openrouterApiKeyInput.value !== '••••••••••••••••••••••••••') {
      chrome.runtime.sendMessage({
        action: 'store-api-key',
        service: 'openrouter',
        key: openrouterApiKeyInput.value
      });
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
  
  // =====================================================================
  // UI Update Functions
  // =====================================================================
  
  /**
   * Update which API section is visible based on selected mode
   */
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
  
  /**
   * Display a status message to the user
   * 
   * @param {string} text - Message to display
   * @param {string} type - Message type ('success' or 'error')
   */
  function showMessage(text, type) {
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
  }
  
  /**
   * Update the LM Studio model message display
   * 
   * @param {string} message - Message to display
   * @param {string} type - Message type ('error' or 'success')
   */
  function updateLMStudioModelMessage(message, type = "") {
    lmstudioModelMessage.textContent = message;
    lmstudioModelMessage.className = ""; // Clear existing classes
    if (type === "error") {
      lmstudioModelMessage.classList.add("error-text");
    } else if (type === "success") {
      lmstudioModelMessage.classList.add("success-text");
    }
  }
  
  /**
   * Update the Ollama model message display
   * 
   * @param {string} message - Message to display
   * @param {string} type - Message type ('error' or 'success')
   */
  function updateOllamaModelMessage(message, type = "") {
    ollamaModelMessage.textContent = message;
    ollamaModelMessage.className = ""; // Clear existing classes
    if (type === "error") {
      ollamaModelMessage.classList.add("error-text");
    } else if (type === "success") {
      ollamaModelMessage.classList.add("success-text");
    }
  }
  
  /**
   * Update the OpenRouter model message display
   * 
   * @param {string} message - Message to display
   * @param {string} type - Message type ('error' or 'success')
   */
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
  
  // =====================================================================
  // Model Fetching Functions
  // =====================================================================
  
  /**
   * Fetch available models from LM Studio
   * 
   * @param {boolean} isManualRefresh - Whether this is a manual refresh (true) or automatic (false)
   */
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
          selectPreviousModel(lmstudioModelSelect);
          
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
  
  /**
   * Fetch available models from Ollama
   * 
   * @param {boolean} isManualRefresh - Whether this is a manual refresh (true) or automatic (false)
   */
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
          selectPreviousModel(ollamaModelSelect);
          
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
  
  /**
   * Fetch available models from OpenRouter
   * 
   * @param {boolean} isManualRefresh - Whether this is a manual refresh (true) or automatic (false)
   */
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
        selectPreviousModel(openrouterModelSelect);
        
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

  /**
   * Fetch available models from OpenAI
   * 
   * @param {boolean} isManualRefresh - Whether this is a manual refresh (true) or automatic (false)
   */
  async function fetchOpenAIModels(isManualRefresh = false) {
    // Check if we have a key
    const hasStoredKey = openaiApiKeyInput.dataset.hasKey === 'true';
    const hasVisibleKey = openaiApiKeyInput.value.trim() !== '' && 
                          openaiApiKeyInput.value !== '••••••••••••••••••••••••••';
    
    if (!hasStoredKey && !hasVisibleKey) {
      // No key available, use default options
      console.log("No OpenAI API key available, using default models");
      return;
    }
    
    // Get the visible key if there is one
    let apiKey = null;
    if (hasVisibleKey) {
      apiKey = openaiApiKeyInput.value.trim();
    }
    
    // Show loading state
    openaiModelSelect.disabled = true;
    
    // Store current selection to restore it after refresh
    const currentSelection = openaiModelSelect.value;
    
    try {
      // Request models from background script
      chrome.runtime.sendMessage({ 
        action: 'fetch-openai-models',
        apiKey: apiKey 
      }, (response) => {
        if (response.error) {
          console.warn("Error fetching OpenAI models:", response.error);
        }
        
        // Clear existing options
        openaiModelSelect.innerHTML = '';
        
        // Add models to dropdown
        if (response.models && response.models.length > 0) {
          response.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            openaiModelSelect.appendChild(option);
          });
          
          // Restore previous selection if it exists in the new models list
          const modelExists = Array.from(openaiModelSelect.options)
            .some(option => option.value === currentSelection);
            
          if (modelExists) {
            openaiModelSelect.value = currentSelection;
          }
        }
        
        // Enable the select
        openaiModelSelect.disabled = false;
      });
    } catch (error) {
      console.error("Error in fetchOpenAIModels:", error);
      openaiModelSelect.disabled = false;
    }
  }

  /**
   * Helper function to select a previously chosen model in a dropdown
   * 
   * @param {HTMLSelectElement} selectElement - The select element to update
   */
  function selectPreviousModel(selectElement) {
    const previouslySelected = selectElement.dataset.selectedModel;
    if (previouslySelected) {
      // Try to find the option with this value
      const option = Array.from(selectElement.options).find(opt => opt.value === previouslySelected);
      if (option) {
        selectElement.value = previouslySelected;
      }
    }
  }
  
  /**
   * Debounce helper function
   * Limits how often a function can be called
   * 
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
});