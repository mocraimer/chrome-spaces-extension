import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../../../popup/hooks/useKeyboardNavigation';
import { createMockKeyboardEvent } from '../../utils/testUtils';

describe('useKeyboardNavigation Hook', () => {
  const mockSpaces = {
    '1': { id: '1', name: 'Space 1', urls: [], lastModified: Date.now(), named: false, version: 1 },
    '2': { id: '2', name: 'Space 2', urls: [], lastModified: Date.now(), named: false, version: 1 },
    '3': { id: '3', name: 'Space 3', urls: [], lastModified: Date.now(), named: false, version: 1 }
  };

  const mockClosedSpaces = {
    '4': { id: '4', name: 'Closed Space 1', urls: [], lastModified: Date.now(), named: false, version: 1 }
  };

  let mockState: any;
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  const { mockDispatch } = global as any;

  const simulateKeyPress = (key: string) => {
    if (keydownHandler) {
      keydownHandler(createMockKeyboardEvent({ key }));
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    keydownHandler = null;

    // Setup document event listeners
    document.addEventListener = jest.fn((event: string, handler: EventListener) => {
      if (event === 'keydown') {
        keydownHandler = handler as (event: KeyboardEvent) => void;
      }
    });
    document.removeEventListener = jest.fn();
    
    mockDispatch.mockClear();
    mockState = {
      spaces: {
        selectedSpaceId: null,
        spaces: mockSpaces,
        closedSpaces: mockClosedSpaces
      }
    };

    // Create a selector that will always use the latest state
    const selectorMock = jest.fn((selector) => selector(mockState));
    
    // Reset and mock Redux store with state updates
    jest.resetModules();
    jest.mock('../../../popup/store', () => ({
      __esModule: true,
      useAppDispatch: () => mockDispatch,
      useAppSelector: (selector: any) => selectorMock(selector)
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.useRealTimers();
  });

  it('should navigate through spaces with arrow keys', () => {
    // Start with initial state set
    mockState.spaces.selectedSpaceId = '1';
    
    renderHook(() => useKeyboardNavigation({ 
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery: ''
    }));

    mockDispatch.mockClear();

    // Navigate to next space
    act(() => {
      simulateKeyPress('ArrowDown');
    });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'spaces/selectSpace',
      payload: '2'
    });

    // Update mock state to reflect the change
    mockState.spaces.selectedSpaceId = '2';
    mockDispatch.mockClear();

    // Navigate back
    act(() => {
      simulateKeyPress('ArrowUp');
    });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'spaces/selectSpace',
      payload: '1'
    });
  });

  it('should handle search filtering', () => {
    mockState.spaces.selectedSpaceId = '1';
    
    const { rerender } = renderHook(({ searchQuery }) => useKeyboardNavigation({ 
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery
    }), {
      initialProps: { searchQuery: '' }
    });

    // Apply search filter
    rerender({ searchQuery: 'Space 2' });

    // Selected space should update to match search
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'spaces/selectSpace',
      payload: '2'
    });

    // Navigate within filtered results
    mockDispatch.mockClear();
    act(() => {
      simulateKeyPress('ArrowDown');
    });

    // Should not change selection as only one result matches
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('should clear selection when no search results', () => {
    mockState.spaces.selectedSpaceId = '1';
    
    const { rerender } = renderHook(({ searchQuery }) => useKeyboardNavigation({ 
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery
    }), {
      initialProps: { searchQuery: '' }
    });

    // Apply search with no matches
    rerender({ searchQuery: 'no matches' });

    // Should clear selection
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'spaces/selectSpace',
      payload: ''
    });
  });

  it('should handle search focus', () => {
    const mockSearchInput = document.createElement('input');
    mockSearchInput.id = 'search-input';
    const div = document.createElement('div');
    div.appendChild(mockSearchInput);
    document.body.appendChild(div);

    try {
      renderHook(() => useKeyboardNavigation({
        spaces: mockSpaces,
        closedSpaces: mockClosedSpaces,
        searchQuery: ''
      }));

      // Focus search
      act(() => {
        simulateKeyPress('/');
      });

      expect(document.activeElement).toBe(mockSearchInput);

      // Blur search
      act(() => {
        simulateKeyPress('Escape');
      });

      expect(document.activeElement).not.toBe(mockSearchInput);
    } finally {
      document.body.removeChild(div);
    }
  });

  it('should clear selection on Escape', () => {
    // Initialize with selection
    mockState.spaces.selectedSpaceId = '1';
    renderHook(() => useKeyboardNavigation({
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery: ''
    }));

    mockDispatch.mockClear();

    // Clear selection
    act(() => {
      simulateKeyPress('Escape');
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'spaces/selectSpace',
      payload: ''
    });
  });
});