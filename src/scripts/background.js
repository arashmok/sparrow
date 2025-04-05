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
      'ollamaApiUrl',
      'ollamaModel',
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
        } else if (apiMode === 'ollama') {
          // Get Ollama settings
          const ollamaApiUrl = result.ollamaApiUrl || 'http://localhost:11434/api';
          const ollamaModel = result.ollamaModel || 'llama2';
          
          if (!ollamaApiUrl) {
            sendResponse({ 
              error: 'No Ollama server URL found. Please check your settings.'
            });
            return;
          }
          
          if (!ollamaModel) {
            sendResponse({ 
              error: 'No Ollama model specified. Please check your settings.'
            });
            return;
          }
          
          console.log("Using Ollama API at:", ollamaApiUrl, "with model:", ollamaModel);
          summary = await generateOllamaSummary(
            request.text, 
            request.format, 
            ollamaApiUrl,
            ollamaModel,
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
          { 
            role: 'system', 
            content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
          },
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
          { 
            role: 'system', 
            content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
          },
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
 * Generates a summary using the Ollama API
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The Ollama API URL (base URL)
 * @param {string} model - The Ollama model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOllamaSummary(text, format, apiUrl, model, translateToEnglish = false) {
  // Create the optimized prompt
  const prompt = createPrompt(text, format, translateToEnglish);
  
  try {
    // Ensure apiUrl has the correct format (remove trailing slash if present)
    const baseUrl = apiUrl.replace(/\/+$/, '');
    
    // Ollama uses a different endpoint structure than OpenAI
    // For chat completions we need to use /api/chat
    const chatEndpoint = `${baseUrl}/chat`;
    
    console.log("Ollama API request to:", chatEndpoint);
    
    // Make the API call to Ollama
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
          },
          { role: 'user', content: prompt }
        ],
        options: {
          temperature: 0.5
        },
        stream: false
      })
    });
    
    if (!response.ok) {
      // Try a fallback to the older Ollama API format if the chat endpoint fails
      return await generateOllamaFallbackSummary(text, format, apiUrl, model, translateToEnglish);
    }
    
    const data = await response.json();
    
    // Ollama might have a slightly different response format than OpenAI
    let summary = '';
    if (data.message && data.message.content) {
      summary = data.message.content.trim();
    } else if (data.response) {
      // Fallback for older Ollama versions
      summary = data.response.trim();
    } else {
      throw new Error('Unexpected response format from Ollama API');
    }
    
    // Add translation prefix if needed
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw new Error(`Failed to connect to Ollama server at ${apiUrl}. Please ensure Ollama is running, the model is loaded, and CORS is properly configured.`);
  }
}

/**
 * Fallback for older Ollama API versions that use the /api/generate endpoint
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The Ollama API URL (base URL)
 * @param {string} model - The Ollama model to use
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @returns {Promise<string>} The generated summary
 */
async function generateOllamaFallbackSummary(text, format, apiUrl, model, translateToEnglish = false) {
  // Create the optimized prompt with system message included
  const systemMessage = 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.';
  const userPrompt = createPrompt(text, format, translateToEnglish);
  const fullPrompt = `${systemMessage}\n\n${userPrompt}`;
  
  try {
    // Ensure apiUrl has the correct format (remove trailing slash if present)
    const baseUrl = apiUrl.replace(/\/+$/, '');
    
    // Old Ollama endpoint for completions
    const generateEndpoint = `${baseUrl}/generate`;
    
    console.log("Ollama API fallback request to:", generateEndpoint);
    
    // Make the API call to Ollama's generate endpoint
    const response = await fetch(generateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        options: {
          temperature: 0.5
        },
        stream: false
      })
    });
    
    if (!response.ok) {
      let errorMessage = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status code
      }
      throw new Error(`Failed to generate summary: ${errorMessage}`);
    }
    
    const data = await response.json();
    
    // Extract the response from Ollama
    let summary = '';
    if (data.response) {
      summary = data.response.trim();
    } else {
      throw new Error('Unexpected response format from Ollama API');
    }
    
    // Add translation prefix if needed
    if (translateToEnglish) {
      summary = "[Translated to English] " + summary;
    }
    
    return summary;
  } catch (error) {
    console.error('Error calling Ollama generate API:', error);
    throw new Error(`Failed to connect to Ollama server at ${apiUrl}. Please ensure Ollama is running and the model is loaded.`);
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
  
  let prompt;
  
  switch (format) {
    case 'short':
      prompt = `${translationPrefix}You must create an EXTREMELY concise summary (maximum 2-3 sentences, no more) of the following text. 
Focus only on the most essential information. Your response must be very brief.
Do not include any explanations or additional details beyond the core message.
First provide a very short title (3-5 words only), then a tiny summary paragraph:\n\n${truncatedText}`;
      break;
      
    case 'detailed':
      prompt = `${translationPrefix}Please provide a detailed yet focused summary (1-2 paragraphs) of the following text.
Cover the main points and key information.
Structure your response with:
1. A clear, descriptive title (one line)
2. Well-organized paragraphs with proper line breaks between them
3. Ensure the most important information is prioritized\n\n${truncatedText}`;
      break;
      
    case 'key-points':
      prompt = `${translationPrefix}Extract exactly 3-5 of the most important key points from the following text.
Format your response as:
1. A brief title (one line only)
2. A bullet list where each key point:
   - Starts with a bullet point (•)
   - Is concise (preferably one sentence)
   - Captures a distinct important idea
   - Is directly relevant to the main topic\n\n${truncatedText}`;
      break;
      
    default:
      prompt = `${translationPrefix}Please summarize the following text with a clear structure.
Use paragraph breaks to separate main ideas.
Highlight the most important aspects while maintaining reasonable brevity:\n\n${truncatedText}`;
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
      summary = `${translationPrefix}${title}
This webpage discusses ${title.toLowerCase()} with key information about the main subject.`;
      break;
    
    case 'detailed':
      summary = `${translationPrefix}${title}: Overview and Key Aspects
      
This webpage provides a comprehensive overview of ${title.toLowerCase()}. The content explores various aspects of the topic, including key concepts, practical applications, and related information. The page appears to be designed for readers seeking to understand more about this subject area.`;
      break;
    
    case 'key-points':
      summary = `${translationPrefix}Key Points About ${title}
      
• The webpage covers essential information about ${title.toLowerCase()}
• It contains detailed explanations of core concepts
• It provides practical examples and applications
• It appears to be aimed at both beginners and those with some knowledge of the topic`;
      break;
    
    default:
      summary = `${translationPrefix}Summary of "${title}": This webpage provides information about the topic, covering key aspects and details that would be relevant to someone interested in the subject.`;
  }
  
  console.log("Mock summary generated:", summary.substring(0, 50) + "...");
  
  // Return the summary
  return summary;
}