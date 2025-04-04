// Background.js - Handles API calls and background processes

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Default configuration
let CONFIG = {
  API_MODE: 'openai',  // Default API mode
  MAX_TOKENS: 500,
  TEMPERATURE: 0.5,
  DEVELOPMENT_MODE: false
};

// Load configuration from storage when needed
// We'll rely on directly accessing the storage for each operation rather than
// keeping a global config object that might get out of sync

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request.action);
  
  if (request.action === "summarize") {
    console.log("Processing summarize request for text of length:", request.text.length);
    
    // Get the settings from storage
    chrome.storage.local.get([
      'apiMode',
      'apiKey',
      'openaiModel',
      'lmstudioApiUrl',
      'lmstudioApiKey',
      'developmentMode'
    ], async (result) => {
      // Determine which API to use
      const apiMode = result.apiMode || CONFIG.API_MODE;
      console.log("Using API mode:", apiMode);
      
      // Determine if we're in development mode
      const isDevelopmentMode = result.developmentMode !== undefined ? 
        result.developmentMode : CONFIG.DEVELOPMENT_MODE;
      
      console.log("Using development mode:", isDevelopmentMode);
      
      if (isDevelopmentMode) {
        // Use mock data for testing
        console.log("Using mock summary function (development mode)");
        const summary = await mockSummaryForTesting(request.text, request.format, request.translateToEnglish);
        console.log("Mock summary generated successfully");
        sendResponse({ summary });
        return;
      }
      
      // Real API mode
      try {
        let summary;
        
        if (apiMode === 'openai') {
          // Get the OpenAI API key
          const apiKey = result.apiKey || '';
          const model = result.openaiModel || 'gpt-3.5-turbo';
          
          if (!apiKey) {
            sendResponse({ 
              error: 'No OpenAI API key found. Please add your API key in the extension settings.'
            });
            return;
          }
          
          console.log("Using OpenAI API with model:", model);
          summary = await generateOpenAISummary(
            request.text, 
            request.format, 
            apiKey, 
            model,
            request.translateToEnglish
          );
        } else if (apiMode === 'lmstudio') {
          // Get LM Studio settings
          const lmStudioUrl = result.lmstudioApiUrl || 'http://localhost:1234/v1';
          const lmStudioKey = result.lmstudioApiKey || '';
          
          if (!lmStudioUrl) {
            sendResponse({ 
              error: 'No LM Studio server URL found. Please check your settings.'
            });
            return;
          }
          
          console.log("Using LM Studio API at:", lmStudioUrl);
          summary = await generateLMStudioSummary(
            request.text, 
            request.format, 
            lmStudioUrl,
            lmStudioKey,
            request.translateToEnglish
          );
        } else {
          throw new Error(`Unknown API mode: ${apiMode}`);
        }
        
        console.log("Summary generated successfully");
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
 * Generates a summary using OpenAI's API
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiKey - The OpenAI API key
 * @param {string} model - The OpenAI model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOpenAISummary(text, format, apiKey, model, translateToEnglish = false) {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);
  
  try {
    // Make the API call
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes web content with clear, well-structured formatting.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.5
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Failed to generate summary (Status: ${response.status})`);
    }
    
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error('Failed to generate summary with OpenAI. Please check your API key and try again.');
  }
}

/**
 * Generates a summary using the LM Studio API
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The LM Studio API URL
 * @param {string} apiKey - The LM Studio API key (optional)
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateLMStudioSummary(text, format, apiUrl, apiKey = '', translateToEnglish = false) {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);
  
  // Ensure apiUrl has the correct endpoint
  const chatEndpoint = apiUrl.endsWith('/chat/completions') ? 
    apiUrl : 
    `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
  
  try {
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add API key if provided
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Make the API call to LM Studio
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes web content with clear, well-structured formatting.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.5,
        stream: false
      })
    });
    
    if (!response.ok) {
      let errorMessage = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status code
      }
      throw new Error(`Failed to generate summary: ${errorMessage}`);
    }
    
    const data = await response.json();
    let summary = data.choices[0].message.content.trim();
    
    // Add translation prefix if needed
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling LM Studio API:', error);
    throw new Error(`Failed to connect to LM Studio server at ${apiUrl}. Please check that LM Studio is running and your settings are correct.`);
  }
}

/**
 * Creates an optimized prompt for the summary based on format and translation preference
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {string} The formatted prompt
 */
function createPrompt(text, format, translateToEnglish = false) {
  // Limit the text length to avoid token limit issues
  const truncatedText = truncateText(text, 4000);
  
  // Add translation instruction if needed
  const translationPrefix = translateToEnglish ? "Translate the following content to English and then " : "";
  
  // Base instructions for better formatting
  const formattingInstructions = "Ensure your response has a clear structure with proper paragraph breaks. ";
  
  let prompt;
  
  switch (format) {
    case 'short':
      prompt = `${translationPrefix}${formattingInstructions}Please provide a concise summary (2-3 sentences) of the following text. Use a clear title followed by a brief summary paragraph:\n\n${truncatedText}`;
      break;
    case 'detailed':
      prompt = `${translationPrefix}${formattingInstructions}Please provide a detailed summary (1-2 paragraphs) of the following text, covering the main points and key information. Structure your response with a clear title and well-organized paragraphs with proper line breaks between them:\n\n${truncatedText}`;
      break;
    case 'key-points':
      prompt = `${translationPrefix}${formattingInstructions}Please extract the 3-5 most important key points from the following text as a bullet list. Start with a brief title or description, then list each key point on a new line with a bullet point (•):\n\n${truncatedText}`;
      break;
    default:
      prompt = `${translationPrefix}${formattingInstructions}Please summarize the following text with a clear structure, using paragraph breaks to separate main ideas:\n\n${truncatedText}`;
  }
  
  return prompt;
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
async function mockSummaryForTesting(text, format, translateToEnglish = false) {
  console.log("Using mock summary function");
  console.log("Translation to English:", translateToEnglish ? "Enabled" : "Disabled");
  
  // Extract title from the text if possible
  let title = "webpage";
  const titleMatch = text.match(/Title: (.*?)(\n|$)/);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }
  
  // If translation is requested, add a note about it
  const translationPrefix = translateToEnglish ? "[Translated to English] " : "";
  
  // Create different summaries based on format
  let summary;
  switch (format) {
    case 'short':
      summary = `${translationPrefix}This webpage discusses ${title}. It covers the main concepts and provides information about the topic.`;
      break;
    
    case 'detailed':
      summary = `${translationPrefix}This webpage titled "${title}" provides a comprehensive overview of the subject matter. The content explores various aspects of the topic, including key concepts, practical applications, and related information. The page appears to be informative and aimed at readers seeking to understand more about this subject.`;
      break;
    
    case 'key-points':
      summary = `${translationPrefix}• The webpage is titled "${title}"\n• It contains information about the main subject matter\n• It likely covers definitions and explanations of key concepts\n• It may include examples or applications related to the topic\n• The content is structured to provide readers with a clear understanding of the subject`;
      break;
    
    default:
      summary = `${translationPrefix}Summary of "${title}": This webpage provides information about the topic, covering key aspects and details that would be relevant to someone interested in the subject.`;
  }
  
  console.log("Mock summary generated:", summary.substring(0, 50) + "...");
  
  // Return the summary
  return summary;
}