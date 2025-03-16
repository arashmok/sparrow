// config.template.js
// INSTRUCTIONS:
// 1. Copy this file to config.js: cp config.template.js config.js
// 2. Add your OpenAI API key to config.js
// 3. config.js will be ignored by git to keep your keys private

// NOTE: During development, you don't need an API key as the extension uses mock data by default.
// When you're ready to test with the real OpenAI API:
// 1. Set up your API key in config.js
// 2. Change DEVELOPMENT_MODE to false in src/scripts/background.js

const CONFIG = {
  // Your OpenAI API key
  OPENAI_API_KEY: "your_openai_api_key_here",
  
  // API settings
  OPENAI_MODEL: "gpt-3.5-turbo",
  MAX_TOKENS: 500,
  TEMPERATURE: 0.5,
  
  // Feature flags
  ENABLE_HISTORY: true,
  ENABLE_DARK_MODE: false,
  
  // Default summary format
  DEFAULT_SUMMARY_FORMAT: "short" // Options: short, detailed, key-points
};

// Make the config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}