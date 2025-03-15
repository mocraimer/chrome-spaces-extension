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

- The extension is built using **TypeScript** and **React**.
- Code formatting is handled by Prettier.
- Linting is done with ESLint.
- Use `npm run format` to format code: `npm run format`
- Use `npm run lint` to check for issues: `npm run lint`
- Use `npm run build` to create a production build: `npm run build`
- Use `npm run dev` to start the development server and watch for changes: `npm run dev`
- Run tests using `npm run test`

## Project Structure

```
chrome-spaces/
├── background.js           # Service worker entry point (Manifest V3) - Deprecated, use src/background/index.ts instead
├── popup/                # Popup UI - React application
│   ├── popup.html          # Popup HTML file
│   ├── popup.css           # Popup styles (CSS)
│   └── popup.js            # Popup entry point - Deprecated, use src/popup/index.tsx instead
├── options/              # Options page - React application
│   ├── options.html        # Options HTML file
│   ├── options.css         # Options styles (CSS)
│   └── options.js          # Options entry point - Deprecated, use src/options/index.tsx instead
├── icons/                # Extension icons
├── src/                  # Source code directory
│   ├── background/         # Background scripts and services (Typescript)
│   │   ├── index.ts        # Background service entry point
│   │   ├── services/       # Background services (e.g., StateManager, TabManager)
│   │   └── ...
│   ├── popup/              # Popup React application (Typescript, React)
│   │   ├── index.tsx       # Popup React entry point
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # Zustand store for state management
│   │   └── ...
│   ├── options/            # Options React application (Typescript, React) - if options page is used
│   │   └── ...
│   ├── shared/             # Shared code (Typescript)
│   │   ├── types/          # Shared types and interfaces
│   │   ├── utils/          # Utility functions
│   │   └── constants.ts    # Shared constants
│   └── ...
├── tests/                # Tests directory
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── .eslintrc.json          # ESLint configuration
├── .prettierrc             # Prettier configuration
├── tsconfig.json           # TypeScript configuration
├── webpack.config.js       # Webpack configuration
├── package.json            # npm package file
└── README.md               # Project README
```

## Core Components

### Background Script (src/background/index.ts)
- **TypeScript** service worker script.
- Manages the state of spaces using services like `StateManager`, `TabManager`, and `WindowManager`.
- Handles window and tab events using Chrome Extension APIs.
- Persists extension state and data to `chrome.storage.local` using `StorageManager`.
- Communicates with popup and options pages via `MessageHandler`.

### Popup (src/popup/index.tsx)
- **React** application written in **TypeScript**.
- Main user interface for interacting with spaces.
- Displays lists of active and closed spaces using React components in `src/popup/components`.
- Implements space switching, tab movement, search, and keyboard navigation using React hooks in `src/popup/hooks`.
- Manages UI state using Zustand store in `src/popup/store`.

### Options (src/options/index.tsx)
- **React** application written in **TypeScript** (if options page is used).
- Configuration interface for customizing extension behavior.
- May include import/export functionality and data management tools.
- Implemented using React components and hooks similar to the popup.

## Commit Guidelines

- Use clear, descriptive commit messages.
- Start with a verb in the present tense (e.g., "Add feature" not "Added feature").
- Reference issue numbers when applicable.

## Pull Request Process

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run formatting and linting checks: `npm run format` and `npm run lint`.
5. Ensure tests pass: `npm run test`.
6. Submit a pull request.
7. Include a clear description of changes.

## Testing

- **Unit Tests**: Located in `src/tests/unit`. Use Jest to test individual services, components, and utility functions in isolation.
- **Integration Tests**: Located in `src/tests/integration`. Test interactions between different modules and services.
- **End-to-End Tests**: Located in `src/tests/e2e`. Use Playwright or Cypress to test user workflows and UI interactions in a browser environment.
- Test changes in Chrome with different window configurations.
- Verify space persistence across browser restarts.
- Check keyboard shortcuts functionality.
- Test error handling scenarios.

## Code Style

- Use **TypeScript** for all new code.
- Follow **React** best practices for component structure and state management.
- Use modern JavaScript/TypeScript features (ES2021+).
- Follow existing naming conventions.
- Add JSDoc comments for functions and components.
- Keep functions and components focused and concise.
- Use meaningful variable and component names.
- Use Prettier for code formatting and ESLint for linting.

## Additional Notes

- The extension uses Chrome API's: `chrome.windows`, `chrome.tabs`, `chrome.storage`, and others.
- Prefer `async/await` over callbacks for asynchronous operations.
- Handle errors gracefully with appropriate user feedback.
- Consider performance implications when managing many tabs/windows.
- Use Zustand for state management in React components.
- Use React hooks for managing component logic and side effects.

## Questions?

Feel free to open an issue for questions or send a pull request with improvements to this guide.
