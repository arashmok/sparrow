// This content script runs on OpenWebUI to handle the import
// It will be injected when the URL matches the OpenWebUI base URL with import parameters

console.log("OpenWebUI import content script loaded");

// Check if we're on an import page
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
            
            // Inject conversation data into OpenWebUI
            injectConversationData(response.data);
        } else {
            console.error("Failed to get conversation data:", response);
            alert("Failed to import conversation from Sparrow");
        }
    });
}

// Function to inject conversation data into OpenWebUI
function injectConversationData(conversationData) {
    // Try to find OpenWebUI's data store or import mechanism
    // This depends on how OpenWebUI handles imports
    
    // Method 1: Try to use OpenWebUI's global window objects if available
    if (window.openWebUI && typeof window.openWebUI.importConversation === 'function') {
        console.log("Using OpenWebUI's import function");
        window.openWebUI.importConversation(conversationData);
        alert("Conversation imported successfully from Sparrow extension!");
        return;
    }
    
    // Method 2: Try to find and click an import button if it exists
    const importButtons = Array.from(document.querySelectorAll('button')).filter(
        button => button.textContent.toLowerCase().includes('import')
    );
    
    if (importButtons.length > 0) {
        console.log("Found import button, attempting to use it");
        
        // Store data in localStorage for the import process to find
        localStorage.setItem('sparrow_import_data', JSON.stringify(conversationData));
        
        // Click the import button
        importButtons[0].click();
        
        // Show guidance to the user
        setTimeout(() => {
            alert("Please select the Sparrow import data from the import dialog if prompted");
        }, 500);
        
        return;
    }
    
    // Method 3: Last resort - show instructions to manually create a conversation
    console.log("Unable to automatically import, showing manual instructions");
    alert(`Unable to automatically import the conversation. 
    
Please manually create a new conversation in OpenWebUI with the title: 
"${conversationData.title}"

The conversation data has been copied to your clipboard for reference.`);
    
    // Copy conversation data to clipboard for reference
    navigator.clipboard.writeText(JSON.stringify(conversationData, null, 2))
        .then(() => console.log("Copied conversation data to clipboard"))
        .catch(err => console.error("Failed to copy to clipboard:", err));
}