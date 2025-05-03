/**
 * background.js - Handles API calls and background processes for the Sparrow extension
 * 
 * This script manages:
 * - API communication with various LLM providers (OpenAI, LM Studio, Ollama, OpenRouter)
 * - Text summarization processing
 * - Chat functionality
 * - Side panel operations
 */

// ==========================================================================================
// CONSTANTS AND CONFIGURATION
// ==========================================================================================

const CONFIG = {
  API_MODE: 'openai',   // Default API mode
  MAX_TOKENS: 500,      // Maximum tokens in response
  TEMPERATURE: 0.5,     // Creativity level (higher = more creative)
  MAX_CHUNK_SIZE: 3500, // Maximum size for a single text chunk (in characters)
  MAX_CHUNKS: 5,        // Maximum number of chunks to process
  API_ENDPOINTS: {
    OPENAI: 'https://api.openai.com/v1/chat/completions',
    OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions'
  }
};

// ==========================================================================================
// ENCRYPTION UTILITIES
// ==========================================================================================

const encryptionUtils = {
  getEncryptionKey() {
    return chrome.runtime.id + "-sparrow-secure-key";
  },
  
  encrypt(text) {
    if (!text) return '';
    const key = this.getEncryptionKey();
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  },
  
  decrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
      const key = this.getEncryptionKey();
      const text = atob(encryptedText);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch (e) {
      console.error('Decryption failed', e);
      return '';
    }
  }
};

// ==========================================================================================
// KEY MANAGEMENT
// ==========================================================================================

const secureKeyStore = {
  keys: {},
  
  storeKey(service, key) {
    if (!key) return false;
    
    this.keys[service] = key;
    
    const encryptedKey = encryptionUtils.encrypt(key);
    const storageKey = `encrypted_${service}_key`;
    const storageObj = {};
    storageObj[storageKey] = encryptedKey;
    
    chrome.storage.local.set(storageObj);
    return true;
  },
  
  async getKey(service) {
    if (this.keys[service]) {
      return this.keys[service];
    }
    
    // Return a promise that resolves with the key
    return new Promise((resolve) => {
      const storageKey = `encrypted_${service}_key`;
      chrome.storage.local.get([storageKey], (result) => {
        if (result[storageKey]) {
          const decryptedKey = encryptionUtils.decrypt(result[storageKey]);
          this.keys[service] = decryptedKey;
          resolve(decryptedKey);
        } else {
          resolve(null);
        }
      });
    });
  },
  
  async hasKey(service) {
    const key = await this.getKey(service);
    return !!key;
  },
  
  initialize() {
    ['openai', 'openrouter', 'lmstudio', 'ollama'].forEach(service => {
      this.getKey(service); // Pre-load keys
    });
  }
};

// Initialize key store on load
secureKeyStore.initialize();

// ==========================================================================================
// MODEL DISPLAY UTILITIES
// ==========================================================================================

const modelUtils = {
  getDisplayInfo(apiMode, modelName) {
    const statusClasses = {
      'lmstudio': 'indicator-lmstudio',
      'ollama': 'indicator-ollama',
      'openrouter': 'indicator-openrouter',
      'openai': 'indicator-openai'
    };
    
    return {
      class: statusClasses[apiMode] || 'indicator-openai',
      name: this.truncateName(modelName)
    };
  },
  
  truncateName(modelName) {
    if (!modelName) return '';
    
    if (modelName.includes('/')) {
      modelName = modelName.split('/').pop();
    }
    
    return modelName.length > 15 ? modelName.substring(0, 12) + '...' : modelName;
  }
};

// ==========================================================================================
// TEXT PROCESSING UTILITIES
// ==========================================================================================

