export const globalStyles = `
  /* Reset */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    font-family: var(--font-family);
    font-size: var(--font-size-md);
    color: var(--text-primary);
    background-color: var(--background-primary);
    line-height: 1.5;
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    font-weight: var(--font-weight-bold);
    line-height: 1.2;
  }

  /* Links */
  a {
    color: var(--primary-color);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  a:hover {
    color: var(--primary-color-dark);
  }

  /* Buttons */
  button {
    font-family: inherit;
    font-size: inherit;
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    transition: all var(--transition-fast);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Inputs */
  input {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--background-primary);
    transition: border-color var(--transition-fast);
  }

  input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  /* Lists */
  ul, ol {
    list-style: none;
  }

  /* Utility Classes */
  .text-ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flex {
    display: flex;
  }

  .flex-col {
    flex-direction: column;
  }

  .items-center {
    align-items: center;
  }

  .justify-between {
    justify-content: space-between;
  }

  .gap-xs {
    gap: var(--spacing-xs);
  }

  .gap-sm {
    gap: var(--spacing-sm);
  }

  .gap-md {
    gap: var(--spacing-md);
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      transform: translateY(-10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--background-secondary);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }

  /* Focus outline */
  :focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  /* Common Components */
  .card {
    background: var(--background-primary);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-md);
    box-shadow: var(--shadow-sm);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    background: var(--background-secondary);
    color: var(--text-secondary);
  }

  /* Dark mode overrides */
  @media (prefers-color-scheme: dark) {
    html {
      color-scheme: dark;
    }
  }
`;

// Function to inject global styles
export function injectGlobalStyles(): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = globalStyles;
  document.head.appendChild(styleElement);
}
