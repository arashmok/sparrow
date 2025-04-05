// config.template.js
// INSTRUCTIONS:
// 1. Copy this file to config.js: cp config.template.js config.js
// 2. Add your OpenAI API key or LM Studio settings to config.js
// 3. config.js will be ignored by git to keep your keys private

const CONFIG = {
  // API mode: "openai" or "lmstudio"
  API_MODE: "openai",
  
  // OpenAI API settings
  OPENAI_API_KEY: "your_openai_api_key_here",
  OPENAI_MODEL: "gpt-3.5-turbo",
  
  // LM Studio API settings (for running models locally)
  LMSTUDIO_API_URL: "http://localhost:1234/v1",  // Default LM Studio server address
  LMSTUDIO_API_KEY: "",  // Usually not required for local LM Studio
  LMSTUDIO_MODEL: "",    // Will be automatically selected by LM Studio
  
  // Shared API settings
  MAX_TOKENS: 500,
  TEMPERATURE: 0.5,
  
  // Default summary format
  DEFAULT_SUMMARY_FORMAT: "short" // Options: short, detailed, key-points
};

// Make the config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}