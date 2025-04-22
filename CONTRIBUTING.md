# Contributing to Sparrow

Sparrow is an open-source browser extension that uses AI to generate webpage summaries and engage in follow-up chats. This guide outlines how to get started, how we work, and how you can help.

---

## 📦 Project Structure

The core structure of the extension:

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

---

## 🛠️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/arashmok/sparrow.git
cd sparrow
```

### 2. Load the extension

- Go to `chrome://extensions/`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `sparrow/` directory

---

## ✨ How You Can Contribute

### 🔧 Code
- Bug fixes
- New features (see [Issues](../../issues))
- UI improvements
- Code refactoring

### 📄 Documentation
- Improve README or inline comments
- Write usage guides

### 🧪 Testing
- Report bugs
- Test extension in different environments
- Suggest usability improvements

---

## 🚀 Submitting Changes

### 1. Fork the repository

```bash
git checkout -b my-feature
# make changes
git commit -m "Add new feature"
git push origin my-feature
```

### 2. Create a Pull Request

- Go to [Pull Requests](../../pulls)
- Click **New Pull Request**
- Fill in a brief description of your changes
- Link to any related issues if relevant

---

## 🧹 Code Style & Guidelines

- Keep your code clean and readable
- Comment where necessary
- Use semantic, descriptive commit messages
- Try to keep PRs focused on one thing (avoid mixing unrelated changes)

---

## 💬 Communication

Feel free to open:
- [Issues](../../issues) for bugs, features, or ideas
- [Discussions](../../discussions) for open-ended feedback or planning

---

## 🙌 Thank You

Whether you're fixing a typo, reporting a bug, or building new features — thanks for helping make Sparrow better for everyone.