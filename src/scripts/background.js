// Background.js - Handles API calls and background processes

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Default configuration
let CONFIG = {
  API_MODE: 'openai',  // Default API mode
  MAX_TOKENS: 500,
  TEMPERATURE: 0.5
};

// Maximum size for a single text chunk (in characters)
const MAX_CHUNK_SIZE = 3500;
// Maximum number of chunks to process (to avoid excessive API calls)
const MAX_CHUNKS = 5;

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
      'lmstudioModel',
      'ollamaApiUrl',
      'ollamaModel'
    ], async (result) => {
      // Determine which API to use
      const apiMode = result.apiMode || CONFIG.API_MODE;
      console.log("Using API mode:", apiMode);
      
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
          const lmStudioModel = result.lmstudioModel || '';
          
          if (!lmStudioUrl) {
            sendResponse({ 
              error: 'No LM Studio server URL found. Please check your settings.'
            });
            return;
          }
          
          console.log("Using LM Studio API at:", lmStudioUrl, "with model:", lmStudioModel);
          summary = await generateLMStudioSummary(
            request.text, 
            request.format, 
            lmStudioUrl,
            lmStudioKey,
            request.translateToEnglish,
            lmStudioModel
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
  try {
    // Check if we need to use chunking (if the text is larger than our maximum chunk size)
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callOpenAIAPI(chunk, chunkFormat, apiKey, model, isTranslate);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callOpenAIAPI(text, format, apiKey, model, translateToEnglish);
    }
  } catch (error) {
    console.error('Error in OpenAI summarization:', error);
    throw new Error('Failed to generate summary with OpenAI. Please check your API key and try again.');
  }
}

/**
 * Makes the actual API call to OpenAI
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiKey - The OpenAI API key
 * @param {string} model - The model to use
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {Promise<string>} The generated summary
 */
async function callOpenAIAPI(text, format, apiKey, model, translateToEnglish = false) {
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
    throw error;
  }
}

/**
 * Generates a summary using the LM Studio API
 * @param {string} text - The text to summarize
 * @param {string} format - The format of the summary (short, detailed, key-points)
 * @param {string} apiUrl - The LM Studio API URL
 * @param {string} apiKey - The LM Studio API key (optional)
 * @param {boolean} translateToEnglish - Whether to translate the text to English
 * @param {string} model - The model to use (optional)
 * @returns {Promise<string>} The generated summary
 */
async function generateLMStudioSummary(text, format, apiUrl, apiKey = '', translateToEnglish = false, model = '') {
  try {
    // Check if we need to use chunking
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callLMStudioAPI(chunk, chunkFormat, apiUrl, apiKey, isTranslate, model);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callLMStudioAPI(text, format, apiUrl, apiKey, translateToEnglish, model);
    }
  } catch (error) {
    console.error('Error in LM Studio summarization:', error);
    throw new Error(`Failed to connect to LM Studio server at ${apiUrl}. Please check that LM Studio is running and your settings are correct.`);
  }
}

/**
 * Makes the actual API call to LM Studio
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiUrl - The LM Studio API URL
 * @param {string} apiKey - The API key (optional)
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @param {string} model - The model to use (optional)
 * @returns {Promise<string>} The generated summary
 */
async function callLMStudioAPI(text, format, apiUrl, apiKey = '', translateToEnglish = false, model = '') {
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
    
    // Prepare request body
    const requestBody = {
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
    };
    
    // Add model if provided
    if (model) {
      requestBody.model = model;
    }
    
    // Make the API call to LM Studio
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
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
    throw error;
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
  try {
    // Check if we need to use chunking
    if (text.length > MAX_CHUNK_SIZE) {
      return await processLargeText(
        text, 
        format, 
        translateToEnglish,
        async (chunk, chunkFormat, isTranslate) => {
          return await callOllamaAPI(chunk, chunkFormat, apiUrl, model, isTranslate);
        }
      );
    } else {
      // For smaller texts, just process in one go
      return await callOllamaAPI(text, format, apiUrl, model, translateToEnglish);
    }
  } catch (error) {
    console.error('Error in Ollama summarization:', error);
    throw new Error(`Failed to connect to Ollama server at ${apiUrl}. Please ensure Ollama is running, the model is loaded, and CORS is properly configured.`);
  }
}

/**
 * Makes the actual API call to Ollama
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {string} apiUrl - The Ollama API URL
 * @param {string} model - The model to use
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {Promise<string>} The generated summary
 */
async function callOllamaAPI(text, format, apiUrl, model, translateToEnglish = false) {
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
    throw error;
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
    throw error;
  }
}

/**
 * Process large text by splitting it into chunks, summarizing each chunk,
 * and then creating a final summary of all the chunk summaries.
 * @param {string} text - The full text to summarize
 * @param {string} format - The desired summary format
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @param {Function} apiCallFn - Function to call the specific API for summarization
 * @returns {Promise<string>} The final summary
 */
