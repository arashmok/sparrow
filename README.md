# Sparrow - AI-Powered Webpage Summarizer

Sparrow is a Chrome extension that provides quick and concise summaries of webpages using OpenAI's ChatGPT API. With a single click, users can extract and summarize the main content of any webpage, improving efficiency in reading and research.

## Features

- **One-Click Summarization**: Generate AI-powered summaries of webpages with a single click
- **Customizable Summaries**: Choose between different summary formats (short, detailed, key takeaways)
- **Clean Interface**: Intuitive and lightweight UI within Chrome
- **Smart Content Extraction**: Efficiently extracts relevant content while ignoring ads and sidebars
- **Copy & Save Options**: Easily copy the summary or save it for later reference

## Coming Soon

- Multi-language support
- Dark Mode UI
- Custom API Key support
- History & Bookmarking for past summaries

## Installation

### For Development

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/sparrow.git
   cd sparrow
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your configuration:
   ```
   cp config.template.js config.js
   ```
   Then edit `config.js` as needed:
   - During development: Keep `DEVELOPMENT_MODE: true` to use mock data
   - For real API testing: Set `DEVELOPMENT_MODE: false` and add your OpenAI API key
   
   This file is excluded from git to keep your API key private.

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" by clicking the toggle in the top-right corner
   - Click "Load unpacked" and select the project directory

### For Users (Once Published)

1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"

## Usage

1. Navigate to any webpage you want to summarize
2. Click the Sparrow extension icon in your browser toolbar
3. Click the "Summarize" button
4. Select your preferred summary format
5. View, copy, or save the generated summary

## Development

### Project Structure

```
sparrow/
├── manifest.json             # Extension configuration
├── config.template.js        # Template for configuration (to be copied to config.js)
├── config.js                 # Actual configuration with API keys (git-ignored)
├── assets/                   # Static assets
├── src/                      # Source code
│   ├── popup/                # Popup UI
│   ├── scripts/              # Extension scripts
│   └── lib/                  # Third-party libraries
├── test/                     # Tests
└── ...
```

### Building and Testing

```
# Run development build with auto-reload
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Technical Details

### Architecture

Sparrow consists of the following key components:
- **Popup UI**: Frontend user interface to interact with the extension
- **Content Script**: Extracts text from webpages and sends it to the background script
- **Background Script**: Handles API requests to OpenAI and returns summaries
- **Storage Module**: Manages locally stored settings and history

### Workflow

1. User clicks on the extension icon → Opens the popup
2. User clicks "Summarize" → Content script extracts text from the active webpage
3. Text is sent to the background script → API call is made to OpenAI's ChatGPT API
4. API returns summarized text → Displayed in the popup UI
5. User can copy or save the summary for later use

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the ChatGPT API