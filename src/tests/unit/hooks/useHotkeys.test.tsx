import { renderHook, act } from '@testing-library/react';
import { useHotkeys, createAppHotkeys } from '../../../popup/hooks/useHotkeys';
import { mockDocumentEventListeners, createMockKeyboardEvent } from '../../utils/testUtils';

describe('useHotkeys Hook', () => {
  const { eventMap, mockAddEventListener, mockRemoveEventListener } = mockDocumentEventListeners();

  beforeEach(() => {
    document.addEventListener = mockAddEventListener;
    document.removeEventListener = mockRemoveEventListener;
  });

  it('should register and trigger a simple hotkey', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => useHotkeys({
      'a': handler
    }));

    // Simulate keydown event
    act(() => {
      eventMap.keydown(createMockKeyboardEvent({ key: 'a' }));
    });

    expect(handler).toHaveBeenCalled();
  });

  it('should handle modifier key combinations', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => useHotkeys({
      'ctrl+s': handler
    }));

    act(() => {
      eventMap.keydown(createMockKeyboardEvent({ 
        key: 's',
        ctrlKey: true
      }));
    });

    expect(handler).toHaveBeenCalled();
  });

  it('should ignore hotkeys in input elements when ignoreInput is true', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => useHotkeys({
      'a': handler
    }, { ignoreInput: true }));

    act(() => {
      eventMap.keydown(createMockKeyboardEvent({
        key: 'a',
        target: document.createElement('input')
      }));
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should prevent default when preventDefault option is true', () => {
    const handler = jest.fn();
    const mockEvent = createMockKeyboardEvent({ key: 'a' });
    
    const { result } = renderHook(() => useHotkeys({
      'a': handler
    }, { preventDefault: true }));

    act(() => {
      eventMap.keydown(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it('should handle errors with custom error handler', () => {
    const errorHandler = jest.fn();
    const handler = () => {
      throw new Error('Test error');
    };

    const { result } = renderHook(() => useHotkeys({
      'a': handler
    }, { onError: errorHandler }));

    act(() => {
      eventMap.keydown(createMockKeyboardEvent({ key: 'a' }));
    });

    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should dynamically register and unregister hotkeys', () => {
    const handler = jest.fn();
    const { result } = renderHook(() => useHotkeys({}));

    act(() => {
      result.current.registerHotkey('b', handler);
    });

    act(() => {
      eventMap.keydown(createMockKeyboardEvent({ key: 'b' }));
    });

    expect(handler).toHaveBeenCalled();

    act(() => {
      result.current.unregisterHotkey('b');
    });

    act(() => {
      eventMap.keydown(createMockKeyboardEvent({ key: 'b' }));
    });

    expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
  });
});

describe('createAppHotkeys', () => {
  const createTestEvent = (key: string, ctrl: boolean = false) => 
    createMockKeyboardEvent({ key, ctrlKey: ctrl });

  it('should create hotkeys for all application actions', () => {
    const handlers = {
      onSearch: jest.fn(),
      onNewSpace: jest.fn(),
      onClose: jest.fn(),
      onHelp: jest.fn(),
      onSwitchSpace: jest.fn()
    };

    const hotkeys = createAppHotkeys(handlers);

    // Test search hotkey
    hotkeys['/']?.(createTestEvent('/'));
    expect(handlers.onSearch).toHaveBeenCalled();

    // Test new space hotkey
    hotkeys['ctrl+n']?.(createTestEvent('n', true));
    expect(handlers.onNewSpace).toHaveBeenCalled();

    // Test close hotkey
    hotkeys['ctrl+w']?.(createTestEvent('w', true));
    expect(handlers.onClose).toHaveBeenCalled();

    // Test help hotkey
    hotkeys['?']?.(createTestEvent('?'));
    expect(handlers.onHelp).toHaveBeenCalled();

    // Test space switching hotkeys
    for (let i = 1; i <= 9; i++) {
      hotkeys[`ctrl+${i}`]?.(createTestEvent(String(i), true));
      expect(handlers.onSwitchSpace).toHaveBeenCalledWith(i - 1);
    }
  });

  it('should handle undefined handlers gracefully', () => {
    const hotkeys = createAppHotkeys({});

    // Should not throw when handlers are undefined
    expect(() => {
      hotkeys['/']?.(createTestEvent('/'));
      hotkeys['ctrl+n']?.(createTestEvent('n', true));
      hotkeys['ctrl+w']?.(createTestEvent('w', true));
      hotkeys['?']?.(createTestEvent('?'));
      hotkeys['ctrl+1']?.(createTestEvent('1', true));
    }).not.toThrow();
  });
});