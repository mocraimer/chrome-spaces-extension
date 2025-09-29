import React, { Component, ErrorInfo, ReactNode } from 'react';
import { connect } from 'react-redux';
import { RootState } from '../store/types';
import { clearError, fetchSpaces } from '../store/slices/spacesSlice';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  // Redux props
  dispatch?: any;
  hasGlobalError?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  lastErrorTime: number;
}

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 1000; // 1 second
const ERROR_RESET_TIME = 30000; // 30 seconds

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    this.setState({
      error,
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    if (this.props.dispatch) {
      this.props.dispatch(clearError());
    }

    this.attemptRecovery(error);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.hasGlobalError && !this.props.hasGlobalError && this.state.hasError) {
      this.resetError();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private attemptRecovery = (error: Error) => {
    const { retryCount, lastErrorTime } = this.state;
    const now = Date.now();

    const adjustedRetryCount = now - lastErrorTime > ERROR_RESET_TIME ? 0 : retryCount;

    if (adjustedRetryCount < MAX_RETRY_COUNT) {
      console.log(`[ErrorBoundary] Attempting recovery, retry ${adjustedRetryCount + 1}/${MAX_RETRY_COUNT}`);

      this.retryTimeoutId = setTimeout(() => {
        this.performRecovery(error, adjustedRetryCount);
      }, RETRY_DELAY * (adjustedRetryCount + 1));
    } else {
      console.error('[ErrorBoundary] Max retry attempts reached, manual intervention required');
    }
  };

  private performRecovery = async (error: Error, currentRetryCount: number) => {
    try {
      if (this.isNetworkError(error)) {
        await this.recoverFromNetworkError();
      } else if (this.isStateError(error)) {
        await this.recoverFromStateError();
      } else {
        await this.genericRecovery();
      }

      console.log('[ErrorBoundary] Recovery successful, resetting error boundary');
      this.resetError();
    } catch (recoveryError) {
      console.error('[ErrorBoundary] Recovery failed:', recoveryError);

      this.setState({
        retryCount: currentRetryCount + 1
      });

      if (currentRetryCount + 1 < MAX_RETRY_COUNT) {
        this.attemptRecovery(error);
      }
    }
  };

  private isNetworkError = (error: Error): boolean => {
    return error.message.includes('network') ||
           error.message.includes('fetch') ||
           error.message.includes('chrome.runtime');
  };

  private isStateError = (error: Error): boolean => {
    return error.message.includes('state') ||
           error.message.includes('redux') ||
           error.message.includes('spaces');
  };

  private recoverFromNetworkError = async (): Promise<void> => {
    if (this.props.dispatch) {
      this.props.dispatch(clearError());
      await this.props.dispatch(fetchSpaces());
    }
  };

  private recoverFromStateError = async (): Promise<void> => {
    if (this.props.dispatch) {
      this.props.dispatch(clearError());
      await this.props.dispatch(fetchSpaces());
    }
  };

  private genericRecovery = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (this.props.dispatch) {
      await this.props.dispatch(fetchSpaces());
    }
  };

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  private handleManualRetry = () => {
    if (this.state.error) {
      console.log('[ErrorBoundary] Manual retry requested');
      this.setState({ retryCount: 0 });
      this.performRecovery(this.state.error, 0);
    }
  };

  private handleResetApp = () => {
    if (this.props.dispatch) {
      this.props.dispatch(clearError());
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          margin: '10px'
        }}>
          <h3 style={{ color: '#d32f2f', marginBottom: '16px' }}>
            Something went wrong
          </h3>

          <p style={{ marginBottom: '16px', fontSize: '14px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>

          <div style={{ marginBottom: '16px' }}>
            {this.state.retryCount < MAX_RETRY_COUNT ? (
              <p style={{ fontSize: '12px', color: '#888' }}>
                Attempting automatic recovery... (Retry {this.state.retryCount + 1}/{MAX_RETRY_COUNT})
              </p>
            ) : (
              <p style={{ fontSize: '12px', color: '#d32f2f' }}>
                Automatic recovery failed. Please try manual recovery.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={this.handleManualRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              disabled={this.state.retryCount >= MAX_RETRY_COUNT}
            >
              Retry
            </button>

            <button
              onClick={this.handleResetApp}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Reset Extension
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ marginTop: '16px', textAlign: 'left', fontSize: '11px' }}>
              <summary>Error Details (Development)</summary>
              <pre style={{
                whiteSpace: 'pre-wrap',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.error?.stack}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

const mapStateToProps = (state: RootState) => ({
  hasGlobalError: !!state.spaces.error
});

export default connect(mapStateToProps)(ErrorBoundary);