const textUtils = {
  splitIntoChunks(text, maxChunkSize) {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = "";
    
    // First pass: combine paragraphs into chunks
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        if (currentChunk.length > 0) {
          currentChunk += "\n\n";
        }
        currentChunk += paragraph;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // Second pass: handle large paragraphs
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length <= maxChunkSize) {
        finalChunks.push(chunk);
      } else {
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
  },

  createPrompt(text, format, translateToEnglish = false) {
    const translationPrefix = translateToEnglish 
      ? "Translate the following content to English, then " 
      : "Summarize in the SAME LANGUAGE as the original content. DO NOT translate. ";
    
    const promptTemplates = {
      'short': `${translationPrefix}Create an EXTREMELY concise summary of the following text.
REQUIREMENTS:
- Maximum 1-2 sentences total (35-50 words maximum)
- No title or headings
- Focus only on the absolute core message or main point
- Omit all secondary details and examples
- Use simple, direct language
- Do not use bullet points

Your response must be dramatically shorter than the original text and extremely brief:`,

      'detailed': `${translationPrefix}Provide a comprehensive, well-structured summary of the following text.
REQUIREMENTS:
- Begin with a clear, descriptive title (5-7 words)
- Write 2-3 substantial paragraphs (150-200 words total)
- Include main arguments, key evidence, and important conclusions
- Maintain logical flow between paragraphs
- Use proper transitions between ideas
- Ensure all major sections of the original content are represented
- End with the most significant conclusion or implication

Your summary should be thorough while still condensing the original content:`,

      'key-points': `${translationPrefix}Extract exactly 4-6 of the most important key points from the following text.
REQUIREMENTS:
- Begin with a brief, descriptive title (3-6 words)
- Format as a bullet list with each point:
  • Starting with a bullet point (•)
  • Written as a complete sentence
  • Containing one specific, concrete idea
  • Including relevant statistics or evidence where available
  • Ordered by importance (most critical points first)
  • Using bold for any critical terms or figures

Ensure each point captures a distinct and essential idea from the text:`,

      'default': `${translationPrefix}Please summarize the following text with a clear structure.
Use paragraph breaks to separate main ideas.
Highlight the most important aspects while maintaining reasonable brevity:`
    };
    
    return `${promptTemplates[format] || promptTemplates.default}\n\n${text}`;
  },
  
  createFinalSummaryPrompt(combinedSummaries, format) {
    return `The following text contains a series of summaries from different sections of a long webpage.
Your task is to create a coherent final summary that captures the key information from ALL sections.
Make sure to include key information from each section in your final summary.

${combinedSummaries}

Please provide a ${format} summary that covers all the important points from all sections.`;
  },
  
  formatForChatPanel(text) {
    if (!text) return '';
    
    let formatted = text;
    // Ensure code blocks have proper spacing
    formatted = formatted.replace(/```(\w*)\n/g, '```$1\n');
    // Format lists properly for markdown
    formatted = formatted.replace(/^([\*\-])/gm, '\n$1');
    // Standardize bullet points
    formatted = formatted.replace(/^[•]\s*(.*)/gm, '* $1');
    // Format ordered lists
    formatted = formatted.replace(/^(\d+)\.\s*/gm, '$1. ');
    // Add spacing around headings
    formatted = formatted.replace(/^(#{1,6}\s.*)/gm, '\n$1\n');
    // Format blockquotes
    formatted = formatted.replace(/^>\s*/gm, '> ');
    
    return formatted;
  }
};

// ==========================================================================================
// API REQUEST HANDLING
// ==========================================================================================

const apiHandler = {
  async makeRequest(endpoint, headers, body) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },
  
  prepareHeaders(apiMode, apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Add special headers for OpenRouter
    if (apiMode === 'openrouter') {
      headers['HTTP-Referer'] = 'https://github.com/arashmok/sparrow';
      headers['X-Title'] = 'Sparrow Extension';
    }
    
    return headers;
  },
  
  getApiKey(apiMode, providedKey) {
    return providedKey || secureKeyStore.getKey(apiMode);
  }
};

// ==========================================================================================
// OLLAMA PROXY UTILITY
// ==========================================================================================

async function proxyOllamaRequest(apiUrl, endpoint, method, body) {
  const url = `${apiUrl}${endpoint}`;
  console.log(`Making Ollama request to: ${url}`);
  
  try {
    // Create a direct XMLHttpRequest from extension context
    const response = await fetch(url, {
      method: method,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.error("CORS error detected when connecting to Ollama");
        throw new Error('CORS Configuration Error: Ollama requires additional configuration to work with browser extensions.');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error("Ollama proxy error:", error.message);
    
    // Enhance error messages based on common error patterns
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') || 
        error.message.includes('Network request failed')) {
      throw new Error('Connection Error: Unable to connect to Ollama server. Make sure Ollama is running.');
    }
    
    // If error contains 403, CORS, or origin keywords, provide helpful message
    if (error.message.includes('403') || 
        error.message.includes('Forbidden') || 
        error.message.includes('CORS') || 
        error.message.includes('origin')) {
      throw new Error('CORS Configuration Error: Ollama requires CORS configuration. Run with: OLLAMA_ORIGINS="*" ollama serve');
    }
    
    throw error;
  }
}

// ==========================================================================================
// API PROVIDERS
// ==========================================================================================

const apiProviders = {
  async openai(messages, model, apiKey) {
    const key = apiKey || await secureKeyStore.getKey('openai');
    if (!key) throw new Error('No OpenAI API key found');
    
    const headers = apiHandler.prepareHeaders('openai', key);
    const body = {
      model: model || 'gpt-3.5-turbo',
      messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE
    };
    
    const data = await apiHandler.makeRequest(CONFIG.API_ENDPOINTS.OPENAI, headers, body);
    return data.choices[0].message.content.trim();
  },
  
  async lmstudio(messages, apiUrl, apiKey, model) {
    const key = apiKey || await secureKeyStore.getKey('lmstudio');
    const endpoint = `${apiUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers = apiHandler.prepareHeaders('lmstudio', key);
    
    const body = {
      messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE
    };
    
    if (model && model.trim()) {
      body.model = model;
    }
    
    try {
      const data = await apiHandler.makeRequest(endpoint, headers, body);
      return data.choices[0].message.content.trim();
    } catch (error) {
      // Attempt fallback for older versions
      if (error.message.includes("Status: 400") || error.message.includes("Status: 404")) {
        return this.lmstudioFallback(messages, apiUrl, key, model);
      }
      throw error;
    }
  },
  
  async lmstudioFallback(messages, apiUrl, apiKey, model) {
    // Use the same key passed from lmstudio method
    const key = apiKey;
    
    // Create a concatenated prompt from messages
    let conversationText = '';
    
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || 
      'You are a helpful AI assistant.';
    
    conversationText = systemMessage + "\n\n";
    
    // Add conversation history
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    nonSystemMessages.forEach(msg => {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      conversationText += `${role}: ${msg.content}\n\n`;
    });
    
    // Add Assistant: to prompt completion
    conversationText += "Assistant:";
    
    const endpoint = `${apiUrl.replace(/\/+$/, '')}/completions`;
    const headers = apiHandler.prepareHeaders('lmstudio', key);
    
    const body = {
      prompt: conversationText,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE,
      stream: false
    };
    
    if (model && model.trim()) {
      body.model = model;
    }
    
    const data = await apiHandler.makeRequest(endpoint, headers, body);
    return data.choices[0].text.trim();
  },
  
  async ollama(messages, apiUrl, model) {
    try {
      const body = {
        model: model,
        messages,
        options: { temperature: CONFIG.TEMPERATURE },
        stream: false
      };
      
      // Use our proxy function to make the request
      const data = await proxyOllamaRequest(
        apiUrl.replace(/\/+$/, ''), 
        '/chat', 
        'POST', 
        body
      );
      
      if (data.message?.content) {
        return data.message.content.trim();
      } else if (data.response) {
        return data.response.trim();
      }
      throw new Error('Unexpected response format from Ollama API');
    } catch (error) {
      console.error("Ollama error:", error.message);
      
      // Forward the enhanced error message
      if (error.message.includes('CORS Configuration Error')) {
        throw error;
      }
      
      // For other connection errors, provide clear guidance
      if (error.message.includes('Network error') || 
          error.message.includes('Failed to fetch') ||
          error.message.includes('connect')) {
        throw new Error(
          `Could not connect to Ollama server at ${apiUrl}. ` +
          `Please check that Ollama is running and accessible.`
        );
      }
      
      // Try fallback for other types of errors
      try {
        return await this.ollamaFallback(messages, apiUrl, model);
      } catch (fallbackError) {
        // If fallback also fails, throw the original error
        throw error;
      }
    }
  },
  
  async ollamaFallback(messages, apiUrl, model) {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    
    // Get last user message
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    const fullPrompt = `${systemMessage}\n\n${userMessage}`;
    const endpoint = `${apiUrl.replace(/\/+$/, '')}/generate`;
    
    const body = {
      model: model,
      prompt: fullPrompt,
      options: { temperature: CONFIG.TEMPERATURE },
      stream: false
    };
    
    const data = await apiHandler.makeRequest(endpoint, { 'Content-Type': 'application/json' }, body);
    
    if (data.response) {
      return data.response.trim();
    }
    throw new Error('Unexpected response format from Ollama API');
  },
  
  async openrouter(messages, model, apiKey) {
    const key = apiKey || await secureKeyStore.getKey('openrouter');
    if (!key) throw new Error('No OpenRouter API key found');
    
    const headers = apiHandler.prepareHeaders('openrouter', key);
    const body = {
      model: model || 'gpt-3.5-turbo',
      messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE
    };
    
    const data = await apiHandler.makeRequest(CONFIG.API_ENDPOINTS.OPENROUTER, headers, body);
    return data.choices[0].message.content.trim();
  }
};

// ==========================================================================================
// SUMMARIZATION SERVICES
// ==========================================================================================

const summarizationService = {
  async generateSummary(text, format, apiMode, settings, translateToEnglish) {
    try {
      // Use async key retrieval for required API keys
      if (apiMode === 'openai') {
        const key = settings.apiKey || await secureKeyStore.getKey('openai');
        if (!key) {
          throw new Error('OpenAI API key is required. Please add your API key in the settings.');
        }
        settings.apiKey = key; // Ensure the key is available for the API call
      }
      
      if (apiMode === 'openrouter') {
        const key = settings.openrouterApiKey || await secureKeyStore.getKey('openrouter');
        if (!key) {
          throw new Error('OpenRouter API key is required. Please add your API key in the settings.');
        }
        settings.openrouterApiKey = key; // Ensure the key is available for the API call
      }
      
      // LM Studio may use a key if provided
      if (apiMode === 'lmstudio' && !settings.lmstudioApiKey) {
        settings.lmstudioApiKey = await secureKeyStore.getKey('lmstudio') || '';
      }
      
      switch (apiMode) {
        case 'openai':
          return await this.generateOpenAISummary(
            text, format, settings.apiKey, settings.openaiModel || 'gpt-3.5-turbo', translateToEnglish
          );
          
        case 'lmstudio':
          return await this.generateLMStudioSummary(
            text, format, settings.lmstudioApiUrl || 'http://localhost:1234/v1', 
            settings.lmstudioApiKey, translateToEnglish, settings.lmstudioModel || ''
          );
          
        case 'ollama':
          return await this.generateOllamaSummary(
            text, format, settings.ollamaApiUrl || 'http://localhost:11434/api',
            settings.ollamaModel || 'llama2', translateToEnglish
          );
          
        case 'openrouter':
          return await this.generateOpenRouterSummary(
            text, format, settings.openrouterApiKey, 
            settings.openrouterModel || 'gpt-3.5-turbo', translateToEnglish
          );
          
        default:
          throw new Error(`Unknown API mode: ${apiMode}`);
      }
    } catch (error) {
      console.error(`Error generating summary using ${apiMode}:`, error);
      throw error;
    }
  },
  
  async processLargeText(text, format, translateToEnglish, apiCallFn) {
    console.log(`Processing large text of length: ${text.length}`);
    
    // Split the text into chunks
    const chunks = textUtils.splitIntoChunks(text, CONFIG.MAX_CHUNK_SIZE);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Limit chunks to avoid excessive API calls
    const chunksToProcess = chunks.slice(0, CONFIG.MAX_CHUNKS);
    if (chunks.length > CONFIG.MAX_CHUNKS) {
      console.log(`Only processing first ${CONFIG.MAX_CHUNKS} chunks due to size constraints`);
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
    const finalPrompt = textUtils.createFinalSummaryPrompt(combinedText, format);
    
    // Use a simpler system message for the final summarization
    const finalSummary = await apiCallFn(finalPrompt, format, false);
    
    // Add translation prefix if the original request was for translation
    return translateToEnglish ? 
      "[Translated to English] " + finalSummary : 
      finalSummary;
  },
  
  async generateOpenAISummary(text, format, apiKey, model, translateToEnglish) {
    try {
      if (text.length > CONFIG.MAX_CHUNK_SIZE) {
        return this.processLargeText(
          text, format, translateToEnglish,
          async (chunk, chunkFormat, isTranslate) => {
            return await this.callOpenAIAPI(chunk, chunkFormat, apiKey, model, isTranslate);
          }
        );
      } else {
        return await this.callOpenAIAPI(text, format, apiKey, model, translateToEnglish);
      }
    } catch (error) {
      throw new Error('Failed to generate summary with OpenAI: ' + error.message);
    }
  },
  
  async callOpenAIAPI(text, format, apiKey, model, translateToEnglish) {
    const prompt = textUtils.createPrompt(text, format, translateToEnglish);
    const messages = [
      { 
        role: 'system', 
        content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. IMPORTANT: Unless explicitly asked to translate, ALWAYS maintain the same language as the original content. Be as concise as possible while capturing the essential meaning.' 
      },
      { role: 'user', content: prompt }
    ];
    
    const summary = await apiProviders.openai(messages, model, apiKey);
    return translateToEnglish ? "[Translated to English] " + summary : summary;
  },
  
  async generateLMStudioSummary(text, format, apiUrl, apiKey, translateToEnglish, model) {
    try {
      if (text.length > CONFIG.MAX_CHUNK_SIZE) {
        return this.processLargeText(
          text, format, translateToEnglish,
          async (chunk, chunkFormat, isTranslate) => {
            return await this.callLMStudioAPI(chunk, chunkFormat, apiUrl, apiKey, isTranslate, model);
          }
        );
      } else {
        return await this.callLMStudioAPI(text, format, apiUrl, apiKey, translateToEnglish, model);
      }
    } catch (error) {
      throw new Error(`Failed to connect to LM Studio server at ${apiUrl}: ${error.message}`);
    }
  },
  
  async callLMStudioAPI(text, format, apiUrl, apiKey, translateToEnglish, model) {
    const prompt = textUtils.createPrompt(text, format, translateToEnglish);
    const messages = [
      { 
        role: 'system', 
        content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
      },
      { role: 'user', content: prompt }
    ];
    
    const summary = await apiProviders.lmstudio(messages, apiUrl, apiKey, model);
    return translateToEnglish ? "[Translated to English] " + summary : summary;
  },
  
  async generateOllamaSummary(text, format, apiUrl, model, translateToEnglish) {
    try {
      if (text.length > CONFIG.MAX_CHUNK_SIZE) {
        return this.processLargeText(
          text, format, translateToEnglish,
          async (chunk, chunkFormat, isTranslate) => {
            return await this.callOllamaAPI(chunk, chunkFormat, apiUrl, model, isTranslate);
          }
        );
      } else {
        return await this.callOllamaAPI(text, format, apiUrl, model, translateToEnglish);
      }
    } catch (error) {
      throw new Error(`Failed to connect to Ollama server at ${apiUrl}: ${error.message}`);
    }
  },
  
  async callOllamaAPI(text, format, apiUrl, model, translateToEnglish) {
    const prompt = textUtils.createPrompt(text, format, translateToEnglish);
    const messages = [
      { 
        role: 'system', 
        content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. Be as concise as possible while capturing the essential meaning. Never apologize or include meta-commentary about the summary process.' 
      },
      { role: 'user', content: prompt }
    ];
    
    const summary = await apiProviders.ollama(messages, apiUrl, model);
    return translateToEnglish ? "[Translated to English] " + summary : summary;
  },
  
  async generateOpenRouterSummary(text, format, apiKey, model, translateToEnglish) {
    try {
      if (text.length > CONFIG.MAX_CHUNK_SIZE) {
        return this.processLargeText(
          text, format, translateToEnglish,
          async (chunk, chunkFormat, isTranslate) => {
            return await this.callOpenRouterAPI(chunk, chunkFormat, apiKey, model, isTranslate);
          }
        );
      } else {
        return await this.callOpenRouterAPI(text, format, apiKey, model, translateToEnglish);
      }
    } catch (error) {
      throw new Error('Failed to generate summary with OpenRouter: ' + error.message);
    }
  },
  
  async callOpenRouterAPI(text, format, apiKey, model, translateToEnglish) {
    const prompt = textUtils.createPrompt(text, format, translateToEnglish);
    const messages = [
      { 
        role: 'system', 
        content: 'You are a highly efficient summarization assistant that creates clear, concise summaries of web content. Follow the requested format precisely. IMPORTANT: Unless explicitly asked to translate, ALWAYS maintain the same language as the original content. Be as concise as possible while capturing the essential meaning.' 
      },
      { role: 'user', content: prompt }
    ];
    
    const summary = await apiProviders.openrouter(messages, model, apiKey);
    return translateToEnglish ? "[Translated to English] " + summary : summary;
  }
};

// ==========================================================================================
// MODEL FETCHING UTILITIES
// ==========================================================================================

const modelFetchingService = {
  async fetchOpenAIModels(apiKey) {
    try {
      // Use existing API key if available, or use the one provided
      const key = apiHandler.getApiKey('openai', apiKey);
      if (!key) throw new Error('No OpenAI API key found');
      
      const headers = apiHandler.prepareHeaders('openai', key);
      const modelsUrl = 'https://api.openai.com/v1/models';
      
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter to relevant chat completion models
      const relevantModels = data.data.filter(model => 
        (model.id.includes('gpt-') && !model.id.includes('-instruct')) ||
        model.id.includes('claude')
      ).map(model => ({
        id: model.id,
        name: formatModelName(model.id)
      }));
      
      // Sort models by priority and name
      return sortModelsByPriority(relevantModels);
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      throw error;
    }
  }
};

// Format model name for display
function formatModelName(modelId) {
  // Specific naming overrides
  if (modelId === 'gpt-3.5-turbo') return 'GPT-3.5 Turbo';
  if (modelId === 'gpt-4-turbo') return 'GPT-4 Turbo';
  if (modelId === 'gpt-4o') return 'GPT-4o';
  
  // General formatting
  return modelId
    .replace('gpt-', 'GPT ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Sort models by priority
function sortModelsByPriority(models) {
  // Define priority models in order of importance
  const priorityModels = [
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ];
  
  // Sort function that prioritizes specific models and then alphabetizes the rest
  return models.sort((a, b) => {
    const priorityA = priorityModels.indexOf(a.id);
    const priorityB = priorityModels.indexOf(b.id);
    
    // If both models are in the priority list, sort by priority
    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    
    // If only one model is in the priority list, it comes first
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;
    
    // Otherwise sort alphabetically
    return a.id.localeCompare(b.id);
  });
}


// ==========================================================================================
// CHAT SERVICE
// ==========================================================================================

const chatService = {
  async handleMessage(userMessage, history, settings) {
    try {
      const apiMode = settings.apiMode || 'openai';
      console.log("Using API mode for chat:", apiMode);
      
      // Prepare messages
      let messages = [{
        role: 'system',
        content: 'You are Sparrow, an AI assistant integrated with a Chrome extension. You help users understand and interact with web content. Be concise, helpful, and conversational.'
      }];
      
      // Add history if available
      if (history && history.length > 0) {
        messages = messages.concat(history);
      }
      
      // Add current user message if not in history
      if (!history || !history.some(msg => msg.role === 'user' && msg.content === userMessage)) {
        messages.push({
          role: 'user',
          content: userMessage
        });
      }
      
      // Generate response based on API mode
      let reply;
      
      switch (apiMode) {
        case 'openai':
          reply = await apiProviders.openai(
            messages, 
            settings.openaiModel || 'gpt-3.5-turbo', 
            settings.apiKey
          );
          break;
          
        case 'lmstudio':
          reply = await apiProviders.lmstudio(
            messages,
            settings.lmstudioApiUrl || 'http://localhost:1234/v1',
            settings.lmstudioApiKey || '',
            settings.lmstudioModel || ''
          );
          break;
          
        case 'ollama':
          reply = await apiProviders.ollama(
            messages,
            settings.ollamaApiUrl || 'http://localhost:11434/api',
            settings.ollamaModel || 'llama2'
          );
          break;
          
        case 'openrouter':
          reply = await apiProviders.openrouter(
            messages,
            settings.openrouterModel || 'gpt-3.5-turbo',
            settings.openrouterApiKey
          );
          break;
          
        default:
          throw new Error(`Unknown API mode: ${apiMode}`);
      }
      
      // Format the response for display
      return textUtils.formatForChatPanel(reply);
    } catch (error) {
      console.error('Error handling chat message:', error);
      throw error;
    }
  }
};

// ==========================================================================================
// PAGE CONTENT EXTRACTION
// ==========================================================================================

function findParentOfType(element, selectors) {
  let parent = element.parentElement;
  while (parent) {
    for (const selector of selectors) {
      if (parent.matches(selector)) {
        return parent;
      }
    }
    parent = parent.parentElement;
  }
  return null;
}

function extractPageContent() {
  try {
    // Get page metadata
    const pageTitle = document.title || '';
    const pageUrl = window.location.href;
    
    // Try to find the main content container using common selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.main-content',
      '#main-content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content'
    ];
    
    let contentElement = null;
    
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        contentElement = Array.from(elements).reduce((largest, current) => {
          return (current.textContent.length > largest.textContent.length) ? current : largest;
        }, elements[0]);
        
        if (contentElement.textContent.length > 500) {
          break;
        }
      }
    }
    
    let mainContent = '';
    
    if (contentElement && contentElement.textContent.trim().length > 0) {
      mainContent = contentElement.textContent;
    } else {
      const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      
      const contentElements = Array.from(paragraphs).filter(element => {
        if (element.textContent.trim().length < 20 && !element.tagName.startsWith('H')) {
          return false;
        }
        
        const parent = findParentOfType(element, [
          'nav', 'footer', 'aside', 
          '[role="navigation"]', '[role="complementary"]',
          '.nav', '.navigation', '.menu', '.footer', '.sidebar', '.widget', '.comment'
        ]);
        
        return !parent;
      });
      
      mainContent = contentElements.map(el => el.textContent.trim()).join('\n\n');
    }
    
    if (mainContent.length < 500) {
      const bodyClone = document.body.cloneNode(true);
      const scripts = bodyClone.querySelectorAll('script, style, noscript, svg, canvas, iframe');
      scripts.forEach(script => script.remove());
      
      mainContent = bodyClone.textContent.trim();
    }
    
    return `Title: ${pageTitle}\nURL: ${pageUrl}\n\n${mainContent}`;
    
  } catch (error) {
    console.error('Error extracting page content:', error);
    return `Error extracting content: ${error.message}`;
  }
}

// ==========================================================================================
// MESSAGE HANDLERS
// ==========================================================================================

// Single consolidated message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Log all incoming messages for debugging
  console.log("Received message:", request.action);
  
  switch (request.action) {
    case 'open-chat-panel':
      console.log("Opening chat panel with settings:", request);
      
      let urlParams = '';
      if (request.showSavedChats === true) {
        urlParams = '?showSaved=true';
        if (request.directAccess === true) {
          urlParams += '&directAccess=true';
        }
        console.log("Opening saved chats view with params:", urlParams);
      }
      
      if (request.sessionId) {
        urlParams += (urlParams ? '&' : '?') + 'session=' + request.sessionId;
      }
      
      if (request.generatedText) {
        chrome.storage.local.set({ latestSummary: request.generatedText });
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = request.tabId || (tabs[0] ? tabs[0].id : null);
        if (!tabId) {
          console.error("No tab ID available");
          sendResponse({ success: false, error: "No tab ID available" });
          return;
        }
        
        chrome.sidePanel.open({ tabId: tabId }).then(() => {
          chrome.sidePanel.setOptions({
            path: 'src/panel/chat-panel.html' + urlParams,
            enabled: true
          });
          
          sendResponse({ success: true });
        }).catch(error => {
          console.error("Error opening side panel:", error);
          sendResponse({ success: false, error: error.message });
        });
      });
      return true; // Keep message channel open
      
      case 'summarize':
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (!tabs[0]) {
            sendResponse({ error: "No active tab found" });
            return;
          }
          
          const activeTab = tabs[0];
          
          // Create a new task
          const taskId = TaskManager.createTask({
            url: activeTab.url,
            format: request.format,
            translateToEnglish: request.translateToEnglish,
            tabId: activeTab.id
          });
          
          // Send immediate response with taskId
          sendResponse({ taskId, status: 'started' });
          
          // Start the summarization process
          chrome.storage.local.get([
            'apiMode', 'apiKey', 'openaiModel', 'lmstudioApiUrl',
            'lmstudioApiKey', 'lmstudioModel', 'ollamaApiUrl',
            'ollamaModel', 'openrouterApiKey', 'openrouterModel'
          ], async (settings) => {
            try {
              const apiMode = settings.apiMode || 'openai';
              console.log("Using API mode:", apiMode);
              
              // Check API keys using async retrieval
              if (apiMode === 'openai') {
                const key = settings.apiKey || await secureKeyStore.getKey('openai');
                if (!key) throw new Error('No OpenAI API key found. Please check your settings.');
              } else if (apiMode === 'openrouter') {
                const key = settings.openrouterApiKey || await secureKeyStore.getKey('openrouter');
                if (!key) throw new Error('No OpenRouter API key found. Please check your settings.');
              }
              
              // Generate summary - use settings.apiMode instead of request.apiMode
              const summary = await summarizationService.generateSummary(
                request.text,
                request.format,
                apiMode,  // Use apiMode from settings, not request
                settings,
                request.translateToEnglish
              );
              
              // Update task with completion
              TaskManager.updateTask(taskId, {
                status: 'completed',
                summary: summary,
                completedTime: Date.now()
              });
              
              // Store the summary in local storage
              chrome.storage.local.set({
                latestSummary: summary,
                latestUrl: activeTab.url
              });
              
            } catch (error) {
              console.error('Error generating summary:', error);
              TaskManager.updateTask(taskId, {
                status: 'error',
                error: error.message
              });
            }
          });
        });
        return true; // Keep message channel open
      
    case 'chat-message':
      chrome.storage.local.get([
        'apiMode', 'apiKey', 'openaiModel',
        'lmstudioApiUrl', 'lmstudioApiKey', 'lmstudioModel',
        'ollamaApiUrl', 'ollamaModel',
        'openrouterApiKey', 'openrouterModel'
      ], async (settings) => {
        try {
          const reply = await chatService.handleMessage(request.text, request.history || [], settings);
          sendResponse({ reply });
        } catch (error) {
          sendResponse({ error: error.message });
        }
      });
      return true;
      
    case 'store-api-key':
      secureKeyStore.storeKey(request.service, request.key);
      sendResponse({ success: true });
      return true;
      
    case 'check-api-key':
      secureKeyStore.hasKey(request.service, (hasKey) => {
        sendResponse({ hasKey: hasKey });
      });
      return true;
      
    case 'fetch-openai-models':
      const apiKey = request.apiKey || secureKeyStore.getKey('openai');
      if (!apiKey) {
        sendResponse({ 
          error: 'API key not found', 
          models: getDefaultOpenAIModels() 
        });
        return true;
      }
      
      modelFetchingService.fetchOpenAIModels(apiKey)
        .then(models => {
          sendResponse({ models: models });
        })
        .catch(error => {
          console.error('Error fetching models:', error);
          sendResponse({ 
            error: error.message, 
            models: getDefaultOpenAIModels() 
          });
        });
      return true;
      
    case 'getTaskStatus':
      const task = TaskManager.getTaskByUrl(request.url);
      sendResponse({ task });
      return true;
      
    case 'update-saved-count':
      sendResponse({ success: true });
      return true;
      
    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
      return false;
  }
});

// Function to broadcast task updates to the popup
function broadcastTaskUpdate(taskId, task) {
  chrome.runtime.sendMessage({
    action: 'taskUpdate',
    taskId: taskId,
    status: task.status,
    summary: task.summary,
    format: task.format,
    error: task.error
  }).catch(() => {
    // Ignore errors when popup is not open
  });
}

// Add missing getDefaultOpenAIModels function if it doesn't exist
function getDefaultOpenAIModels() {
  return [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
  ];
}

// ==========================================================================================
// TASK MANAGER
// ==========================================================================================

// TaskManager handles the creation, updating, and management of tasks
const TaskManager = {
  // Store active tasks with their states
  activeTasks: new Map(),
  
  // Initialize and restore tasks from storage
  async initialize() {
    const { activeTasks } = await chrome.storage.local.get(['activeTasks']);
    if (activeTasks) {
      this.activeTasks = new Map(Object.entries(activeTasks));
    }
  },
  
  // Create a new task
  createTask(taskData) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      status: 'processing', // processing, completed, error, timeout
      url: taskData.url,
      format: taskData.format,
      translateToEnglish: taskData.translateToEnglish, // Fix: changed from request.translateToEnglish
      startTime: Date.now(),
      tabId: taskData.tabId,
      summary: null,
      error: null
    };
    
    this.activeTasks.set(taskId, task);
    this.saveToStorage();
    this.updateBadge('processing');
    
    return taskId;
  },
  
  // Update task status and details
  updateTask(taskId, updates) {
    const task = this.activeTasks.get(taskId);
    if (task) {
      Object.assign(task, updates);
      this.saveToStorage();
      
      // Broadcast update to popup if it's open
      broadcastTaskUpdate(taskId, task);
      
      // Update badge based on status
      if (updates.status === 'completed') {
        this.updateBadge('completed');
        this.notifyCompletion(task);
      } else if (updates.status === 'error') {
        this.updateBadge('error');
      }
    }
  },
  
  // Get task by URL
  getTaskByUrl(url) {
    const normalizedUrl = this.normalizeUrl(url);
    for (const [taskId, task] of this.activeTasks) {
      if (this.normalizeUrl(task.url) === normalizedUrl) {
        return task;
      }
    }
    return null;
  },
  
  // Save tasks to storage
  saveToStorage() {
    const tasksObject = Object.fromEntries(this.activeTasks);
    chrome.storage.local.set({ activeTasks: tasksObject });
  },
  
  // Update browser action badge
  updateBadge(status) {
    const config = {
      processing: { text: '...', color: '#2196F3' },
      completed: { text: '✓', color: '#4CAF50' },
      error: { text: '!', color: '#F44336' },
      clear: { text: '', color: '#000000' }
    };
    
    const badgeConfig = config[status] || config.clear;
    chrome.action.setBadgeText({ text: badgeConfig.text });
    chrome.action.setBadgeBackgroundColor({ color: badgeConfig.color });
  },
  
  // Show notification when task completes
  notifyCompletion(task) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon48.png',
      title: 'Summary Ready',
      message: `Your summary for "${task.url.substring(0, 50)}..." is ready!`,
      buttons: [{ title: 'View Summary' }]
    });
  },
  
  // Clean up old tasks
  cleanupOldTasks() {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [taskId, task] of this.activeTasks) {
      if (now - task.startTime > ONE_HOUR) {
        this.activeTasks.delete(taskId);
      }
    }
    
    this.saveToStorage();
  },
  
  // Normalize URL for comparison
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';
      return urlObj.href;
    } catch {
      return url;
    }
  }
};

// Initialize TaskManager when background script loads
TaskManager.initialize();

// ==========================================================================================
// NOTIFICATIONS
// ==========================================================================================

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open the popup when notification is clicked
  chrome.action.openPopup();
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "View Summary" button
    chrome.action.openPopup();
  }
});

// ==========================================================================================
// ERROR HANDLING
// ==========================================================================================

const TASK_TIMEOUT = 30000; // 30 seconds
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Check for timed out tasks
setInterval(() => {
  const now = Date.now();
  
  for (const [taskId, task] of TaskManager.activeTasks) {
    if (task.status === 'processing' && now - task.startTime > TASK_TIMEOUT) {
      TaskManager.updateTask(taskId, {
        status: 'timeout',
        error: 'Summary generation timed out'
      });
    }
  }
}, 5000);

// Clean up old tasks periodically
setInterval(() => {
  TaskManager.cleanupOldTasks();
}, CLEANUP_INTERVAL);