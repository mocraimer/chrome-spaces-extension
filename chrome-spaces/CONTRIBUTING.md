# Contributing to Chrome Spaces

Thank you for considering contributing to Chrome Spaces! This document provides guidelines and instructions for contributing.

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chrome-spaces.git
cd chrome-spaces
```

2. Install dependencies:
```bash
npm install
```

3. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension directory

## Development Workflow

- The extension uses vanilla JavaScript and follows Chrome Extensions Manifest V3
- Code formatting is handled by Prettier
- Linting is done with ESLint
- Use `npm run format` to format code
- Use `npm run lint` to check for issues
- Use `npm run build` to create a distributable zip file

## Project Structure

```
chrome-spaces/
├── background.js       # Core space management logic
├── popup/             # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/           # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/            # Extension icons
```

## Core Components

### Background Script (background.js)
- Manages the state of spaces
- Handles window/tab events
- Persists data to storage
- Provides API for popup/options pages

### Popup (popup/popup.js)
- Main user interface
- Lists active and closed spaces
- Handles space switching and tab movement
- Provides search and keyboard navigation

### Options (options/options.js)
- Configuration interface
- Import/export functionality
- Data management

## Commit Guidelines

- Use clear, descriptive commit messages
- Start with a verb in present tense (e.g., "Add feature" not "Added feature")
- Reference issue numbers when applicable

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run formatting and linting checks
5. Submit a pull request
6. Include a clear description of changes

## Testing

- Test changes in Chrome with different window configurations
- Verify space persistence across browser restarts
- Check keyboard shortcuts functionality
- Test error handling scenarios

## Code Style

- Use modern JavaScript features (ES2021+)
- Follow existing naming conventions
- Add JSDoc comments for functions
- Keep functions focused and concise
- Use meaningful variable names

## Additional Notes

- The extension uses Chrome API's `chrome.windows`, `chrome.tabs`, and `chrome.storage`
- Prefer async/await over callbacks
- Handle errors gracefully with appropriate user feedback
- Consider performance implications when managing many tabs/windows

## Questions?

Feel free to open an issue for questions or send a pull request with improvements to this guide.
