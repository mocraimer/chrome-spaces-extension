import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '../popup/styles/ThemeProvider';
import OptionsLayout from './components/layout/OptionsLayout';
import { store } from './store';

const Options: React.FC = () => {
  return (
    <div className="options-content">
      <p>Configuration options will be available here.</p>
    </div>
  );
};

// Error Boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Options error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => (
  <ErrorBoundary>
    <Provider store={store}>
      <ThemeProvider>
        <OptionsLayout>
          <Options />
        </OptionsLayout>
      </ThemeProvider>
    </Provider>
  </ErrorBoundary>
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(<App />);

// Basic styles
const styles = `
  .options-content {
    padding: var(--spacing-lg);
    background-color: var(--background-secondary);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .error-boundary {
    padding: var(--spacing-lg);
    text-align: center;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
  }

  .error-boundary h2 {
    color: var(--error-color);
    margin-bottom: var(--spacing-sm);
  }

  .error-boundary p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .retry-button {
    background-color: var(--primary-color);
    color: white;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    font-weight: var(--font-weight-medium);
    border: none;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .retry-button:hover {
    background-color: var(--primary-color-dark);
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
