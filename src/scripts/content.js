/**
 * content.js - Runs in the context of web pages
 * 
 * This script is responsible for:
 * - Extracting relevant text content from the current webpage
 * - Communicating with the extension popup
 * - Filtering out navigation, ads, footers, and other non-content elements
 */

// Create a flag to indicate this content script is loaded
// This helps the extension know if it needs to reload the script
window.sparrowContentScriptLoaded = true;

/**
 * Message listener for handling requests from the popup
 * Supports text extraction and script status checking
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  
  if (request.action === "extract_text") {
    try {
      // Extract the page content
      const extractedText = extractPageContent();
      console.log("Extracted text length:", extractedText.length);
      
      // Send the extracted text without unnecessary metadata indicators
      sendResponse({ 
        text: extractedText,
        success: true 
      });
    } catch (error) {
      console.error("Error extracting text:", error);
      sendResponse({ error: error.message, success: false });
    }
  } else if (request.action === "ping") {
    // Simple ping to check if the content script is loaded
    sendResponse({ status: "Content script is loaded" });
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

/**
 * Extracts relevant content from the webpage
 * Tries to filter out navigation, ads, footers, etc.
 * 
 * @returns {string} The extracted content with page metadata
 */
function extractPageContent() {
  // Get page metadata
  const pageTitle = document.title || '';
  const pageUrl = window.location.href;
  
  // Extract main content
  let mainContent = '';
  
  // Try to find the main content container using common selectors
  // These selectors target elements that typically contain the main content
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
  
  // Try each selector until we find substantial content
  let contentElement = null;
  
  for (const selector of contentSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Use the element with the most text content
      // This helps prioritize the main content container over smaller elements
      contentElement = Array.from(elements).reduce((largest, current) => {
        return (current.textContent.length > largest.textContent.length) ? current : largest;
      }, elements[0]);
      
      // If we found substantial content, stop searching
      if (contentElement.textContent.length > 500) {
        break; // Found substantial content
      }
    }
  }
  
  // Method 1: Use the identified content element if found
  if (contentElement && contentElement.textContent.trim().length > 0) {
    mainContent = contentElement.textContent;
  } else {
    // Method 2: Use a more general approach to extract relevant content
    // Get all paragraphs and headings
    const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
    
    // Filter out elements that are likely not main content
    const contentElements = Array.from(paragraphs).filter(element => {
      // Skip very short paragraphs that might be UI elements
      // Headings (h1-h6) are kept regardless of length
      if (element.textContent.trim().length < 20 && !element.tagName.startsWith('H')) {
        return false;
      }
      
      // Skip elements in navigation, footer, sidebar, etc.
      // This uses a helper function to check if the element has a parent
      // that matches selectors commonly used for non-content elements
      const parent = findParentOfType(element, [
        'nav', 'footer', 'aside', 
        '[role="navigation"]', '[role="complementary"]',
        '.nav', '.navigation', '.menu', '.footer', '.sidebar', '.widget', '.comment'
      ]);
      
      return !parent; // Keep elements that don't have these parents
    });
    
    // Combine the filtered elements with double line breaks between them
    mainContent = contentElements.map(el => el.textContent.trim()).join('\n\n');
  }
  
  // Prepare the final text with metadata
  const extractedText = `Title: ${pageTitle}\nURL: ${pageUrl}\n\n${mainContent}`;
  
  // Method 3 (fallback): If we couldn't extract meaningful content, try a last resort approach
  if (mainContent.length < 500) {
    // Get all text from the body, removing scripts and styles
    const bodyClone = document.body.cloneNode(true);
    const scripts = bodyClone.querySelectorAll('script, style, noscript, svg, canvas, iframe');
    scripts.forEach(script => script.remove());
    
    return `Title: ${pageTitle}\nURL: ${pageUrl}\n\n${bodyClone.textContent.trim()}`;
  }
  
  return extractedText;
}

/**
 * Finds a parent element matching any of the given selectors
 * Useful for determining if an element is part of navigation, footer, etc.
 * 
 * @param {Element} element - The starting element
 * @param {Array<string>} selectors - Array of CSS selectors to match
 * @returns {Element|null} The matching parent or null if none found
 */
function findParentOfType(element, selectors) {
  let current = element;
  
  // Traverse up the DOM tree until we reach the body
  while (current && current !== document.body) {
    for (const selector of selectors) {
      // Check if the element itself matches
      if (current.matches && current.matches(selector)) {
        return current;
      }
      
      // Check if current has a parent or ancestor that matches
      const closest = current.closest && current.closest(selector);
      if (closest) {
        return closest;
      }
    }
    
    // Move up to the parent element
    current = current.parentElement;
  }
  
  // No matching parent found
  return null;
}