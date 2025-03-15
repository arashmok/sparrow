// config.template.js
// Copy this file to config.js and add your API keys
// config.js will be ignored by git to keep your keys private

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
  
  // Do not modify below this line
  if (typeof module !== 'undefined') {
    module.exports = CONFIG;
  } else {
    // For browser context
    if (typeof window !== 'undefined') {
      window.CONFIG = CONFIG;
    }
  }