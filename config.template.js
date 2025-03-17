// config.template.js
// INSTRUCTIONS:
// 1. Copy this file to config.js: cp config.template.js config.js
// 2. Add your OpenAI API key to config.js
// 3. config.js will be ignored by git to keep your keys private

// NOTE: Development mode is now controlled through the extension settings UI
// You don't need to modify this file to toggle between development and production modes

const CONFIG = {
  // Your OpenAI API key (you can also set this through the extension settings UI)
  OPENAI_API_KEY: "your_openai_api_key_here",
  
  // API settings
  OPENAI_MODEL: "gpt-3.5-turbo",
  MAX_TOKENS: 500,
  TEMPERATURE: 0.5,
  
  // Default summary format
  DEFAULT_SUMMARY_FORMAT: "short" // Options: short, detailed, key-points
};

// Make the config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}