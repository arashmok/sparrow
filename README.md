# ![Sparrow Icon](assets/icons/icon48.png) Sparrow - AI-Powered Webpage Summarizer

Sparrow is a Chrome extension that provides quick and concise summaries of webpages using AI. With a single click, users can extract and summarize the main content of any webpage, improving efficiency in reading and research. The integrated chat feature lets users have interactive conversations about webpage content, ask follow-up questions, or request explanations—allowing for deeper engagement with online material.

## Features

- **One-Click Summarization**: Generate AI-powered summaries of webpages with a single click
- **Multiple Summary Formats**:
  - **Short Summary**: Ultra-concise 1-2 sentence overview (35-50 words)
  - **Detailed Summary**: Comprehensive 2-3 paragraph analysis (150-200 words)
  - **Key Takeaways**: 4-6 bullet points highlighting the most important information
- **Multiple AI Providers**: Choose between OpenAI, OpenRouter, LM Studio, or Ollama
- **Translation Support**: Option to translate content to English before summarizing
- **Interactive Chat**: Discuss the summarized content with AI through the side panel
- **Clean Interface**: Intuitive and lightweight UI within Chrome
- **Smart Content Extraction**: Efficiently extracts relevant content while ignoring ads and sidebars
- **Fullscreen View**: Expand summaries for better readability
- **Offline Capabilities**: Use with LM Studio or Ollama for completely offline summarization

## Coming Soon

- **Text Selection Actions**: Select text on any webpage to ask questions or get explanations
- **Copy & Save Options**: Easily copy the summary or save it for later reference
- **History & Bookmarking**: Save past summaries for later reference

## Installation

### For Development

1. Clone this repository:
   ```
   git clone https://github.com/arashmok/sparrow.git
   cd sparrow
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" by clicking the toggle in the top-right corner
   - Click "Load unpacked" and select the project directory

### For Users (Once Published)

1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"

## Usage

1. Navigate to any webpage you want to summarize
2. Click the Sparrow extension icon in your browser toolbar
3. Click the "Generate" button
4. Select your preferred summary format
5. View or expand the generated summary
6. Click the "Chat" button to open a side panel for discussing the content

## AI Providers

Sparrow supports four AI providers for generating summaries:

### OpenAI API

- Requires an API key from OpenAI
- Provides high-quality summarizations using OpenAI models
- Requires an Internet connection

### OpenRouter API

- Requires an API key from OpenRouter
- Provides access to various AI models through a single API
- Requires an Internet connection

### LM Studio (Local)

- Run AI models locally on your computer
- Complete privacy – no data sent to external servers
- Works offline
- Requires [LM Studio](https://lmstudio.ai/) to be installed and configured

### Ollama (Local)

- Run AI models locally using Ollama
- Provides an alternative local summarization solution
- Works offline
- Requires [Ollama](https://ollama.ai/) to be installed and configured
### Troubleshooting: Ollama CORS Error

If you encounter a 403 error when connecting to Ollama, it may be due to Cross-Origin Resource Sharing (CORS) restrictions. To resolve this issue, you can enable CORS using one of the following methods:

#### Temporary Solution: Start Ollama with CORS Enabled
Run the following command to temporarily enable CORS for Ollama:
```bash
OLLAMA_ORIGINS="*" ollama serve
```

#### Permanent Solution: Configure Ollama as a Systemd Service
To enable CORS permanently, update the systemd service configuration for Ollama:
1. Edit the Ollama service:
   ```bash
   sudo systemctl edit ollama
   ```
2. Add the following lines under the `[Service]` section:
   ```ini
   [Service]
   Environment="OLLAMA_ORIGINS=*"
   ```
3. Save the changes and reload the systemd daemon:
   ```bash
   sudo systemctl daemon-reload
   ```
4. Restart the Ollama service:
   ```bash
   sudo systemctl restart ollama
   ```

This will ensure that CORS is enabled every time Ollama starts.

## Project Structure

```
sparrow/
├── manifest.json             # Extension configuration
├── assets/                   # Static assets
│   ├── css/                  # CSS stylesheets
│   │   ├── popup.css         # Main popup styling
│   │   ├── settings.css      # Settings page styling
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
├── LICENSE                   # MIT License
├── README.md                 # Project documentation
└── .gitignore                # Git ignore file
```

## Technical Details

### Architecture

Sparrow consists of the following key components:
- **Popup UI**: Frontend user interface to interact with the extension
- **Content Script**: Extracts text from webpages and sends it to the background script
- **Background Script**: Handles API requests to AI providers and returns summaries
- **Chat Panel**: Side panel interface for interactive conversations about content
- **Storage Module**: Manages locally stored settings and history

### Workflow

1. User clicks on the extension icon → Opens the popup
2. User clicks "Generate" → Content script extracts text from the active webpage
3. Text is sent to the background script → API call is made to the selected AI provider
4. AI returns summarized text → Displayed in the popup UI
5. User can click "Chat" to discuss the summary in the side panel

### Security & Privacy

- API keys are stored securely using simple encryption
- No user data is stored externally
- Local AI options (LM Studio and Ollama) allow for completely offline use
- Only necessary webpage content is extracted and processed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the ChatGPT API
- LM Studio for making local AI models accessible
- Ollama for providing local AI summarization solutions
- OpenRouter for offering an alternative online summarization API