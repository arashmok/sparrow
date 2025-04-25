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
      
      // Try to copy to clipboard (this should work in content scripts)
      try {
        const jsonData = JSON.stringify(conversationData, null, 2);
        
        // Use the clipboard API
        navigator.clipboard.writeText(jsonData)
          .then(() => console.log("Successfully copied to clipboard"))
          .catch(e => console.error("Clipboard write failed:", e));
          
        // Create and show dialog
        createImportDialog(title);
      } catch (error) {
        console.error("Error in clipboard operation:", error);
        // Show dialog anyway
        createImportDialog(title);
      }
    }
  });
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
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    width: 400px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  
  dialog.innerHTML = `
    <h3 style="margin-top: 0; color: #2980b9;">Import from Sparrow</h3>
    <p>Please follow these steps to import your conversation:</p>
    <ol style="padding-left: 20px; line-height: 1.5;">
      <li>Click "New Chat" in OpenWebUI</li>
      <li>Name your conversation: <br><strong style="color: #2980b9;">${title}</strong></li>
      <li>The conversation data has been copied to your clipboard for reference</li>
    </ol>
    <div style="text-align: right; margin-top: 15px;">
      <button id="sparrow-import-close" style="
        background: #2980b9;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      ">OK</button>
    </div>
  `;
  
  // Add dialog to page
  document.body.appendChild(dialog);
  
  // Add event listener to close button
  document.getElementById('sparrow-import-close').addEventListener('click', function() {
    dialog.remove();
  });
}