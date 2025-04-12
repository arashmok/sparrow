# Sparrow - AI-Powered Webpage Summarizer

Sparrow is a Chrome extension that provides quick and concise summaries of webpages using AI. With a single click, users can extract and summarize the main content of any webpage, improving efficiency in reading and research.

## Features

- **One-Click Summarization**: Generate AI-powered summaries of webpages with a single click
- **Multiple AI Providers**: Choose between OpenAI, OpenRouter, LM Studio, or Ollama
- **Customizable Summaries**: Choose between different summary formats (short, detailed, key takeaways)
- **Translation Support**: Option to translate content to English before summarizing
- **Interactive Chat**: Discuss the summarized content with AI through the side panel
- **Clean Interface**: Intuitive and lightweight UI within Chrome
- **Smart Content Extraction**: Efficiently extracts relevant content while ignoring ads and sidebars
- **Copy & Save Options**: Easily copy the summary or save it for later reference
- **Offline Capabilities**: Use with LM Studio or Ollama for completely offline summarization

## Coming Soon

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

3. Load the extension in Chrome:
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

## AI Providers

Sparrow supports four AI providers for generating summaries:

#### OpenAI API

- Requires an API key from OpenAI
- Provides high-quality summarizations using OpenAI models
- Requires an Internet connection

#### OpenRouter API

- Requires an API key from OpenRouter
- Provides an alternative online summarization solution
- Requires an Internet connection

#### LM Studio (Local)

- Run AI models locally on your computer
- Complete privacy – no data sent to external servers
- Works offline
- Requires [LM Studio](https://lmstudio.ai/) to be installed and configured

#### Ollama (Local)

- Run AI models locally using Ollama
- Provides an alternative local summarization solution
- Works offline
- Requires [Ollama](https://ollama.ai/) to be installed and configured

## Development

### Project Structure

### Project Structure

```
sparrow/
├── manifest.json             # Extension configuration
├── assets/                   # Static assets
│   ├── css/                  # CSS stylesheets
│   │   ├── popup.css         # Main popup styling
│   │   ├── settings.css      # Settings page styling
│   │   └── selection-menu.css # Text selection menu styling
│   └── icons/                # Extension icons
├── src/                      # Source code
│   ├── popup/                # Popup UI
│   │   ├── popup.html        # Main popup interface
│   │   ├── popup.js          # Popup functionality
│   │   ├── settings.html     # Settings page
│   │   └── settings.js       # Settings functionality
│   ├── panel/                # Side panel
│   │   ├── chat-panel.html   # Chat panel interface
│   │   ├── chat-panel.js     # Chat panel functionality
│   │   └── chat-panel.css    # Chat panel styling
│   └── scripts/              # Background and content scripts
│       ├── background.js     # Background service worker
│       ├── content.js        # Content script
│       └── selection-menu.js # Text selection menu script
├── LICENSE                   # MIT License
├── README.md                 # Project documentation
└── .gitignore                # Git ignore file
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
- **Background Script**: Handles API requests to AI providers and returns summaries
- **Storage Module**: Manages locally stored settings and history

### Workflow

1. User clicks on the extension icon → Opens the popup
2. User clicks "Summarize" → Content script extracts text from the active webpage
3. Text is sent to the background script → API call is made to the selected AI provider
4. AI returns summarized text → Displayed in the popup UI
5. User can copy or save the summary for later use

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the ChatGPT API
- LM Studio for making local AI models accessible
- Ollama for providing local AI summarization solutions
- OpenRouter for offering an alternative online summarization API