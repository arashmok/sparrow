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
      // Load API mode to display the correct indicator
      chrome.storage.local.get(['apiMode'], (result) => {
        updateApiIndicator(result.apiMode || 'openai');
      });
      
      // Listen for messages from the background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'chat-initiate') {
          // Display the page content
          pageContent = message.pageContent;
          
          if (pageContent) {
            pageContentContainer.classList.remove('hidden');
            
            // Show a truncated preview of the page content
            const previewLength = 300;
            pageContentText.textContent = pageContent.length > previewLength 
              ? pageContent.substring(0, previewLength) + '...' 
              : pageContent;
            
            // Add initial welcoming message from the assistant
            addMessage("Hello! I've received the content of this page. How can I help you with it?", 'assistant');
            
            // Update conversation history with page content as context
            conversationHistory = [{
              role: 'system',
              content: `The following is the content of the webpage the user is viewing:\n\n${pageContent}`
            }];
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
    
    // Function to update the API indicator
    function updateApiIndicator(apiMode) {
      let methodName = '';
      let statusClass = '';
      
      if (apiMode === 'lmstudio') {
        methodName = 'LM Studio';
        statusClass = 'indicator-lmstudio';
      } else if (apiMode === 'ollama') {
        methodName = 'Ollama';
        statusClass = 'indicator-ollama';
      } else {
        methodName = 'OpenAI';
        statusClass = 'indicator-openai';
      }
      
      apiIndicator.textContent = methodName;
      apiIndicator.className = 'api-method-indicator ' + statusClass;
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
      
      // Create message content
      const messageText = document.createElement('div');
      messageText.className = 'message-content';
      messageText.textContent = text;
      messageDiv.appendChild(messageText);
      
      // Add timestamp
      const timestamp = document.createElement('span');
      timestamp.className = 'message-time';
      timestamp.textContent = getFormattedTime();
      messageDiv.appendChild(timestamp);
      
      // Add to chat and scroll to bottom
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
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