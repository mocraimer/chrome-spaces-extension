import { useState, useCallback, useRef, useEffect } from 'react';

interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
  onTimeout?: () => void;
  onError?: (error: Error) => void;
}

interface RequestState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  attempt: number;
}

export function useRequest<T>(
  requestFn: () => Promise<T>,
  options: RequestOptions = {}
) {
  const {
    timeout = 5000,
    retries = 3,
    retryDelay = 1000,
    onRetry,
    onTimeout,
    onError
  } = options;

  const [state, setState] = useState<RequestState<T>>({
    data: null,
    error: null,
    isLoading: false,
    attempt: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Handle component unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Create safe setState that checks if component is mounted
  const safeSetState = useCallback((updates: Partial<RequestState<T>>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Execute request with retries
  const executeRequest = useCallback(async (attempt: number = 0): Promise<T> => {
    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
        onTimeout?.();
      }, timeout);

      // Execute request
      const response = await requestFn();

      // Clear timeout if request succeeded
      clearTimeout(timeoutId);

      return response;
    } catch (error) {
      // If we have retries remaining and it's not an abort error, retry
      if (
        attempt < retries &&
        !(error instanceof Error && error.name === 'AbortError')
      ) {
        // Notify of retry
        if (error instanceof Error) {
          onRetry?.(error, attempt + 1);
        }

        // Wait for retry delay
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Retry request
        return executeRequest(attempt + 1);
      }

      // No more retries or abort error, throw
      throw error;
    }
  }, [requestFn, timeout, retries, retryDelay, onRetry, onTimeout]);

  // Execute request with state management
  const execute = useCallback(async () => {
    cleanup();

    safeSetState({
      isLoading: true,
      error: null,
      attempt: 0
    });

    try {
      const data = await executeRequest();
      safeSetState({
        data,
        isLoading: false
      });
      return data;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      safeSetState({
        error: errorObj,
        isLoading: false
      });
      onError?.(errorObj);
      throw errorObj;
    }
  }, [executeRequest, cleanup, safeSetState, onError]);

  // Abort current request
  const abort = useCallback(() => {
    cleanup();
    safeSetState({
      isLoading: false
    });
  }, [cleanup, safeSetState]);

  return {
    execute,
    abort,
    ...state
  };
}

// Helper for message requests
export function useMessageRequest<T>(
  action: string,
  options?: RequestOptions
) {
  return useRequest<T>(
    () => chrome.runtime.sendMessage({ action }),
    options
  );
}

// Example usage:
/*
const MyComponent: React.FC = () => {
  const {
    execute: fetchData,
    data,
    error,
    isLoading
  } = useMessageRequest('getData', {
    timeout: 3000,
    retries: 2,
    onRetry: (error, attempt) => {
      console.log(`Retrying request (${attempt}/2)...`);
    },
    onError: (error) => {
      console.error('Failed to fetch data:', error);
    }
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return <div>{JSON.stringify(data)}</div>;
};

// Or with custom request function:
const useCustomRequest = () => {
  return useRequest(
    async () => {
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) throw new Error('Network error');
      return response.json();
    },
    {
      timeout: 5000,
      retries: 3
    }
  );
};
*/
