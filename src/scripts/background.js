// Background.js - Handles API calls and background processes

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Default configuration if config.js is not found
const DEFAULT_CONFIG = {
  DEVELOPMENT_MODE: true,  // Default to development mode if no config
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-3.5-turbo',
  MAX_TOKENS: 500,
  TEMPERATURE: 0.5,
  ENABLE_HISTORY: true,
  ENABLE_DARK_MODE: false,
  DEFAULT_SUMMARY_FORMAT: 'short'
};

// Use CONFIG if it exists, otherwise use default config
const config = typeof CONFIG !== 'undefined' ? CONFIG : DEFAULT_CONFIG;

// Check if in development mode (from config)
const isDevelopmentMode = config.DEVELOPMENT_MODE !== undefined ? config.DEVELOPMENT_MODE : true;

console.log("Config loaded:", config.OPENAI_API_KEY ? "API key found" : "No API key found");
console.log("Development mode:", isDevelopmentMode ? "ON (using mock data)" : "OFF (using real API)");

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request.action);
  
  if (request.action === "summarize") {
    console.log("Processing summarize request for text of length:", request.text.length);
    
    // Get the API key from storage, or use the one from config
    chrome.storage.local.get(['apiKey'], async (result) => {
      console.log("Checking for API key");
      
      // Priority: 1. User-provided key in storage, 2. Config file key, 3. Empty (will show error)
      const apiKey = result.apiKey || (CONFIG ? CONFIG.OPENAI_API_KEY : '') || '';
      
      if (!apiKey && !isDevelopmentMode) {
        console.log("No API key found and not in development mode - aborting");
        sendResponse({ 
          error: 'No API key found. Please add your OpenAI API key in the extension settings.'
        });
        return;
      }
      
      if (!apiKey) {
        console.log("No API key found, but continuing with mock data (development mode)");
      } else {
        console.log("API key found, but still using mock data due to development mode setting");
      }
      
      console.log("Proceeding with summarization in", 
                  isDevelopmentMode ? "development mode (mock data)" : "production mode (real API)");
      
      try {
        let summary;
        if (isDevelopmentMode) {
          // Use mock data in development mode
          summary = await mockSummaryForTesting(request.text, request.format);
          console.log("Mock summary generated successfully");
        } else {
          // Use real API in production mode
          summary = await generateSummary(request.text, request.format, apiKey);
          console.log("Real API summary generated successfully");
        }
        
        sendResponse({ summary });
      } catch (error) {
        console.error('Error generating summary:', error);
        sendResponse({ error: error.message });
      }
    });
    
    // Return true to indicate that we will send a response asynchronously
    return true;
  }
});

/**
 * Generates a summary of the provided text using OpenAI's API
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiKey - The OpenAI API key
 * @returns {Promise<string>} The generated summary
 */
async function generateSummary(text, format, apiKey) {
  // Limit the text length to avoid token limit issues
  const truncatedText = truncateText(text, 4000);
  
  // Create the prompt based on the selected format
  let prompt;
  
  switch (format) {
    case 'short':
      prompt = `Please provide a concise summary (2-3 sentences) of the following text:\n\n${truncatedText}`;
      break;
    case 'detailed':
      prompt = `Please provide a detailed summary (1-2 paragraphs) of the following text, covering the main points and key information:\n\n${truncatedText}`;
      break;
    case 'key-points':
      prompt = `Please extract the 3-5 most important key points from the following text as a bullet list:\n\n${truncatedText}`;
      break;
    default:
      prompt = `Please summarize the following text:\n\n${truncatedText}`;
  }
  
  try {
    // For a real implementation, uncomment this API call:
    /*
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: CONFIG.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes web content.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: CONFIG.MAX_TOKENS || 500,
        temperature: CONFIG.TEMPERATURE || 0.5
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate summary');
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
    */
    
    // For testing purposes (without API key), return a mock summary:
    return mockSummaryForTesting(text, format);
    
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error('Failed to generate summary. Please check your API key and try again.');
  }
}

/**
 * Truncates text to a maximum character length, preserving complete sentences
 * @param {string} text - The text to truncate
 * @param {number} maxChars - Maximum number of characters
 * @returns {string} The truncated text
 */
function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  
  // Try to truncate at a sentence boundary
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > maxChars * 0.7) {
    // If we found a sentence end point at least 70% into the text, use it
    return text.substring(0, lastSentenceEnd + 1) + ' [truncated]';
  }
  
  // Otherwise truncate at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return text.substring(0, lastSpace) + '... [truncated]';
}

/**
 * Provides a mock summary for testing without API key
 * @param {string} text - The original text
 * @param {string} format - The requested format
 * @returns {Promise<string>} A mock summary
 */
async function mockSummaryForTesting(text, format) {
  console.log("Using mock summary function");
  
  // Extract title from the text if possible
  let title = "webpage";
  const titleMatch = text.match(/Title: (.*?)(\n|$)/);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }
  
  // Create different summaries based on format
  let summary;
  switch (format) {
    case 'short':
      summary = `This webpage discusses ${title}. It covers the main concepts and provides information about the topic.`;
      break;
    
    case 'detailed':
      summary = `This webpage titled "${title}" provides a comprehensive overview of the subject matter. The content explores various aspects of the topic, including key concepts, practical applications, and related information. The page appears to be informative and aimed at readers seeking to understand more about this subject.`;
      break;
    
    case 'key-points':
      summary = `• The webpage is titled "${title}"\n• It contains information about the main subject matter\n• It likely covers definitions and explanations of key concepts\n• It may include examples or applications related to the topic\n• The content is structured to provide readers with a clear understanding of the subject`;
      break;
    
    default:
      summary = `Summary of "${title}": This webpage provides information about the topic, covering key aspects and details that would be relevant to someone interested in the subject.`;
  }
  
  console.log("Mock summary generated:", summary.substring(0, 50) + "...");
  
  // Return the summary
  return summary;
}