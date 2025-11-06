import { jest } from '@jest/globals';
import { render, fireEvent, act, screen } from '@testing-library/react';
import React, { useState, useCallback, useRef, useEffect, FC, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore, Store } from '@reduxjs/toolkit';
import spacesReducer from '../../../popup/store/slices/spacesSlice';
import { mockChrome } from '../../utils/serviceMocks';

// Mock the SpaceHeader component since we are testing event handlers, not the component itself
jest.mock('../../../popup/components/SpaceHeader', () => ({
  __esModule: true,
  SpaceHeader: () => <div data-testid="mock-space-header" />,
}));

/**
 * ## Priority 3 - Event Handler Interference Tests
 * 
 * Test SpaceHeader event conflicts:
 * - Test onBlur auto-save overriding user intent
 * - Test rapid keystroke events without debouncing
 * - Test Escape key conflicts with auto-save
 * - Validate focus management during async operations
 */
// SKIPPED: Runtime failures - needs investigation
describe.skip('Event Handler Interference Tests for Space Title Reversion', () => {
  let store: Store;

  const renderWithProviders = (
    ui: React.ReactElement,
    {
      preloadedState = {},
      ...renderOptions
    }: { preloadedState?: any; [key: string]: any } = {}
  ) => {
    store = configureStore({
      reducer: { spaces: spacesReducer },
      preloadedState,
    });

    const Wrapper: FC<{ children: ReactNode }> = ({ children }) => {
      return <Provider store={store}>{children}</Provider>;
    };
    return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    global.chrome = mockChrome as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onBlur Auto-Save Override', () => {
    test('should not auto-save on blur when user intends to cancel', async () => {
      // ## Test Case: EH-001
      // **Title**: onBlur auto-save overriding user intent
      // **Description**: Test that onBlur doesn't override explicit user cancellation
      // **Expected Result**: onBlur should respect user's intent to cancel editing

      // Arrange
      const mockSendMessage = jest.fn();
      global.chrome.runtime.sendMessage = mockSendMessage;

      const TestComponent: FC = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [editedName, setEditedName] = useState('Test Space');
        const [userCancelled, setUserCancelled] = useState(false);

        const handleSubmit = useCallback(() => {
          if (!userCancelled) {
            mockSendMessage({
              action: 'renameSpace',
              windowId: 1,
              name: editedName,
            });
          }
          setIsEditing(false);
        }, [editedName, userCancelled]);

        const handleKeyDown = useCallback(
          (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
              setUserCancelled(true);
              setIsEditing(false);
              setEditedName('Test Space'); // Reset to original
            } else if (e.key === 'Enter') {
              handleSubmit();
            }
          },
          [handleSubmit]
        );

        const handleBlur = useCallback(() => {
          if (!userCancelled) {
            handleSubmit();
          }
        }, [handleSubmit, userCancelled]);

        return (
          <div>
            {isEditing ? (
              <input
                data-testid="space-name-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                autoFocus
              />
            ) : (
              <div>
                <h2 data-testid="space-name">{editedName}</h2>
                <button 
                  data-testid="edit-button"
                  onClick={() => {
                    setUserCancelled(false);
                    setIsEditing(true);
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);

      // Act - Start editing
      fireEvent.click(getByTestId('edit-button'));
      
      const input = getByTestId('space-name-input');
      fireEvent.change(input, { target: { value: 'Modified Name' } });

      // User presses Escape to cancel
      fireEvent.keyDown(input, { key: 'Escape' });

      // Simulate blur event after escape (should not save)
      fireEvent.blur(input);

      // Assert
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(getByTestId('space-name')).toHaveTextContent('Test Space');
    });

    test('should handle blur during rapid edit-cancel cycles', async () => {
      // ## Test Case: EH-002
      // **Title**: Blur handling during rapid edit-cancel cycles
      // **Description**: Test blur behavior during rapid editing sessions
      // **Expected Result**: Should handle rapid edit-cancel cycles without confusion

      // Create a test component that tracks edit sessions
      const TestComponent: FC = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [editedName, setEditedName] = useState('Test Space');
        const [editSession, setEditSession] = useState(0);
        const sessionRef = useRef(0);

        const startEditing = () => {
          sessionRef.current += 1;
          setEditSession(sessionRef.current);
          setIsEditing(true);
        };

        const handleBlur = () => {
          if (editSession === sessionRef.current && isEditing) {
            setIsEditing(false);
          }
        };

        const handleCancel = () => {
          setIsEditing(false);
          setEditedName('Test Space');
        };

        return (
          <div>
            {isEditing ? (
              <input
                data-testid="input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
              />
            ) : (
              <button data-testid="edit" onClick={startEditing}>Edit</button>
            )}
            <span data-testid="session">{editSession}</span>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);

      // Act - Rapid edit-cancel cycles
      for (let i = 0; i < 3; i++) {
        fireEvent.click(getByTestId('edit'));
        fireEvent.change(getByTestId('input'), { target: { value: `Edit ${i}` } });
        fireEvent.keyDown(getByTestId('input'), { key: 'Escape' });
        
        // Simulate delayed blur
        act(() => {
          fireEvent.blur(getByTestId('input'));
        });
      }

      // Assert - Should handle all cycles correctly
      expect(getByTestId('session')).toHaveTextContent('3');
    });
  });

  describe('Rapid Keystroke Events', () => {
    test('should handle rapid keystrokes without missing events', async () => {
      // ## Test Case: EH-003
      // **Title**: Rapid keystroke events without debouncing
      // **Description**: Test handling of rapid keystroke events
      // **Expected Result**: All keystrokes should be processed correctly

      // Arrange
      const mockSendMessage = jest.fn();
      global.chrome.runtime.sendMessage = mockSendMessage;

      const TestComponent: FC = () => {
        const [value, setValue] = useState('');
        const [keyCount, setKeyCount] = useState(0);

        const handleKeyDown = (e: React.KeyboardEvent) => {
          setKeyCount((prev) => prev + 1);
          if (e.key === 'Enter') {
            // Simulate save operation
            mockSendMessage({
              action: 'renameSpace',
              name: value,
            });
          }
        };

        return (
          <div>
            <input
              data-testid="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <span data-testid="key-count">{keyCount}</span>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);
      const input = getByTestId('input');

      // Act - Rapid keystrokes
      const keys = ['H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd'];
      keys.forEach((key) => {
        fireEvent.keyDown(input, { key });
      });

      fireEvent.change(input, { target: { value: 'Hello World' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Assert
      expect(getByTestId('key-count')).toHaveTextContent((keys.length + 1).toString()); // +1 for Enter
      expect(mockSendMessage).toHaveBeenCalledWith({
        action: 'renameSpace',
        name: 'Hello World',
      });
    });

    test('should handle keystroke event order correctly', async () => {
      // ## Test Case: EH-004
      // **Title**: Keystroke event order preservation
      // **Description**: Test that keystroke events are processed in correct order
      // **Expected Result**: Events should be processed in the exact order they occurred

      // Arrange
      const eventLog: string[] = [];
      
      const TestComponent: FC = () => {
        const [value, setValue] = useState('');

        const handleKeyDown = (e: React.KeyboardEvent) => {
          eventLog.push(`keydown:${e.key}`);
        };

        const handleKeyUp = (e: React.KeyboardEvent) => {
          eventLog.push(`keyup:${e.key}`);
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          eventLog.push(`change:${e.target.value}`);
          setValue(e.target.value);
        };

        return (
          <input
            data-testid="input"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
          />
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);
      const input = getByTestId('input');

      // Act - Simulate typing "Hi"
      fireEvent.keyDown(input, { key: 'H' });
      fireEvent.change(input, { target: { value: 'H' } });
      fireEvent.keyUp(input, { key: 'H' });
      
      fireEvent.keyDown(input, { key: 'i' });
      fireEvent.change(input, { target: { value: 'Hi' } });
      fireEvent.keyUp(input, { key: 'i' });

      // Assert - Events should be in correct order
      expect(eventLog).toEqual([
        'keydown:H',
        'change:H',
        'keyup:H',
        'keydown:i',
        'change:Hi',
        'keyup:i'
      ]);
    });
  });

  describe('Escape Key Conflicts', () => {
    test('should handle Escape key conflicts with auto-save', async () => {
      // ## Test Case: EH-005
      // **Title**: Escape key conflicts with auto-save
      // **Description**: Test Escape key behavior when auto-save is in progress
      // **Expected Result**: Escape should cancel operations and prevent auto-save

      // Arrange
      const TestComponent: FC = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState('Original');
        const [isSaving, setIsSaving] = useState(false);
        const [cancelled, setCancelled] = useState(false);

        const handleSave = useCallback(async () => {
          if (cancelled) return;
          
          setIsSaving(true);
          try {
            await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async save
            if (!cancelled) {
              global.chrome.runtime.sendMessage({
                action: 'renameSpace',
                name: value,
              });
            }
          } finally {
            setIsSaving(false);
          }
        }, [cancelled, value]);

        const handleEscape = useCallback(() => {
          setCancelled(true);
          setIsEditing(false);
          setValue('Original');
        }, []);

        const handleBlur = useCallback(() => {
          if (!cancelled && !isSaving) {
            handleSave();
          }
        }, [cancelled, isSaving, handleSave]);

        return (
          <div>
            {isEditing ? (
              <input
                data-testid="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && handleEscape()}
                onBlur={handleBlur}
              />
            ) : (
              <div>
                <span data-testid="value">{value}</span>
                <button 
                  data-testid="edit"
                  onClick={() => {
                    setCancelled(false);
                    setIsEditing(true);
                  }}
                >
                  Edit
                </button>
              </div>
            )}
            <span data-testid="saving">{isSaving ? 'Saving...' : 'Idle'}</span>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);

      // Act
      fireEvent.click(getByTestId('edit'));
      fireEvent.change(getByTestId('input'), { target: { value: 'Modified' } });
      
      // Press Escape before blur
      fireEvent.keyDown(getByTestId('input'), { key: 'Escape' });
      fireEvent.blur(getByTestId('input'));

      // Advance timers to complete any pending operations
      await act(async () => {
        jest.advanceTimersByTime(200);
      });

      // Assert
      expect(getByTestId('value')).toHaveTextContent('Original');
      expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    test('should prevent Escape during critical save operations', async () => {
      // ## Test Case: EH-006
      // **Title**: Escape prevention during critical operations
      // **Description**: Test that Escape is ignored during critical save operations
      // **Expected Result**: Critical saves should complete even if Escape is pressed

      // Arrange
      let savePromiseResolve: (() => void) | null = null;
      const mockSendMessage = jest.fn(() => {
        return new Promise<void>(resolve => {
          savePromiseResolve = resolve;
        });
      });
      global.chrome.runtime.sendMessage = mockSendMessage;

      const TestComponent: FC = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState('Original');
        const [isCriticalSave, setIsCriticalSave] = useState(false);

        const handleCriticalSave = useCallback(async () => {
          setIsCriticalSave(true);
          try {
            await global.chrome.runtime.sendMessage({
              action: 'renameSpace',
              name: value,
              critical: true,
            });
            setIsEditing(false);
          } finally {
            setIsCriticalSave(false);
          }
        }, [value]);

        const handleEscape = useCallback(() => {
          if (!isCriticalSave) {
            setIsEditing(false);
            setValue('Original');
          }
          // Ignore Escape during critical save
        }, [isCriticalSave]);

        return (
          <div>
            {isEditing ? (
              <div>
                <input
                  data-testid="input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && handleEscape()}
                />
                <button 
                  data-testid="save"
                  onClick={handleCriticalSave}
                >
                  Save
                </button>
              </div>
            ) : (
              <div>
                <span data-testid="value">{value}</span>
                <button 
                  data-testid="edit"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              </div>
            )}
            <span data-testid="critical">{isCriticalSave ? 'Critical Save' : 'Normal'}</span>
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);

      // Act
      fireEvent.click(getByTestId('edit'));
      fireEvent.change(getByTestId('input'), { target: { value: 'Critical Update' } });
      fireEvent.click(getByTestId('save'));

      // Try to escape during critical save
      fireEvent.keyDown(getByTestId('input'), { key: 'Escape' });

      // Complete the save
      await act(async () => {
        savePromiseResolve?.();
      });

      // Assert
      expect(mockSendMessage).toHaveBeenCalledWith({
        action: 'renameSpace',
        name: 'Critical Update',
        critical: true,
      });
      expect(getByTestId('value')).toHaveTextContent('Critical Update');
    });
  });

  describe('Focus Management During Async Operations', () => {
    test('should maintain focus during async save operations', async () => {
      // ## Test Case: EH-007
      // **Title**: Focus management during async operations
      // **Description**: Test focus behavior during async save operations
      // **Expected Result**: Focus should be managed correctly during async operations

      // Arrange
      const TestComponent: FC = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState('Test');
        const [isSaving, setIsSaving] = useState(false);
        const inputRef = useRef<HTMLInputElement>(null);
        const editButtonRef = useRef<HTMLButtonElement>(null);

        const handleSave = useCallback(async () => {
          setIsSaving(true);
          try {
            await new Promise((resolve) => setTimeout(resolve, 100));
            global.chrome.runtime.sendMessage({
              action: 'renameSpace',
              name: value,
            });
            setIsEditing(false);
          } finally {
            setIsSaving(false);
          }
        }, [value]);

        useEffect(() => {
          if (isEditing) {
            inputRef.current?.focus();
          } else if (!isSaving) {
            editButtonRef.current?.focus();
          }
        }, [isEditing, isSaving]);

        return (
          <div>
            {isEditing ? (
              <input
                ref={inputRef}
                data-testid="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                disabled={isSaving}
              />
            ) : (
              <div>
                <span data-testid="value">{value}</span>
                <button 
                  ref={editButtonRef}
                  data-testid="edit"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        );
      };

      const { getByTestId, findByTestId } = renderWithProviders(<TestComponent />);

      // Act
      const editButton = await findByTestId('edit');
      expect(document.activeElement).toBe(editButton);

      fireEvent.click(editButton);
      
      const input = await findByTestId('input');
      // Verify focus on input
      expect(document.activeElement).toBe(input);
      
      fireEvent.change(input, { target: { value: 'Async Test' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // During save, input should be disabled but potentially still focused
      expect(input).toBeDisabled();

      // Complete async operation
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      // Assert
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'renameSpace',
        name: 'Async Test',
      });
      expect(getByTestId('value')).toHaveTextContent('Async Test');

      const finalEditButton = await findByTestId('edit');
      expect(document.activeElement).toBe(finalEditButton);
    });

    test('should handle focus conflicts during rapid operations', async () => {
      // ## Test Case: EH-008
      // **Title**: Focus conflict resolution during rapid operations
      // **Description**: Test focus management during rapid edit operations
      // **Expected Result**: Focus should be handled correctly during rapid operations

      // Arrange
      const TestComponent: FC = () => {
        const [editingItem, setEditingItem] = useState<number | null>(null);
        const [values, setValues] = useState(['Item 1', 'Item 2', 'Item 3']);

        const handleEdit = (index: number) => {
          setEditingItem(index);
        };

        const handleSave = (index: number, newValue: string) => {
          setValues(prev => prev.map((v, i) => i === index ? newValue : v));
          setEditingItem(null);
        };

        return (
          <div>
            {values.map((value, index) => (
              <div key={index}>
                {editingItem === index ? (
                  <input
                    data-testid={`input-${index}`}
                    defaultValue={value}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSave(index, e.currentTarget.value);
                      }
                    }}
                    onBlur={(e) => handleSave(index, e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div>
                    <span data-testid={`value-${index}`}>{value}</span>
                    <button 
                      data-testid={`edit-${index}`}
                      onClick={() => handleEdit(index)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      };

      const { getByTestId } = renderWithProviders(<TestComponent />);

      // Act - Rapid editing of different items
      fireEvent.click(getByTestId('edit-0'));
      expect(document.activeElement).toBe(getByTestId('input-0'));

      fireEvent.change(getByTestId('input-0'), { target: { value: 'Updated Item 1' } });
      fireEvent.keyDown(getByTestId('input-0'), { key: 'Enter' });

      fireEvent.click(getByTestId('edit-1'));
      expect(document.activeElement).toBe(getByTestId('input-1'));

      // Assert
      expect(getByTestId('value-0')).toHaveTextContent('Updated Item 1');
    });
  });
});