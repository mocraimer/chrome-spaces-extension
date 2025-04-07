import { jest } from '@jest/globals';

export type MockEventListener = (event: string, handler: EventListener) => void;

// Define only the keyboard event properties we actually use in our tests
export interface MockKeyboardEventProps {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  target?: HTMLElement | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

// Create a minimal mock keyboard event
export function createMockKeyboardEvent(init: MockKeyboardEventProps) {
  const mockEvent = {
    key: init.key,
    ctrlKey: init.ctrlKey || false,
    shiftKey: init.shiftKey || false,
    altKey: init.altKey || false,
    metaKey: init.metaKey || false,
    target: init.target || {
      tagName: 'DIV',
      isContentEditable: false,
      nodeName: 'DIV'
    },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    type: 'keydown'
  };

  // Use type assertion since we only care about the properties we actually use
  return mockEvent as unknown as KeyboardEvent;
}

export const mockDocumentEventListeners = () => {
  const eventMap: Record<string, EventListener> = {};
  
  const addEventListener: MockEventListener = (event, handler) => {
    eventMap[event] = handler;
  };

  const removeEventListener: MockEventListener = (event, handler) => {
    delete eventMap[event];
  };

  return {
    eventMap,
    mockAddEventListener: jest.fn(addEventListener),
    mockRemoveEventListener: jest.fn(removeEventListener)
  };
};

// Helper to create an input element for testing
export function createMockInputElement(value: string = '') {
  const input = document.createElement('input');
  input.value = value;
  return input;
}

// Types for testing with React Testing Library
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWith(expected: any): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledTimes(times: number): R;
    }
  }
}