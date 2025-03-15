import { useState, useEffect, useCallback } from 'react';

interface WindowState {
  isFocused: boolean;
  isVisible: boolean;
  lastFocusTime: number;
  lastVisibilityChange: number;
}

export function useWindowFocus(onBlur?: () => void) {
  const [windowState, setWindowState] = useState<WindowState>({
    isFocused: document.hasFocus(),
    isVisible: !document.hidden,
    lastFocusTime: Date.now(),
    lastVisibilityChange: Date.now()
  });

  // Handle focus events
  const handleFocus = useCallback(() => {
    setWindowState(prev => ({
      ...prev,
      isFocused: true,
      lastFocusTime: Date.now()
    }));
  }, []);

  const handleBlur = useCallback(() => {
    setWindowState(prev => ({
      ...prev,
      isFocused: false,
      lastFocusTime: Date.now()
    }));

    // Call optional onBlur callback
    onBlur?.();
  }, [onBlur]);

  // Handle visibility events
  const handleVisibilityChange = useCallback(() => {
    setWindowState(prev => ({
      ...prev,
      isVisible: !document.hidden,
      lastVisibilityChange: Date.now()
    }));

    // If document becomes hidden, treat as blur
    if (document.hidden) {
      handleBlur();
    }
  }, [handleBlur]);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleFocus, handleBlur, handleVisibilityChange]);

  // Track time since last interaction
  const timeSinceLastFocus = useCallback(() => {
    return Date.now() - windowState.lastFocusTime;
  }, [windowState.lastFocusTime]);

  const timeSinceLastVisibilityChange = useCallback(() => {
    return Date.now() - windowState.lastVisibilityChange;
  }, [windowState.lastVisibilityChange]);

  // Check if window has been inactive for a certain duration
  const hasBeenInactiveFor = useCallback((duration: number) => {
    return !windowState.isFocused && timeSinceLastFocus() >= duration;
  }, [windowState.isFocused, timeSinceLastFocus]);

  // Check if window has been hidden for a certain duration
  const hasBeenHiddenFor = useCallback((duration: number) => {
    return !windowState.isVisible && timeSinceLastVisibilityChange() >= duration;
  }, [windowState.isVisible, timeSinceLastVisibilityChange]);

  return {
    ...windowState,
    timeSinceLastFocus,
    timeSinceLastVisibilityChange,
    hasBeenInactiveFor,
    hasBeenHiddenFor
  };
}

// Example usage:
/*
const MyComponent: React.FC = () => {
  const { isFocused, isVisible, hasBeenInactiveFor } = useWindowFocus(() => {
    // Optional blur callback
    console.log('Window lost focus');
  });

  useEffect(() => {
    // Check if window has been inactive for 5 minutes
    if (hasBeenInactiveFor(5 * 60 * 1000)) {
      // Do something...
    }
  }, [hasBeenInactiveFor]);

  return (
    <div>
      Window is {isFocused ? 'focused' : 'blurred'} and
      {isVisible ? 'visible' : 'hidden'}
    </div>
  );
};
*/
