import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Space } from '@/shared/types/Space';
import { RootState, AppDispatch } from '../store/types';
import {
  fetchSpaces,
  renameSpace,
  switchToSpace,
  restoreSpace,
  removeClosedSpace,
  setCurrentWindow,
  setSearch,
  clearError
} from '../store/slices/spacesSlice';

const MAX_NAME_LENGTH = 100;

const UnifiedPopup: React.FC = () => {
  // Redux state and dispatch
  const dispatch = useDispatch<AppDispatch>();
  const {
    spaces,
    closedSpaces,
    currentWindowId,
    isLoading,
    error,
    searchQuery
  } = useSelector((state: RootState) => state.spaces);

  // Local state for UI
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Convert spaces to arrays for display
  const spacesArray = Object.values(spaces).filter(space => space.isActive);
  const closedSpacesArray = Object.values(closedSpaces).filter(space => !space.isActive);

  // Get display name for a space (custom name takes precedence)
  const getDisplayName = useCallback((space: Space): string => {
    return space.customName || space.name;
  }, []);

  // Validate space name
  const validateSpaceName = useCallback((name: string, currentSpaceId?: string): { valid: boolean; error?: string } => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return { valid: false, error: 'Name cannot be empty' };
    }
    
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` };
    }
    
    // Check for duplicate names (case-insensitive)
    const lowerName = trimmedName.toLowerCase();
    if (existingNames.has(lowerName)) {
      // Allow if it's the same space being edited
      const currentSpace = currentSpaceId ? spaces[currentSpaceId] || closedSpaces[currentSpaceId] : null;
      const currentName = currentSpace ? getDisplayName(currentSpace) : null;
      if (!currentName || currentName.toLowerCase() !== lowerName) {
        return { valid: false, error: 'This name is already used by another space' };
      }
    }
    
    return { valid: true };
  }, [existingNames, spaces, closedSpaces, getDisplayName]);

  // Update existing names set whenever spaces change
  useEffect(() => {
    const allNames = new Set<string>();
    [...spacesArray, ...closedSpacesArray].forEach(space => {
      const displayName = getDisplayName(space);
      allNames.add(displayName.toLowerCase());
    });
    setExistingNames(allNames);
  }, [spacesArray, closedSpacesArray, getDisplayName]);

  // Initialize data on mount
  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow.id) {
          dispatch(setCurrentWindow(currentWindow.id.toString()));
        }
        
        // Fetch all spaces data from background service
        await dispatch(fetchSpaces());
      } catch (err) {
        console.error('Failed to initialize popup:', err);
      }
    };

    initializePopup();
  }, [dispatch]);

  // Auto-focus search input
  useEffect(() => {
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoading]);

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    dispatch(setSearch(query));
    setSelectedIndex(0);
  }, [dispatch]);

  // Filter spaces based on search
  const filteredSpaces = spacesArray.filter(space => {
    const displayName = getDisplayName(space);
    return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           space.urls.some(url => url.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const filteredClosedSpaces = closedSpacesArray.filter(space => {
    const displayName = getDisplayName(space);
    return displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           space.urls.some(url => url.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Handle space actions
  const handleSwitchToSpace = useCallback(async (windowId: number) => {
    try {
      await dispatch(switchToSpace(windowId));
      window.close();
    } catch (err) {
      console.error('Failed to switch to space:', err);
    }
  }, [dispatch]);

  const handleRestoreSpace = useCallback(async (space: Space) => {
    try {
      await dispatch(restoreSpace(space.id));
      // Refresh data after restore
      await dispatch(fetchSpaces());
    } catch (err) {
      console.error('Failed to restore space:', err);
    }
  }, [dispatch]);

  const handleRemoveSpace = useCallback(async (spaceId: string) => {
    try {
      await dispatch(removeClosedSpace(spaceId));
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Failed to remove space:', err);
    }
  }, [dispatch]);

  // Handle editing
  const startEditing = useCallback((space: Space) => {
    setEditingSpaceId(space.id);
    setEditingName(getDisplayName(space));

    // Focus the edit input after a short delay
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
      }
    }, 100);
  }, [getDisplayName]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingSpaceId) return;

    const validation = validateSpaceName(editingName, editingSpaceId);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      const space = spaces[editingSpaceId] || closedSpaces[editingSpaceId];
      if (space && space.windowId) {
        await dispatch(renameSpace({ windowId: space.windowId, name: editingName.trim() }));

        // Refresh data after rename
        await dispatch(fetchSpaces());
      }

      setEditingSpaceId(null);
      setEditingName('');
    } catch (err) {
      console.error('Failed to save space name:', err);
    }
  }, [editingSpaceId, editingName, validateSpaceName, spaces, closedSpaces, dispatch]);

  const handleCancelEdit = useCallback(() => {
    setEditingSpaceId(null);
    setEditingName('');
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredSpaces.length + filteredClosedSpaces.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex < filteredSpaces.length) {
          const space = filteredSpaces[selectedIndex];
          if (space.windowId) {
            handleSwitchToSpace(space.windowId);
          }
        } else {
          const closedSpace = filteredClosedSpaces[selectedIndex - filteredSpaces.length];
          if (closedSpace) {
            handleRestoreSpace(closedSpace);
          }
        }
        break;
      case 'F2':
        e.preventDefault();
        if (selectedIndex < filteredSpaces.length) {
          const space = filteredSpaces[selectedIndex];
          startEditing(space);
        }
        break;
      case 'Escape':
        if (editingSpaceId) {
          handleCancelEdit();
        } else {
          window.close();
        }
        break;
    }
  }, [selectedIndex, filteredSpaces, filteredClosedSpaces, editingSpaceId, handleSwitchToSpace, handleRestoreSpace, handleCancelEdit, startEditing]);

  // Handle edit input key events
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  // Inject styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = popupStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading spaces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="popup-container">
        <div className="error">
          Error: {error}
          <button onClick={() => dispatch(clearError())}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="search-container">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search spaces..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>

      <div className="spaces-list">
        {filteredSpaces.length === 0 && filteredClosedSpaces.length === 0 ? (
          <div className="no-results">No spaces found</div>
        ) : (
          <>
            {/* Active Spaces */}
            {filteredSpaces.map((space, index) => (
              <div
                key={space.id}
                className={`space-item ${selectedIndex === index ? 'selected' : ''} ${
                  space.windowId?.toString() === currentWindowId ? 'current' : ''
                }`}
                onClick={() => space.windowId && handleSwitchToSpace(space.windowId)}
                onDoubleClick={() => startEditing(space)}
              >
                {editingSpaceId === space.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={handleSaveEdit}
                    className="edit-input"
                  />
                ) : (
                  <>
                    <div className="space-info">
                      <div className="space-name">{getDisplayName(space)}</div>
                      <div className="space-details">
                        {space.urls.length} tabs • {space.windowId ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="space-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(space);
                        }}
                        className="edit-btn"
                        title="Rename (F2)"
                      >
                        ✏️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Closed Spaces */}
            {filteredClosedSpaces.length > 0 && (
              <>
                <div className="section-header">Recently Closed</div>
                {filteredClosedSpaces.map((space, index) => (
                  <div
                    key={space.id}
                    className={`space-item closed ${
                      selectedIndex === filteredSpaces.length + index ? 'selected' : ''
                    }`}
                    onClick={() => handleRestoreSpace(space)}
                  >
                    <div className="space-info">
                      <div className="space-name">{getDisplayName(space)}</div>
                      <div className="space-details">
                        {space.urls.length} tabs • Closed {new Date(space.lastModified).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="space-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConfirmDelete(space.id);
                        }}
                        className="delete-btn"
                        title="Delete permanently"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Confirm delete dialog */}
      {showConfirmDelete && (
        <div className="confirm-dialog">
          <div className="confirm-content">
            <div>Permanently delete this space?</div>
            <div className="confirm-actions">
              <button
                onClick={() => handleRemoveSpace(showConfirmDelete)}
                className="confirm-delete"
              >
                Delete
              </button>
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="confirm-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="help-text">
        Use ↑↓ to navigate, Enter to switch, F2 to rename, Esc to close
      </div>
    </div>
  );
};

const popupStyles = `
  .popup-container {
    width: 350px;
    max-height: 500px;
    padding: var(--spacing-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-family: var(--font-family);
    display: flex;
    flex-direction: column;
    outline: none;
  }

  .search-container {
    margin-bottom: var(--spacing-md);
  }

  .search-input {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .search-input:focus {
    border-color: var(--primary-color);
    outline: none;
  }

  .spaces-list {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
  }

  .space-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: 1px solid transparent;
  }

  .space-item:hover {
    background: var(--background-secondary);
  }

  .space-item.selected {
    background: var(--primary-color);
    color: white;
  }

  .space-item.current {
    border-color: var(--primary-color);
    background: rgba(var(--primary-color-rgb), 0.1);
  }

  .space-item.closed {
    opacity: 0.7;
  }

  .space-info {
    flex: 1;
    min-width: 0;
  }

  .space-name {
    font-weight: var(--font-weight-medium);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .space-details {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .space-item.selected .space-details {
    color: rgba(255, 255, 255, 0.8);
  }

  .space-actions {
    display: flex;
    gap: var(--spacing-xs);
    margin-left: var(--spacing-sm);
  }

  .edit-btn, .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    font-size: 14px;
    opacity: 0.7;
    transition: opacity var(--transition-fast);
  }

  .edit-btn:hover, .delete-btn:hover {
    opacity: 1;
  }

  .edit-input {
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius-sm);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .edit-input:focus {
    outline: none;
  }

  .section-header {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    margin: var(--spacing-md) 0 var(--spacing-sm) 0;
    padding-left: var(--spacing-sm);
  }

  .no-results {
    text-align: center;
    color: var(--text-secondary);
    padding: var(--spacing-lg);
  }

  .loading {
    text-align: center;
    padding: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .error {
    text-align: center;
    padding: var(--spacing-lg);
    color: var(--error-color);
  }

  .error button {
    margin-top: var(--spacing-sm);
    background: var(--primary-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .error button:hover {
    background: var(--primary-color-dark);
  }

  .confirm-dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .confirm-content {
    background: var(--background-primary);
    padding: var(--spacing-lg);
    border-radius: var(--border-radius-md);
    text-align: center;
    min-width: 200px;
  }

  .confirm-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    justify-content: center;
  }

  .confirm-delete {
    background: var(--error-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .confirm-delete:hover {
    background: var(--error-color-dark, #d32f2f);
  }

  .confirm-cancel {
    background: var(--background-secondary);
    color: var(--text-primary);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
  }

  .confirm-cancel:hover {
    background: var(--border-color);
  }

  .help-text {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-align: center;
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border-color);
  }
`;

export default UnifiedPopup; 