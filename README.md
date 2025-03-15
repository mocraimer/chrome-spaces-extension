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

- Each Chrome window automatically becomes a space
- Click the Chrome Spaces icon in the toolbar to open the popup interface
- Rename your current space using the input field at the top
- Switch between spaces by clicking on them in the "Active Spaces" list
- Restore closed spaces from the "Closed Spaces" list

### Keyboard Shortcuts

- **Ctrl+Shift+Space** (or **Cmd+Shift+Space** on Mac): Open the Spaces popup
- **Ctrl+Shift+Right** (or **Cmd+Shift+Right** on Mac): Switch to next space
- **Ctrl+Shift+Left** (or **Cmd+Shift+Left** on Mac): Switch to previous space
- **Up/Down Arrow**: Navigate through spaces in the popup
- **Enter**: Switch to currently selected space

> **Note:** You can customize these shortcuts by going to `chrome://extensions/shortcuts`.

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
├── tsconfig.json          # TypeScript configuration
├── package.json           # npm package file
├── .eslintrc.json         # ESLint configuration
├── .prettierrc            # Prettier configuration
├── icons/                 # Extension icons
├── popup/                 # Popup UI - React application
│   ├── popup.html         # Popup HTML file
│   └── ...              # React components, styles, scripts, etc.
├── options/               # Options page - React application
│   ├── options.html       # Options HTML file
│   └── ...              # React components, styles, scripts, etc.
├── src/                   # Source code directory (TypeScript)
│   ├── background/        # Background scripts and services
│   ├── popup/             # Popup React application source
│   ├── options/           # Options React application source
│   ├── shared/            # Shared code and types
│   └── ...
├── tests/                 # Tests directory
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
└── CONTRIBUTING.md        # Contribution guidelines
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
