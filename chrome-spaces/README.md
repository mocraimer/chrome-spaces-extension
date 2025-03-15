# Chrome Spaces

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/chrome-spaces/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)

Chrome Spaces is a workspace manager for Chrome that treats each browser window as a different named workspace, helping you organize your tabs and manage multiple projects efficiently. Inspired by [Spaces](https://github.com/deanoemcke/spaces) by Dean Oemcke, this extension has been rebuilt with modern Chrome APIs and enhanced features.

## Features

- Name and save Chrome windows as "spaces"
- Quick switching between workspaces using keyboard shortcuts
- Easily restore closed workspaces with all their tabs
- Move tabs between different spaces
- Fast fuzzy search for spaces with keyboard navigation
- Track tabs opened and closed within each workspace
- Configurable settings and keyboard shortcuts

## Installation

### From Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The Chrome Spaces extension should now be installed and visible in your toolbar

### From Chrome Web Store

*(Coming soon)*

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
├── manifest.json          # Extension manifest
├── background.js          # Background script for managing windows and tabs
├── popup/                 # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/               # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/                 # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building for Production

For production deployment, simply zip the entire directory.

## Contributing

Contributions are welcome! Feel free to submit pull requests or report issues.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
