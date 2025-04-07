// Content.js - Runs in the context of web pages
// Extracts relevant text content from the current webpage

// Create a flag to indicate this content script is loaded
window.sparrowContentScriptLoaded = true;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  
  if (request.action === "extract_text") {
    try {
      const extractedText = extractPageContent();
      console.log("Extracted text length:", extractedText.length);
      
      // Include extraction metadata to inform the user about large content
      const metadata = {
        length: extractedText.length,
        isLarge: extractedText.length > 4000
      };
      
      sendResponse({ 
        text: extractedText, 
        metadata: metadata,
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
 * @returns {string} The extracted content
 */
function extractPageContent() {
  // Get page metadata
  const pageTitle = document.title || '';
  const pageUrl = window.location.href;
  
  // Extract main content
  let mainContent = '';
  
  // Try to find the main content container
  // Common containers with main content
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
  
  // Try each selector until we find content
  let contentElement = null;
  
  for (const selector of contentSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      // Use the element with the most text content
      contentElement = Array.from(elements).reduce((largest, current) => {
        return (current.textContent.length > largest.textContent.length) ? current : largest;
      }, elements[0]);
      
      if (contentElement.textContent.length > 500) {
        break; // Found substantial content
      }
    }
  }
  
  // If we found a specific content element, use it
  if (contentElement && contentElement.textContent.trim().length > 0) {
    mainContent = contentElement.textContent;
  } else {
    // Otherwise, use a more general approach to extract relevant content
    // Get all paragraphs and headings
    const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
    
    // Filter out elements that are likely not main content (too short, or in footer/header/nav)
    const contentElements = Array.from(paragraphs).filter(element => {
      // Skip very short paragraphs that might be UI elements
      if (element.textContent.trim().length < 20 && !element.tagName.startsWith('H')) {
        return false;
      }
      
      // Skip elements in navigation, footer, sidebar, etc.
      const parent = findParentOfType(element, [
        'nav', 'footer', 'aside', 
        '[role="navigation"]', '[role="complementary"]',
        '.nav', '.navigation', '.menu', '.footer', '.sidebar', '.widget', '.comment'
      ]);
      
      return !parent; // Keep elements that don't have these parents
    });
    
    // Combine the filtered elements
    mainContent = contentElements.map(el => el.textContent.trim()).join('\n\n');
  }
  
  // Prepare the final text
  const extractedText = `Title: ${pageTitle}\nURL: ${pageUrl}\n\n${mainContent}`;
  
  // If we couldn't extract meaningful content, try a last resort approach
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
 * @param {Element} element - The starting element
 * @param {Array<string>} selectors - Array of CSS selectors to match
 * @returns {Element|null} The matching parent or null if none found
 */
function findParentOfType(element, selectors) {
  let current = element;
  
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
    
    current = current.parentElement;
  }
  
  return null;
}