async function processLargeText(text, format, translateToEnglish, apiCallFn) {
  try {
    console.log(`Processing large text of length: ${text.length}`);
    
    // Split the text into chunks
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_SIZE);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Limit to maximum number of chunks to avoid excessive API calls
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS);
    if (chunks.length > MAX_CHUNKS) {
      console.log(`Only processing first ${MAX_CHUNKS} chunks due to size constraints`);
    }
    
    // Use 'detailed' format for individual chunks to preserve more information
    const chunkFormat = 'detailed';
    
    // Process each chunk and collect summaries
    const chunkSummaries = [];
    for (let i = 0; i < chunksToProcess.length; i++) {
      console.log(`Processing chunk ${i+1} of ${chunksToProcess.length}`);
      const chunk = chunksToProcess[i];
      
      // Add chunk number information to help with context
      const chunkWithContext = `[PART ${i+1} OF ${chunksToProcess.length}]\n\n${chunk}`;
      
      // Get summary for this chunk
      let chunkSummary = await apiCallFn(chunkWithContext, chunkFormat, translateToEnglish);
      
      // Remove translation prefix if present (we'll add it back to the final summary)
      chunkSummary = chunkSummary.replace("[Translated to English] ", "");
      
      chunkSummaries.push(chunkSummary);
    }
    
    // If we only have one chunk, return it directly
    if (chunkSummaries.length === 1) {
      return translateToEnglish ? 
        "[Translated to English] " + chunkSummaries[0] : 
        chunkSummaries[0];
    }
    
    // Combine chunk summaries
    const combinedText = chunkSummaries.join("\n\n");
    
    // Generate final summary from the combined chunk summaries
    console.log("Generating final summary from combined chunk summaries");
    const finalPrompt = createFinalSummaryPrompt(combinedText, format, chunks.length);
    
    // Use a simpler system message for the final summarization
    const finalSummary = await apiCallFn(finalPrompt, format, false);
    
    // Add translation prefix if the original request was for translation
    return translateToEnglish ? 
      "[Translated to English] " + finalSummary : 
      finalSummary;
    
  } catch (error) {
    console.error("Error processing large text:", error);
    throw error;
  }
}

/**
 * Splits text into manageable chunks, trying to preserve paragraphs
 * @param {string} text - The text to split
 * @param {number} maxChunkSize - Maximum size for each chunk
 * @returns {Array<string>} Array of text chunks
 */
function splitTextIntoChunks(text, maxChunkSize) {
  // Split by paragraphs first (double newlines)
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the chunk size
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      // Store the current chunk and start a new one
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      // Add to the current chunk
      if (currentChunk.length > 0) {
        currentChunk += "\n\n";
      }
      currentChunk += paragraph;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  // Handle the case where a single paragraph is larger than maxChunkSize
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      finalChunks.push(chunk);
    } else {
      // Split by sentences for very large paragraphs
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
      let sentenceChunk = "";
      
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length > maxChunkSize && sentenceChunk.length > 0) {
          finalChunks.push(sentenceChunk);
          sentenceChunk = sentence;
        } else {
          sentenceChunk += sentence;
        }
      }
      
      if (sentenceChunk.length > 0) {
        finalChunks.push(sentenceChunk);
      }
    }
  }
  
  return finalChunks;
}

/**
 * Creates a prompt for the final summarization of multiple chunk summaries
 * @param {string} combinedSummaries - The combined summaries from all chunks
 * @param {string} format - The desired format for the final summary
 * @param {number} totalChunks - The total number of chunks processed
 * @returns {string} The formatted prompt
 */
function createFinalSummaryPrompt(combinedSummaries, format, totalChunks) {
  return `The following text contains a series of summaries from different sections of a long webpage.
Your task is to create a coherent final summary that captures the key information from ALL sections.
Make sure to include key information from each section in your final summary.

${combinedSummaries}

Please provide a ${format} summary that covers all the important points from all sections.`;
}

/**
 * Creates an optimized prompt for the summary based on format and translation preference
 * @param {string} text - The text to summarize
 * @param {string} format - The summary format
 * @param {boolean} translateToEnglish - Whether to translate to English
 * @returns {string} The formatted prompt
 */
function createPrompt(text, format, translateToEnglish = false) {
  // Add translation instruction if needed
  const translationPrefix = translateToEnglish ? "Translate the following content to English and then " : "";
  
  let prompt;
  
  switch (format) {
    case 'short':
      prompt = `${translationPrefix}You must create an EXTREMELY concise summary (maximum 2-3 sentences, no more) of the following text. 
Focus only on the most essential information. Your response must be very brief.
Do not include any explanations or additional details beyond the core message.
First provide a very short title (3-5 words only), then a tiny summary paragraph:\n\n${text}`;
      break;
      
    case 'detailed':
      prompt = `${translationPrefix}Please provide a detailed yet focused summary (1-2 paragraphs) of the following text.
Cover the main points and key information.
Structure your response with:
1. A clear, descriptive title (one line)
2. Well-organized paragraphs with proper line breaks between them
3. Ensure the most important information is prioritized\n\n${text}`;
      break;
      
    case 'key-points':
      prompt = `${translationPrefix}Extract exactly 3-5 of the most important key points from the following text.
Format your response as:
1. A brief title (one line only)
2. A bullet list where each key point:
   - Starts with a bullet point (•)
   - Is concise (preferably one sentence)
   - Captures a distinct important idea
   - Is directly relevant to the main topic\n\n${text}`;
      break;
      
    default:
      prompt = `${translationPrefix}Please summarize the following text with a clear structure.
Use paragraph breaks to separate main ideas.
Highlight the most important aspects while maintaining reasonable brevity:\n\n${text}`;
  }
  
  return prompt;
}