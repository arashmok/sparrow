// This content script runs on OpenWebUI to handle the import
// It will be injected when the URL matches the OpenWebUI base URL with import parameters

console.log("OpenWebUI import content script loaded");

// Delay execution to ensure page is fully loaded
setTimeout(() => {
  try {
    // Check if we're on an OpenWebUI page
    const isOpenWebUI = document.title.includes('OpenWebUI') || 
                        document.querySelector('meta[name="application-name"][content*="OpenWebUI"]') ||
                        window.location.href.includes('openwebui');
    
    if (isOpenWebUI) {
      console.log("Detected OpenWebUI page");
      
      // Check if we're coming from Sparrow
      const url = new URL(window.location.href);
      if (url.searchParams.has('source') && url.searchParams.get('source') === 'sparrow') {
        console.log("Detected Sparrow import request");
        
        // Get the timestamp parameter
        const timestamp = url.searchParams.get('timestamp');
        
        // Request the conversation data from the extension
        chrome.runtime.sendMessage({
          action: "get-openwebui-export-data",
          timestamp: timestamp
        }, function(response) {
          if (response && response.data) {
            console.log("Received conversation data:", response.data);
            
            // Copy data to clipboard immediately as backup
            navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))
              .then(() => console.log("Copied conversation data to clipboard"))
              .catch(err => console.error("Failed to copy to clipboard:", err));
            
            // Try automatic import methods first
            if (!tryAutomaticImport(response.data)) {
              // If automatic methods fail, show the manual import dialog
              showManualImportDialog(response.data);
            }
          } else {
            console.error("Failed to get conversation data:", response);
            alert("Failed to import conversation from Sparrow");
          }
        });
      }
    }
  } catch (error) {
    console.error("Error in OpenWebUI import script:", error);
  }
}, 1000);

// Function to try automatic import methods
function tryAutomaticImport(conversationData) {
  // Method 1: Try to use OpenWebUI's global window objects if available
  if (window.openWebUI && typeof window.openWebUI.importConversation === 'function') {
    console.log("Using OpenWebUI's import function");
    try {
      window.openWebUI.importConversation(conversationData);
      alert("Conversation imported successfully from Sparrow extension!");
      return true;
    } catch (err) {
      console.error("Error using OpenWebUI's import function:", err);
    }
  }
  
  // Method 2: Try to find and click an import button if it exists
  const importButtons = Array.from(document.querySelectorAll('button')).filter(
    button => button.textContent.toLowerCase().includes('import')
  );
  
  if (importButtons.length > 0) {
    console.log("Found import button, attempting to use it");
    
    // Store data in localStorage for the import process to find
    try {
      localStorage.setItem('sparrow_import_data', JSON.stringify(conversationData));
      
      // Click the import button
      importButtons[0].click();
      
      // Show guidance to the user
      setTimeout(() => {
        alert("Please select the Sparrow import data from the import dialog if prompted");
      }, 500);
      
      return true;
    } catch (err) {
      console.error("Error using import button method:", err);
    }
  }
  
  return false; // No automatic method succeeded
}

// Function to show manual import dialog
function showManualImportDialog(conversationData) {
  // Create a better styled dialog
  const dialogHTML = `
    <div id="sparrow-import-dialog" style="
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
    ">
      <h3 style="margin-top: 0; color: #2980b9;">Import from Sparrow</h3>
      <p>Please follow these steps to import your conversation:</p>
      <ol style="padding-left: 20px; line-height: 1.5;">
        <li>Click "New Chat" in OpenWebUI</li>
        <li>Name your conversation: <br><strong style="color: #2980b9;">${conversationData.title || 'Imported from Sparrow'}</strong></li>
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
    </div>
  `;
  
  // Add the dialog to the page
  const dialogContainer = document.createElement('div');
  dialogContainer.innerHTML = dialogHTML;
  document.body.appendChild(dialogContainer);
  
  // Add event listener to close button
  document.getElementById('sparrow-import-close').addEventListener('click', function() {
    dialogContainer.remove();
  });
}