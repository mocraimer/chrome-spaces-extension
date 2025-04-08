import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../../shared/hooks/storeHooks';
import { renameSpace } from '../store/slices/spacesSlice';
import type { AppDispatch } from '../../shared/types/store';

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

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditedName(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!currentWindowId || !editedName.trim()) return;

    try {
      await dispatch(renameSpace({
        windowId: Number(currentWindowId),
        name: editedName.trim()
      }));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to rename space:', error);
      // Reset to original name on error
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
        ) : (
          <h2 
            className="space-name" 
            onClick={handleStartEditing}
            title="Click to rename"
          >
            {currentSpace.name}
          </h2>
          
        )}
        {isEditing ? '✓' : '✎'}
      </div>
      <div className="space-stats">
        {currentSpace.urls.length} {currentSpace.urls.length === 1 ? 'tab' : 'tabs'}
      </div>
    </div>
  );
};

// Styles
const styles = `
/* Updated styles using theme variables for modern spacing, typography, and borders */
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

.space-name {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.space-name:hover {
  color: var(--primary-color);
}

.space-name-input {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius-sm);
  outline: none;
}

.space-stats {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}
`;

// Create and inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
