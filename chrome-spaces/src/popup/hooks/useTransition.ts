import { useState, useCallback, useEffect, useRef } from 'react';

interface TransitionOptions {
  duration?: number;
  delay?: number;
  onComplete?: () => void;
  timingFunction?: string;
}

interface TransitionState {
  isActive: boolean;
  isVisible: boolean;
  styles: {
    opacity: number;
    transform: string;
    transition: string;
  };
}

export function useTransition(options: TransitionOptions = {}) {
  const {
    duration = 200,
    delay = 0,
    onComplete,
    timingFunction = 'ease'
  } = options;

  const [state, setState] = useState<TransitionState>({
    isActive: false,
    isVisible: false,
    styles: {
      opacity: 0,
      transform: 'translateY(-10px)',
      transition: `all ${duration}ms ${timingFunction} ${delay}ms`
    }
  });

  const timeoutRef = useRef<NodeJS.Timeout>();

  const enter = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start enter transition
    setState(prev => ({
      ...prev,
      isActive: true,
      isVisible: true,
      styles: {
        ...prev.styles,
        opacity: 1,
        transform: 'translateY(0)'
      }
    }));

    // Call onComplete after transition
    timeoutRef.current = setTimeout(() => {
      onComplete?.();
    }, duration + delay);
  }, [duration, delay, onComplete]);

  const exit = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start exit transition
    setState(prev => ({
      ...prev,
      isActive: false,
      styles: {
        ...prev.styles,
        opacity: 0,
        transform: 'translateY(-10px)'
      }
    }));

    // Remove from DOM after transition
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isVisible: false
      }));
      onComplete?.();
    }, duration + delay);
  }, [duration, delay, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    enter,
    exit,
    isActive: state.isActive,
    isVisible: state.isVisible,
    styles: state.styles
  };
}

// Example usage:
// const MyComponent: React.FC = () => {
//   const transition = useTransition({
//     duration: 300,
//     onComplete: () => console.log('Transition complete')
//   });
//
//   useEffect(() => {
//     transition.enter();
//   }, []);
//
//   if (!transition.isVisible) return null;
//
//   return (
//     <div style={transition.styles}>
//       Content
//     </div>
//   );
// };
