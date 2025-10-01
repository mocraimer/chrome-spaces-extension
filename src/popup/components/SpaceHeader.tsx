import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../shared/hooks/storeHooks';
import { renameSpace } from '../store/slices/spacesSlice';
import type { AppDispatch } from '../../shared/types/store';
import { debounce } from '../../shared/utils';

export const SpaceHeader: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentWindowId = useAppSelector(state => state.spaces.currentWindowId);
  const spaces = useAppSelector(state => state.spaces.spaces);
  const currentSpace = currentWindowId ? spaces[currentWindowId] : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentSpace) {
      setEditedName(currentSpace.name);
    }
  }, [currentSpace]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Auto-save function that only dispatches rename (without closing edit mode)
  const autoSave = useCallback((name: string) => {
    if (!currentWindowId || !name.trim()) return;

    // Don't save if name hasn't changed
    if (currentSpace && name.trim() === currentSpace.name.trim()) {
      return;
    }

    dispatch(renameSpace({
      windowId: Number(currentWindowId),
      name: name.trim()
    })).catch(error => {
      console.error('Auto-save failed:', error);
    });
  }, [currentWindowId, currentSpace, dispatch]);

  // Debounced version for auto-save while typing (500ms delay)
  const debouncedAutoSave = useMemo(
    () => debounce(autoSave, 500),
    [autoSave]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setEditedName(newName);
      debouncedAutoSave(newName);
    },
    [debouncedAutoSave]
  );

  const handleSubmit = useCallback(async () => {
    if (!currentWindowId || !editedName.trim()) return;

    // Don't save if name hasn't changed
    if (currentSpace && editedName.trim() === currentSpace.name.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await dispatch(renameSpace({
        windowId: Number(currentWindowId),
        name: editedName.trim()
      }));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to rename space:', error);
      if (currentSpace) {
        setEditedName(currentSpace.name);
      }
    }
  }, [currentWindowId, editedName, currentSpace, dispatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        if (currentSpace) {
          setEditedName(currentSpace.name);
        }
      }
    },
    [handleSubmit, currentSpace]
  );

  const handleBlur = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  if (!currentSpace) {
    return null;
  }

  return (
    <div className="space-header">
      <div className="space-title">
        {isEditing ? (
          <div className="space-name-edit">
            <input
              ref={inputRef}
              type="text"
              className="space-name-input"
              value={editedName}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              maxLength={50}
              aria-label="Space name"
            />
          </div>
        ) : (
          <div className="space-name-wrapper">
            <h2 className="space-name">{currentSpace.name}</h2>
            <button 
              className="edit-button"
              onClick={handleStartEditing}
              title="Click to rename"
              aria-label="Edit space name"
            >
              ✎
            </button>
          </div>
        )}
      </div>
      <div className="space-stats">
        {currentSpace.urls.length} {currentSpace.urls.length === 1 ? 'tab' : 'tabs'}
      </div>
    </div>
  );
};

// Styles
const styles = `
.space-header {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background: var(--background-primary);
}

.space-title {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.space-name-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.space-name {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.space-name-edit {
  flex: 1;
}

.space-name-input {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius-sm);
  background: var(--background-primary);
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition-fast);
}

.space-name-input:focus {
  border-color: var(--primary-color-dark);
}

.edit-button {
  padding: var(--spacing-xs);
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-md);
}

.edit-button:hover {
  color: var(--primary-color);
}

.space-stats {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}
`;

// Create and inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
