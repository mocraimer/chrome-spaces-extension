import { useState, useEffect, useCallback, RefObject } from 'react';

interface PopupDimensions {
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
}

interface UsePopupSizeOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  margin?: number;
  contentRef: RefObject<HTMLElement>;
}

interface ScreenDimensions {
  width: number;
  height: number;
}

export function usePopupSize({
  minWidth = 350,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 600,
  margin = 20,
  contentRef
}: UsePopupSizeOptions) {
  const [dimensions, setDimensions] = useState<PopupDimensions>({
    width: minWidth,
    height: minHeight,
    maxWidth,
    maxHeight
  });

  // Get screen dimensions safely
  const getScreenDimensions = useCallback((): ScreenDimensions => {
    if (typeof visualViewport !== 'undefined' && visualViewport) {
      return {
        width: visualViewport.width,
        height: visualViewport.height
      };
    }
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };
  }, []);

  // Get available screen space
  const getAvailableSpace = useCallback(() => {
    const screen = getScreenDimensions();
    const availWidth = screen.width - margin * 2;
    const availHeight = screen.height - margin * 2;

    return {
      width: Math.min(availWidth, maxWidth),
      height: Math.min(availHeight, maxHeight)
    };
  }, [maxWidth, maxHeight, margin, getScreenDimensions]);

  // Calculate optimal dimensions based on content
  const calculateDimensions = useCallback(() => {
    if (!contentRef.current) return;

    const content = contentRef.current;
    const availableSpace = getAvailableSpace();

    // Get content size
    const contentWidth = content.scrollWidth;
    const contentHeight = content.scrollHeight;

    // Calculate optimal dimensions
    const optimalWidth = Math.max(
      minWidth,
      Math.min(contentWidth, availableSpace.width)
    );
    const optimalHeight = Math.max(
      minHeight,
      Math.min(contentHeight, availableSpace.height)
    );

    // Update dimensions if they've changed
    setDimensions(prev => {
      if (
        prev.width === optimalWidth &&
        prev.height === optimalHeight &&
        prev.maxWidth === availableSpace.width &&
        prev.maxHeight === availableSpace.height
      ) {
        return prev;
      }

      return {
        width: optimalWidth,
        height: optimalHeight,
        maxWidth: availableSpace.width,
        maxHeight: availableSpace.height
      };
    });

    // Update popup window size
    if (chrome.windows) {
      chrome.windows.getCurrent(window => {
        if (window?.id) {
          chrome.windows.update(window.id, {
            width: Math.round(optimalWidth),
            height: Math.round(optimalHeight)
          });
        }
      });
    }
  }, [contentRef, minWidth, minHeight, getAvailableSpace]);

  // Set up resize observer
  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver(() => {
      calculateDimensions();
    });

    observer.observe(contentRef.current);

    return () => observer.disconnect();
  }, [contentRef, calculateDimensions]);

  // Handle screen size changes
  useEffect(() => {
    const viewport = window.visualViewport;

    const handleResize = () => {
      calculateDimensions();
    };

    if (viewport) {
      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDimensions]);

  // Initial calculation
  useEffect(() => {
    calculateDimensions();
  }, [calculateDimensions]);

  // Center popup in screen
  const centerPopup = useCallback(async () => {
    if (!chrome.windows) return;

    const window = await chrome.windows.getCurrent();
    if (!window?.id) return;

    const screen = getScreenDimensions();
    const left = Math.round((screen.width - dimensions.width) / 2);
    const top = Math.round((screen.height - dimensions.height) / 2);

    await chrome.windows.update(window.id, {
      left: Math.max(0, left),
      top: Math.max(0, top)
    });
  }, [dimensions, getScreenDimensions]);

  return {
    dimensions,
    centerPopup,
    recalculate: calculateDimensions
  };
}

// Example usage:
/*
const PopupContent: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { dimensions } = usePopupSize({
    minWidth: 350,
    minHeight: 200,
    contentRef
  });

  return (
    <div
      ref={contentRef}
      style={{
        width: '100%',
        maxWidth: dimensions.maxWidth,
        maxHeight: dimensions.maxHeight,
        overflow: 'auto'
      }}
    >
      Content here...
    </div>
  );
};
*/
