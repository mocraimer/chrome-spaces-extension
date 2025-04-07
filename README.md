# Chrome Spaces

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/chrome-spaces/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/chrome%20web%20store-available-brightgreen.svg)](https://chrome.google.com/webstore/detail/your-extension-id)

Chrome Spaces is a workspace manager for Chrome that treats each browser window as a different named workspace, helping you organize your tabs and manage multiple projects efficiently. Inspired by [Spaces](https://github.com/deanoemcke/spaces) by Dean Oemcke, this extension has been rebuilt with modern Chrome APIs, TypeScript, and React for enhanced features and maintainability.

## Features

- Name and save Chrome windows as "spaces"
- Quick switching between workspaces using keyboard shortcuts
- Easily restore closed workspaces with all their tabs
- Move tabs between different spaces
- Fast fuzzy search for spaces with keyboard navigation
- Track tabs opened and closed within each workspace
- Configurable settings and keyboard shortcuts
- Built with TypeScript and React for a modern codebase

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The Chrome Spaces extension should now be installed and visible in your toolbar

### From Chrome Web Store

Chrome Spaces is also available on the [Chrome Web Store](https://chrome.google.com/webstore/detail/your-extension-id). For the easiest installation, simply visit the Chrome Web Store page and click "Add to Chrome."

## Usage

### Creating and Managing Spaces

Each Chrome window automatically becomes a space, allowing you to organize your work into distinct contexts. Here's how to manage your spaces:

#### Space Names

- **Automatic Naming**: New spaces are automatically assigned a default name based on their creation order
- **Manual Naming**: Click the name of any space to edit it
- **Persistence**: Space names are automatically saved and persist across browser sessions
- **Real-time Updates**: Names update instantly across all open windows
- **Unique Names**: You can have multiple spaces with the same name, useful for similar work contexts

### Keyboard Navigation

The extension provides comprehensive keyboard shortcuts for quick access and navigation:

#### Global Shortcuts

- **Ctrl+Shift+Space** (Windows/Linux) or **Cmd+Shift+Space** (Mac): Open the Spaces popup
- **Ctrl+[1-9]**: Switch to space 1-9 directly
- **/** (forward slash): Focus the search bar
- **Ctrl+N**: Create a new space
- **Ctrl+W**: Close current space
- **?**: Show keyboard shortcuts help

#### Popup Navigation

- **↑/↓**: Navigate through spaces in the list
- **Enter**: Switch to the selected space
- **Esc**: Close the popup
- **Tab/Shift+Tab**: Navigate through interactive elements

> **Note:** Global shortcuts can be customized in Chrome's extension shortcuts settings (`chrome://extensions/shortcuts`)

### Search Functionality

The search feature helps you quickly find and switch between spaces:

#### Search Features

- **Real-time Search**: Results update as you type
- **Fuzzy Matching**: Finds spaces even with partial or inexact matches
- **Keyboard Navigation**: Use arrow keys to navigate search results
- **Search Scope**: Searches both active and closed spaces
- **Clear Search**: Click the 'x' button or press Esc to clear the search

#### Search Tips

1. Start typing to instantly filter spaces
2. Use arrow keys to highlight results
3. Press Enter to switch to the highlighted space
4. Search matches space names and URLs of contained tabs

### Moving Tabs Between Spaces

1. Navigate to the tab you want to move
2. Click the Chrome Spaces icon to open the popup
3. In the "Move Current Tab To" section, find the target space
4. Click "Move" to transfer the tab to that space

### Settings

Access the settings page by clicking "Options" in the popup footer. Here you can:

- Configure default space names
- Set auto-save intervals
- Export and import your spaces data
- Clear all spaces data

## Development

### Project Structure

```
chrome-spaces-extension/
├── manifest.json          # Extension manifest file
├── webpack.config.js      # Webpack configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # npm package file
├── .eslintrc.json        # ESLint configuration
├── .prettierrc           # Prettier configuration
├── icons/                # Extension icons
├── popup/                # Popup UI - React application
│   ├── popup.html        # Popup HTML file
│   └── ...              # React components, styles, scripts, etc.
├── options/              # Options page - React application
│   ├── options.html      # Options HTML file
│   └── ...              # React components, styles, scripts, etc.
├── src/                  # Source code directory (TypeScript)
│   ├── background/       # Background scripts and services
│   ├── popup/            # Popup React application source
│   ├── options/          # Options React application source
│   ├── shared/           # Shared code and types
│   └── ...
├── tests/                # Tests directory
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/             # End-to-end tests
└── CONTRIBUTING.md       # Contribution guidelines
```

### Building for Production

To build the extension for production, run:

```bash
npm run build
```

This will create a production-ready build in the `dist` directory.

## Contributing

Contributions are welcome! Please read the [Contributing Guidelines](CONTRIBUTING.md) for details on how to contribute. Feel free to submit pull requests or report issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
