import { useEffect, useCallback, useRef } from 'react';

type KeyCombo = string; // Format: 'ctrl+k', 'shift+/', etc.
type HotkeyHandler = (event: KeyboardEvent) => void;

interface HotkeyMap {
  [key: KeyCombo]: HotkeyHandler;
}

interface HotkeyOptions {
  ignoreInput?: boolean; // Whether to ignore hotkeys when typing in input elements
  preventDefault?: boolean; // Whether to prevent default browser behavior
  onError?: (error: Error) => void; // Error handler
  onPopupToggle?: () => void; // Handler for popup toggle hotkey
}

// Parse key combo string into parts
function _parseKeyCombo(combo: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean } {
  const parts = combo.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command')
  };
}

// Convert event to normalized key string
function eventToKeyString(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  const parts: string[] = [];

  if (event.ctrlKey) parts.push('ctrl');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  if (event.metaKey) parts.push('meta');

  parts.push(key);
  return parts.join('+');
}

export function useHotkeys(
  hotkeys: HotkeyMap,
  options: HotkeyOptions = {}
) {
  const {
    ignoreInput = true,
    preventDefault = true,
    onError,
    onPopupToggle
  } = options;

  // Store hotkeys in a ref to avoid unnecessary effect triggers
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  // Handler for keydown events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    try {
      // Ignore if target is an input element and ignoreInput is true
      if (ignoreInput && (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable
      )) {
        return;
      }

      const keyString = eventToKeyString(event);

      // Handle popup toggle hotkey if defined
      if ((keyString === 'ctrl+shift+space' || keyString === 'meta+shift+space') && onPopupToggle) {
        if (preventDefault) {
          event.preventDefault();
        }
        onPopupToggle();
        return;
      }

      const handler = hotkeysRef.current[keyString];

      if (handler) {
        if (preventDefault) {
          event.preventDefault();
        }
        handler(event);
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      } else {
        console.error('Hotkey error:', error);
      }
    }
  }, [ignoreInput, preventDefault, onError, onPopupToggle]);

  // Set up event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Helper to register new hotkeys
  const registerHotkey = useCallback((
    combo: KeyCombo,
    handler: HotkeyHandler
  ) => {
    hotkeysRef.current = {
      ...hotkeysRef.current,
      [combo]: handler
    };
  }, []);

  // Helper to unregister hotkeys
  const unregisterHotkey = useCallback((combo: KeyCombo) => {
    const { [combo]: _removed, ...rest } = hotkeysRef.current;
    hotkeysRef.current = rest;
  }, []);

  return {
    registerHotkey,
    unregisterHotkey
  };
}

// Example usage:
/*
const MyComponent: React.FC = () => {
  const { registerHotkey } = useHotkeys({
    'ctrl+s': (event) => {
      console.log('Save triggered');
      // Save operation...
    },
    'ctrl+shift+f': (event) => {
      console.log('Find triggered');
      // Open find dialog...
    }
  }, {
    ignoreInput: true,
    preventDefault: true,
    onError: (error) => {
      console.error('Hotkey error:', error);
    },
    onPopupToggle: () => {
      console.log('Popup toggle triggered');
      // Toggle popup display...
    }
  });

  // Register dynamic hotkeys
  useEffect(() => {
    registerHotkey('ctrl+n', () => {
      console.log('New item');
    });
  }, [registerHotkey]);

  return <div>Component content...</div>;
};
*/

// Create a predefined set of application hotkeys
export const createAppHotkeys = (handlers: {
  onSearch?: () => void;
  onNewSpace?: () => void;
  onSwitchSpace?: (index: number) => void;
  onClose?: () => void;
  onHelp?: () => void;
}): HotkeyMap => ({
  '/': (_e) => handlers.onSearch?.(),
  'ctrl+n': (_e) => handlers.onNewSpace?.(),
  'ctrl+w': (_e) => handlers.onClose?.(),
  '?': (_e) => handlers.onHelp?.(),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((acc, num) => ({
    ...acc,
    [`ctrl+${num}`]: () => handlers.onSwitchSpace?.(num - 1)
  }), {})
});
