// This content script runs on OpenWebUI to handle the import
console.log("OpenWebUI import content script loaded");

// Add a listener for our custom event
document.addEventListener('sparrow-export-ready', function(e) {
  console.log("Received sparrow-export-ready event", e.detail);
  if (e.detail && e.detail.title) {
    showImportDialog(e.detail.title);
  }
});

// Also check localStorage as a backup method
window.addEventListener('load', function() {
  try {
    const title = localStorage.getItem('sparrow_export_title');
    if (title) {
      console.log("Found export title in localStorage:", title);
      showImportDialog(title);
      // Clear it after use
      localStorage.removeItem('sparrow_export_title');
    }
  } catch (e) {
    console.error("Error checking localStorage:", e);
  }
  
  // Check URL parameters as well (third backup method)
  const url = new URL(window.location.href);
  if (url.searchParams.has('source') && url.searchParams.get('source') === 'sparrow') {
    console.log("Detected Sparrow import request from URL");
    
    // Request the conversation data from the extension
    chrome.runtime.sendMessage({
      action: "get-openwebui-export-data"
    }, function(response) {
      if (response && response.data) {
        console.log("Received conversation data from storage");
        showImportDialog(response.data.title);
      }
    });
  }
});

// Function to show import dialog
function showImportDialog(title) {
  // Get conversation data from storage
  chrome.storage.local.get(['openwebui_export_data'], function(result) {
    if (result && result.openwebui_export_data) {
      const conversationData = result.openwebui_export_data;
      
      // Try multiple clipboard methods
      try {
        const jsonData = JSON.stringify(conversationData, null, 2);
        
        // Method 1: Try the standard clipboard API first
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(jsonData)
            .then(() => console.log("Successfully copied to clipboard using Clipboard API"))
            .catch(e => {
              console.error("Clipboard API failed:", e);
              fallbackClipboardCopy(jsonData);
            });
        } else {
          // Method 2: Try the fallback method
          fallbackClipboardCopy(jsonData);
        }
        
        // Create and show dialog regardless of clipboard success
        createImportDialog(title);
      } catch (error) {
        console.error("Error in clipboard operation:", error);
        // Show dialog anyway
        createImportDialog(title);
      }
    }
  });
}

// Add this fallback clipboard function
function fallbackClipboardCopy(text) {
  try {
    // Method 1: Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Hide the element
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Execute the copy command
    const successful = document.execCommand('copy');
    
    // Remove the temporary element
    document.body.removeChild(textArea);
    
    if (successful) {
      console.log("Successfully copied to clipboard using execCommand");
      return true;
    } else {
      console.warn("execCommand copy failed");
      return false;
    }
  } catch (err) {
    console.error("Fallback clipboard method failed:", err);
    return false;
  }
}

// Function to create and inject dialog
function createImportDialog(title) {
  // Remove any existing dialog first
  const existingDialog = document.getElementById('sparrow-import-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  // Create dialog element
  const dialog = document.createElement('div');
  dialog.id = 'sparrow-import-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    width: 450px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #333;
    line-height: 1.5;
  `;
  
  dialog.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 16px;">
      <div style="background-color: #2980b9; border-radius: 50%; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; margin-right: 12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      </div>
      <h3 style="margin: 0; color: #2980b9; font-size: 20px;">Import from Sparrow</h3>
    </div>
    
    <div style="display: flex; align-items: center; margin-bottom: 12px; background-color: #e8f4fc; padding: 8px 12px; border-radius: 6px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2980b9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span style="color: #2980b9; font-weight: 500;">Conversation data copied to clipboard</span>
    </div>
    
    <p style="margin-top: 0; font-weight: 500;">Please follow these steps:</p>
    <ol style="padding-left: 24px; margin-bottom: 20px;">
      <li style="margin-bottom: 8px;">Click "New Chat" in OpenWebUI</li>
      <li style="margin-bottom: 8px;">Name your conversation: <br><strong style="color: #2980b9; display: block; margin-top: 4px; padding: 8px; background: #f5f5f5; border-radius: 4px;">${title}</strong></li>
      <li>If needed, paste the copied data in the import field</li>
    </ol>
    
    <div style="display: flex; justify-content: space-between; margin-top: 20px;">
      <button id="sparrow-recopy-data" style="
        background: #f5f5f5;
        color: #555;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      ">Re-copy Data</button>
      
      <button id="sparrow-import-close" style="
        background: #2980b9;
        color: white;
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
      ">OK</button>
    </div>
  `;
  
  // Add dialog to page
  document.body.appendChild(dialog);
  
  // Add event listener to close button
  document.getElementById('sparrow-import-close').addEventListener('click', function() {
    dialog.remove();
  });
  
  // Add event listener to re-copy button
  document.getElementById('sparrow-recopy-data').addEventListener('click', function() {
    chrome.storage.local.get(['openwebui_export_data'], function(result) {
      if (result && result.openwebui_export_data) {
        const jsonData = JSON.stringify(result.openwebui_export_data, null, 2);
        
        // Try both clipboard methods
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(jsonData)
            .then(() => {
              // Show a small notification
              showCopiedNotification();
            })
            .catch(e => {
              fallbackClipboardCopy(jsonData);
              showCopiedNotification();
            });
        } else {
          fallbackClipboardCopy(jsonData);
          showCopiedNotification();
        }
      }
    });
  });
}

// Add a small notification that appears briefly
function showCopiedNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(41, 128, 185, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 10001;
    transition: opacity 0.3s ease-in-out;
  `;
  notification.textContent = 'Conversation data copied!';
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}