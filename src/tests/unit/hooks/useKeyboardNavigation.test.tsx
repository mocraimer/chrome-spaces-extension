import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { useKeyboardNavigation } from '../../../popup/hooks/useKeyboardNavigation';
import { createMockKeyboardEvent } from '../../utils/testUtils';
import { selectSpace, switchToSpace, restoreSpace } from '../../../popup/store/slices/spacesSlice';

const mockStore = configureStore([]);

// Mock the action creators
jest.mock('../../../popup/store/slices/spacesSlice', () => ({
  selectSpace: jest.fn((payload) => ({ type: 'spaces/selectSpace', payload })),
  switchToSpace: jest.fn((payload) => ({ type: 'spaces/switchToSpace', payload })),
  restoreSpace: jest.fn((payload) => ({ type: 'spaces/restoreSpace', payload }))
}));

// Mock window.close
const mockWindowClose = jest.fn();
global.window.close = mockWindowClose;

describe('useKeyboardNavigation Hook', () => {
  const mockSpaces = {
    '1': { id: '1', name: 'Space 1', urls: [], lastModified: Date.now(), named: false, version: 1 },
    '2': { id: '2', name: 'Space 2', urls: [], lastModified: Date.now(), named: false, version: 1 },
    '3': { id: '3', name: 'Space 3', urls: [], lastModified: Date.now(), named: false, version: 1 }
  };

  const mockClosedSpaces = {
    '4': { id: '4', name: 'Closed Space 1', urls: [], lastModified: Date.now(), named: false, version: 1 }
  };

  let store: any;
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  const simulateKeyPress = (key: string) => {
    if (keydownHandler) {
      keydownHandler(createMockKeyboardEvent({ key }));
    }
  };

  beforeEach(() => {
    jest.useFakeTimers();
    keydownHandler = null;
    mockWindowClose.mockClear();

    // Setup document event listeners
    document.addEventListener = jest.fn((event: string, handler: EventListener) => {
      if (event === 'keydown') {
        keydownHandler = handler as (event: KeyboardEvent) => void;
      }
    });
    document.removeEventListener = jest.fn();
    
    // Create mock store
    store = mockStore({
      spaces: {
        selectedSpaceId: null,
        spaces: mockSpaces,
        closedSpaces: mockClosedSpaces,
        editMode: false,
        isLoading: false,
        error: null,
        currentWindowId: null,
        searchQuery: ''
      }
    });
    
    // Clear mock calls
    (selectSpace as jest.Mock).mockClear();
    (switchToSpace as jest.Mock).mockClear();
    (restoreSpace as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  it('should navigate through spaces with arrow keys', () => {
    // Start with initial state set
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '1'
      }
    });
    
    renderHook(() => useKeyboardNavigation({ 
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery: ''
    }), { wrapper });

    store.clearActions();

    // Navigate to next space
    act(() => {
      simulateKeyPress('ArrowDown');
    });

    const actions = store.getActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: 'spaces/selectSpace',
      payload: '2'
    });

    // Update store for next test
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '2'
      }
    });
    store.clearActions();

    // Navigate back
    act(() => {
      simulateKeyPress('ArrowUp');
    });

    const actions2 = store.getActions();
    expect(actions2).toHaveLength(1);
    expect(actions2[0]).toEqual({
      type: 'spaces/selectSpace',
      payload: '1'
    });
  });

  it('should handle search filtering', () => {
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '1'
      }
    });
    
    const { rerender } = renderHook(({ searchQuery }) => useKeyboardNavigation({ 
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery
    }), {
      wrapper,
      initialProps: { searchQuery: '' }
    });

    // Apply search filter
    rerender({ searchQuery: 'Space 2' });

    // Selected space should update to match search
    const actions = store.getActions();
    const selectActions = actions.filter((a: any) => a.type === 'spaces/selectSpace');
    expect(selectActions).toContainEqual({
      type: 'spaces/selectSpace',
      payload: '2'
    });

    // Navigate within filtered results
    store.clearActions();
    act(() => {
      simulateKeyPress('ArrowDown');
    });

    // Should wrap around to the same space (only one result)
    const actions2 = store.getActions();
    expect(actions2).toHaveLength(1);
    expect(actions2[0]).toEqual({
      type: 'spaces/selectSpace',
      payload: '2'
    });
  });

  it('should clear selection when no search results', () => {
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '1'
      }
    });
    
    const { rerender } = renderHook(({ searchQuery }) => useKeyboardNavigation({ 
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery
    }), {
      wrapper,
      initialProps: { searchQuery: '' }
    });

    // Apply search with no matches
    rerender({ searchQuery: 'no matches' });

    // Trigger keyboard event to check selection clearing
    act(() => {
      simulateKeyPress('ArrowDown');
    });

    // Should have cleared selection due to no results
    const actions = store.getActions();
    expect(actions).toContainEqual({
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
      }), { wrapper });

      // Focus search
      act(() => {
        simulateKeyPress('/');
      });

      expect(document.activeElement).toBe(mockSearchInput);

      // Mock that input is focused and press Escape
      mockSearchInput.focus();
      act(() => {
        simulateKeyPress('Escape');
      });

      // Should blur the input
      expect(document.activeElement).not.toBe(mockSearchInput);
    } finally {
      document.body.removeChild(div);
    }
  });

  it('should clear selection on Escape', () => {
    // Initialize with selection
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '1'
      }
    });
    
    renderHook(() => useKeyboardNavigation({
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery: ''
    }), { wrapper });

    store.clearActions();

    // Clear selection
    act(() => {
      simulateKeyPress('Escape');
    });

    const actions = store.getActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: 'spaces/selectSpace',
      payload: ''
    });
  });

  it('should handle Enter key to switch/restore spaces', () => {
    // Test switching to an active space
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '1'
      }
    });
    
    renderHook(() => useKeyboardNavigation({
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery: ''
    }), { wrapper });

    store.clearActions();

    // Press Enter to switch to selected space
    act(() => {
      simulateKeyPress('Enter');
    });

    expect(switchToSpace).toHaveBeenCalledWith(1);
    
    // Wait for window.close
    act(() => {
      jest.advanceTimersByTime(50);
    });
    
    expect(mockWindowClose).toHaveBeenCalled();

    // Test restoring a closed space
    store = mockStore({
      spaces: {
        ...store.getState().spaces,
        selectedSpaceId: '4' // Closed space
      }
    });
    
    (restoreSpace as jest.Mock).mockClear();
    mockWindowClose.mockClear();

    renderHook(() => useKeyboardNavigation({
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      searchQuery: ''
    }), { wrapper });

    act(() => {
      simulateKeyPress('Enter');
    });

    expect(restoreSpace).toHaveBeenCalledWith('4');
    
    act(() => {
      jest.advanceTimersByTime(50);
    });
    
    expect(mockWindowClose).toHaveBeenCalled();
  });
});