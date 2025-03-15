import { useState, useCallback } from 'react';
import { Space } from '@/shared/types/Space';

interface ClipboardData {
  type: 'space' | 'tabs' | 'urls';
  data: Space | string[] | Record<string, any>;
  timestamp: number;
}

interface UseClipboardOptions {
  onCopy?: (data: ClipboardData) => void;
  onPaste?: (data: ClipboardData) => void;
  onError?: (error: Error) => void;
}

const CLIPBOARD_KEY = 'chrome-spaces-clipboard';

export function useClipboard(options: UseClipboardOptions = {}) {
  const { onCopy, onPaste, onError } = options;
  const [lastOperation, setLastOperation] = useState<{
    type: 'copy' | 'paste' | null;
    timestamp: number;
  }>({
    type: null,
    timestamp: 0
  });

  // Write to clipboard
  const copyToClipboard = useCallback(async (
    data: Omit<ClipboardData, 'timestamp'>
  ) => {
    try {
      const clipboardData: ClipboardData = {
        ...data,
        timestamp: Date.now()
      };

      // Store in extension's clipboard
      await chrome.storage.local.set({
        [CLIPBOARD_KEY]: clipboardData
      });

      // Also copy to system clipboard if it's URLs
      if (data.type === 'urls' && Array.isArray(data.data)) {
        const urlText = (data.data as string[]).join('\n');
        await navigator.clipboard.writeText(urlText);
      }

      setLastOperation({
        type: 'copy',
        timestamp: Date.now()
      });

      onCopy?.(clipboardData);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to copy');
      onError?.(err);
      throw err;
    }
  }, [onCopy, onError]);

  // Read from clipboard
  const readFromClipboard = useCallback(async <T extends ClipboardData['type']>(
    expectedType?: T
  ): Promise<ClipboardData | null> => {
    try {
      const result = await chrome.storage.local.get(CLIPBOARD_KEY);
      const clipboardData = result[CLIPBOARD_KEY] as ClipboardData | undefined;

      if (!clipboardData) return null;

      if (expectedType && clipboardData.type !== expectedType) {
        throw new Error(`Expected clipboard data of type ${expectedType}`);
      }

      return clipboardData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to read clipboard');
      onError?.(err);
      throw err;
    }
  }, [onError]);

  // Paste operation
  const paste = useCallback(async <T extends ClipboardData['type']>(
    expectedType?: T
  ): Promise<ClipboardData['data'] | null> => {
    try {
      const clipboardData = await readFromClipboard(expectedType);
      
      if (!clipboardData) return null;

      setLastOperation({
        type: 'paste',
        timestamp: Date.now()
      });

      onPaste?.(clipboardData);
      return clipboardData.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to paste');
      onError?.(err);
      throw err;
    }
  }, [readFromClipboard, onPaste, onError]);

  // Clear clipboard
  const clearClipboard = useCallback(async () => {
    try {
      await chrome.storage.local.remove(CLIPBOARD_KEY);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to clear clipboard');
      onError?.(err);
      throw err;
    }
  }, [onError]);

  // Helper for copying URLs
  const copyUrls = useCallback(async (urls: string[]) => {
    return copyToClipboard({
      type: 'urls',
      data: urls
    });
  }, [copyToClipboard]);

  // Helper for copying a space
  const copySpace = useCallback(async (space: Space) => {
    return copyToClipboard({
      type: 'space',
      data: space
    });
  }, [copyToClipboard]);

  // Helper for copying tabs
  const copyTabs = useCallback(async (tabs: chrome.tabs.Tab[]) => {
    return copyToClipboard({
      type: 'tabs',
      data: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        muted: tab.mutedInfo?.muted
      }))
    });
  }, [copyToClipboard]);

  return {
    copyToClipboard,
    readFromClipboard,
    paste,
    clearClipboard,
    copyUrls,
    copySpace,
    copyTabs,
    lastOperation
  };
}

// Example usage:
/*
const MyComponent: React.FC = () => {
  const { copySpace, paste, lastOperation } = useClipboard({
    onCopy: (data) => {
      console.log('Copied to clipboard:', data);
    },
    onPaste: (data) => {
      console.log('Pasted from clipboard:', data);
    },
    onError: (error) => {
      console.error('Clipboard operation failed:', error);
    }
  });

  const handleCopySpace = async (space: Space) => {
    await copySpace(space);
    // Show success notification
  };

  const handlePaste = async () => {
    const data = await paste('space');
    if (data) {
      // Handle pasted space data
    }
  };

  return (
    <div>
      <button onClick={() => handleCopySpace(someSpace)}>
        Copy Space
      </button>
      <button onClick={handlePaste}>
        Paste Space
      </button>
      {lastOperation.type && (
        <div>
          Last operation: {lastOperation.type} at{' '}
          {new Date(lastOperation.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};
*/
