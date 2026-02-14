# Privacy Policy — Chrome Spaces

**Last updated:** February 14, 2026

## Overview

Chrome Spaces is a browser extension that helps you organize Chrome windows as named workspaces. Your privacy is important to us — this extension is designed to work entirely locally on your device.

## Data Collection

**Chrome Spaces does not collect, transmit, or share any user data.** Specifically:

- **No personal information** is collected
- **No browsing history** is tracked or recorded beyond what the extension needs to display your current spaces
- **No analytics or telemetry** data is sent to any server
- **No third-party services** are used
- **No cookies** are set
- **No network requests** are made by the extension

## Data Storage

All extension data (space names, tab URLs, window configurations) is stored **locally on your device** using:

- **IndexedDB** — for persistent space data
- **Chrome Storage API** — for extension settings

This data never leaves your browser and is only accessible by the extension itself.

## Permissions

Chrome Spaces requests the following browser permissions, used solely for core functionality:

| Permission | Purpose |
|---|---|
| `tabs` | Read tab URLs and titles to display and manage spaces |
| `windows` | Create, close, and switch between browser windows |
| `storage` | Save and retrieve space data locally |
| `commands` | Register keyboard shortcuts for space navigation |
| `downloads` | Export spaces data as a JSON file to your computer |
| `system.display` | Arrange windows in a grid layout across your screen |

## Data Export

The extension provides a manual export feature that saves your spaces data as a JSON file to your local file system. This is entirely user-initiated and no data is sent to any external service.

## Changes to This Policy

If this privacy policy is updated, the changes will be reflected in the "Last updated" date at the top of this document and published to the extension's GitHub repository.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/mocraimer/chrome-spaces-extension).
