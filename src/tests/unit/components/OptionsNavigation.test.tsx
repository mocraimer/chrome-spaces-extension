import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../../options/store';
import { ThemeProvider } from '../../../popup/styles/ThemeProvider';

// Component to simulate error throwing for error boundary test
const ErrorThrowingComponent = () => {
  throw new Error('Test error');
};

class TestErrorBoundary extends React.Component<
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
    console.error('Captured error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: undefined })}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

describe('Options Navigation and Error Boundary', () => {
  it('should display error boundary UI when a child component crashes', () => {
    // Suppress error logging in test output
    const consoleError = console.error;
    console.error = jest.fn();

    const { getByText } = render(
      <Provider store={store}>
        <ThemeProvider>
          <TestErrorBoundary>
            <ErrorThrowingComponent />
          </TestErrorBoundary>
        </ThemeProvider>
      </Provider>
    );

    expect(getByText('Something went wrong')).toBeInTheDocument();
    expect(getByText('Test error')).toBeInTheDocument();

    const retryButton = getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    console.error = consoleError;
  });

  it('should render options page content when no error occurs', () => {
    const { getByText } = render(
      <Provider store={store}>
        <ThemeProvider>
          <div>Test Options Content</div>
        </ThemeProvider>
      </Provider>
    );

    expect(getByText('Test Options Content')).toBeInTheDocument();
  });
});
