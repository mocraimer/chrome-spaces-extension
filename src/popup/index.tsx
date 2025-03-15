import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './components/Popup';
import { ThemeProvider } from './styles/ThemeProvider';
import { store } from './store';

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
    console.error('Popup error:', error, errorInfo);
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

// StoreContext and hook
const StoreContext = React.createContext(store);

export const useStore = () => {
  const context = React.useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

// StoreProvider component
const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StoreContext.Provider value={store}>
    {children}
  </StoreContext.Provider>
);

// App component with providers
const App: React.FC = () => (
  <ErrorBoundary>
    <StoreProvider>
      <ThemeProvider>
        <Popup />
      </ThemeProvider>
    </StoreProvider>
  </ErrorBoundary>
);

// Initialize app
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(<App />);

// Error boundary styles
const styles = `
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
  }

  .retry-button:hover {
    background-color: var(--primary-color-dark);
  }
`;

// Inject error boundary styles
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
