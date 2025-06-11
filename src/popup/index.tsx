import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import UnifiedPopup from './components/UnifiedPopup';
import { ThemeProvider } from './styles/ThemeProvider';
import { store } from './store/index';

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

// Removed custom StoreContext, useStore, and StoreProvider

// App component with providers
const App: React.FC = () => (
  <ErrorBoundary>
    <Provider store={store}>
      <ThemeProvider>
        <UnifiedPopup />
      </ThemeProvider>
    </Provider>
  </ErrorBoundary>
);

// Development logging
console.log('Initializing popup...');
console.log('Store state:', store.getState());

// Initialize app
const container = document.getElementById('root');
if (!container) {
  console.error('Failed to find root element');
  throw new Error('Root element not found');
}

// Debug logging for React initialization
try {
  console.log('Creating React root...');
  const root = createRoot(container);
  console.log('Rendering app...');
  root.render(
    <React.StrictMode>
      <React.Suspense fallback={<div>Loading...</div>}>
        <ErrorBoundary>
          <div id="redux-error-container">
            {/* Debug info */}
            <script dangerouslySetInnerHTML={{
              __html: `
                window.addEventListener('error', function(event) {
                  console.error('Global error caught:', event.error);
                  document.getElementById('redux-error-container').textContent =
                    'Redux Error: ' + event.error.message;
                });
                window.addEventListener('unhandledrejection', function(event) {
                  console.error('Unhandled promise rejection:', event.reason);
                });
              `
            }} />
            <App />
          </div>
        </ErrorBoundary>
      </React.Suspense>
    </React.StrictMode>
  );
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to initialize app:', error);
  throw error;
}

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
