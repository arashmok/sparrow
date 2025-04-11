// Chat Panel JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pageContentContainer = document.getElementById('page-content-container');
    const pageContentText = document.getElementById('page-content-text');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const apiIndicator = document.getElementById('api-indicator');
    
    // Store conversation history
    let conversationHistory = [];
    let pageContent = '';
    
    // Initialize the panel
    initializePanel();
    
    // Function to initialize the panel
    async function initializePanel() {
      // Load settings from local storage (not sync storage)
      chrome.storage.local.get([
        'apiMode', 
        'openaiModel', 
        'lmstudioModel', 
        'ollamaModel', 
        'openrouterModel'
      ], function(result) {
        const apiMode = result.apiMode || 'openai';
        let modelName = '';
        
        // Get the appropriate model name based on the API mode
        if (apiMode === 'openai') {
          modelName = result.openaiModel || '';
        } else if (apiMode === 'lmstudio') {
          modelName = result.lmstudioModel || '';
        } else if (apiMode === 'ollama') {
          modelName = result.ollamaModel || '';
        } else if (apiMode === 'openrouter') {
          modelName = result.openrouterModel || '';
        }
        
        // Update the indicator with the model name
        updateApiIndicator(apiMode, modelName);
      });
      
      // Listen for messages from the background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'chat-initiate') {
          const pageContent = message.pageContent || '';
          
          // Add the summary as the first assistant message
          if (pageContent) {
            addMessage(pageContent, 'assistant');
            conversationHistory = [
              {
                role: 'assistant',
                content: pageContent
              }
            ];
          }
          
          // Handle chat action (ask or explain)
          if (message.chatAction === 'ask' || message.chatAction === 'explain') {
            const selectedText = message.text || '';
            let prompt;
            
            if (message.chatAction === 'ask') {
              prompt = `The user wants to know more about the following text: "${selectedText}"`;
            } else {
              prompt = `The user wants you to explain the following text in simple terms: "${selectedText}"`;
            }
            
            // Send message to background script for processing
            chrome.runtime.sendMessage({
              action: 'chat-message',
              text: prompt,
              history: conversationHistory
            }, (response) => {
              hideTypingIndicator();
              
              if (response && response.reply) {
                addMessage(response.reply, 'assistant');
                
                // Update conversation history
                conversationHistory.push({
                  role: 'assistant',
                  content: response.reply
                });
              } else {
                addMessage('Sorry, I encountered an error processing your message.', 'assistant');
              }
            });
          }
          
          sendResponse({ success: true });
        }
      });
      
      // Event listeners
      sendButton.addEventListener('click', sendMessage);
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    
    // Function to process selected text
    function processSelectedText(text, action) {
      // Generate message based on the action
      let prompt = '';
      
      if (action === 'ask') {
        prompt = `The user wants to know more about the following text: "${text}"`;
      } else if (action === 'explain') {
        prompt = `The user wants you to explain the following text in simple terms: "${text}"`;
      } else {
        prompt = `The user has selected the following text: "${text}"`;
      }
      
      // Send message to background script for processing
      chrome.runtime.sendMessage({
        action: 'chat-message',
        text: prompt,
        history: conversationHistory
      }, (response) => {
        hideTypingIndicator();
        
        if (response && response.reply) {
          addMessage(response.reply, 'assistant');
          
          // Update conversation history
          conversationHistory.push({
            role: 'assistant',
            content: response.reply
          });
        } else {
          addMessage('Sorry, I encountered an error processing your message.', 'assistant');
        }
      });
    }
    
    // Function to update the API indicator
    function updateApiIndicator(apiMode, modelName = '') {
      let displayInfo = { class: '', name: '' };
      
      // Set color class based on API source
      if (apiMode === 'lmstudio') {
        displayInfo.class = 'indicator-lmstudio';
      } else if (apiMode === 'ollama') {
        displayInfo.class = 'indicator-ollama';
      } else if (apiMode === 'openrouter') {
        displayInfo.class = 'indicator-openrouter';
      } else {
        displayInfo.class = 'indicator-openai';
      }
      
      // Use model name if provided, otherwise use API name
      if (modelName) {
        displayInfo.name = truncateModelName(modelName);
      } else {
        if (apiMode === 'lmstudio') displayInfo.name = 'LM Studio';
        else if (apiMode === 'ollama') displayInfo.name = 'Ollama';
        else if (apiMode === 'openrouter') displayInfo.name = 'OpenRouter';
        else displayInfo.name = 'OpenAI';
      }
      
      // Update the indicator
      const apiIndicator = document.getElementById('api-indicator');
      if (apiIndicator) {
        apiIndicator.textContent = displayInfo.name;
        apiIndicator.className = 'api-method-indicator ' + displayInfo.class;
      }
    }
    
    // Helper function to truncate model name to reasonable length
    function truncateModelName(modelName) {
      if (!modelName) return '';
      
      // Remove common prefixes
      let displayName = modelName
        .replace('gpt-3.5-turbo', 'GPT-3.5')
        .replace('gpt-4-turbo', 'GPT-4 Turbo')
        .replace('gpt-4-0', 'GPT-4')
        .replace('gpt-4o', 'GPT-4o');
      
      // Remove organization prefixes for OpenRouter models
      const slashIndex = displayName.indexOf('/');
      if (slashIndex > 0) {
        displayName = displayName.substring(slashIndex + 1);
      }
      
      // If still too long, truncate
      if (displayName.length > 15) {
        displayName = displayName.substring(0, 12) + '...';
      }
      
      return displayName;
    }
    
    // Function to send a user message
    function sendMessage() {
      const messageText = chatInput.value.trim();
      if (!messageText) return;
      
      // Add user message to the chat
      addMessage(messageText, 'user');
      
      // Clear input
      chatInput.value = '';
      
      // Update conversation history
      conversationHistory.push({
        role: 'user',
        content: messageText
      });
      
      // Show typing indicator
      showTypingIndicator();
      
      // Send message to background script for processing
      chrome.runtime.sendMessage({
        action: 'chat-message',
        text: messageText,
        history: conversationHistory
      }, (response) => {
        hideTypingIndicator();
        
        if (response && response.reply) {
          addMessage(response.reply, 'assistant');
          
          // Update conversation history
          conversationHistory.push({
            role: 'assistant',
            content: response.reply
          });
        } else {
          addMessage('Sorry, I encountered an error processing your message.', 'assistant');
        }
      });
    }
    
    // Function to add a message to the chat
    function addMessage(text, role) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message message-${role}`;
      
      // Create message content with formatting support
      const messageText = document.createElement('div');
      messageText.className = 'message-content';
      
      // Convert markdown to HTML for proper rendering
      const formattedText = formatMessageText(text);
      messageText.innerHTML = formattedText;
      
      messageDiv.appendChild(messageText);
      
      // Add to chat and scroll to bottom
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to format message text with markdown support
    function formatMessageText(text) {
      // Process code blocks (```code```)
      text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      
      // Process inline code (`code`)
      text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
      
      // Process bold (**text** or __text__)
      text = text.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
      
      // Process italic (*text* or _text_)
      text = text.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
      
      // Process bullet lists
      text = text.replace(/^\s*[\*\-]\s+(.*?)$/gm, '<li>$1</li>');
      text = text.replace(/(<li>.*?<\/li>)\s*(<li>)/g, '$1<$2');
      text = text.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
      
      // Process numbered lists
      text = text.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<li>$2</li>');
      text = text.replace(/(<li>.*?<\/li>)\s*(<li>)/g, '$1<$2');
      text = text.replace(/(<li>.*?<\/li>)+/g, '<ol>$&</ol>');
      
      // Convert line breaks
      text = text.replace(/\n/g, '<br>');
      
      return text;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'typing-indicator message message-assistant';
      typingDiv.id = 'typing-indicator';
      
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        typingDiv.appendChild(dot);
      }
      
      chatMessages.appendChild(typingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to hide typing indicator
    function hideTypingIndicator() {
      const typingIndicator = document.getElementById('typing-indicator');
      if (typingIndicator) {
        typingIndicator.remove();
      }
    }
    
    // Helper function to get formatted time
    function getFormattedTime() {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12
      
      return `${hours}:${minutes} ${ampm}`;
    }
  });