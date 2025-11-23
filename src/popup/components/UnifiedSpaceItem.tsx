import React, { memo, useRef, useEffect, useCallback } from 'react';
import { Space } from '@/shared/types/Space';

export interface SpaceItemProps {
  space: Space;
  isSelected: boolean;
  isCurrent: boolean;
  isEditing: boolean;
  editingName: string;
  onEdit: (space: Space) => void;
  onSave: () => void;
  onCancel: () => void;
  onSwitch: (windowId: number) => void;
  onRestore: (space: Space) => void;
  onDelete: (spaceId: string) => void;
  onEditNameChange: (name: string) => void;
  getDisplayName: (space: Space) => string;
  className?: string;
}

const SpaceItem: React.FC<SpaceItemProps> = memo(({
  space,
  isSelected,
  isCurrent,
  isEditing,
  editingName,
  onEdit,
  onSave,
  onCancel,
  onSwitch,
  onRestore,
  onDelete,
  onEditNameChange,
  getDisplayName,
  className = ''
}) => {
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and select text when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      const timer = setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  // Memoized event handlers to prevent unnecessary re-renders
  const handleClick = useCallback(() => {
    if (space.isActive && space.windowId) {
      onSwitch(space.windowId);
    } else {
      onRestore(space);
    }
  }, [space.isActive, space.windowId, space, onSwitch, onRestore]);

  const handleEditButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(space);
  }, [space, onEdit]);

  const handleDeleteButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(space.id);
  }, [space.id, onDelete]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [onSave, onCancel]);

  const handleDoubleClick = useCallback(() => {
    if (!isEditing) {
      onEdit(space);
    }
  }, [isEditing, space, onEdit]);

  const spaceItemClasses = [
    'space-item',
    isSelected ? 'selected' : '',
    isCurrent ? 'current' : '',
    !space.isActive ? 'closed' : '',
    className
  ].filter(Boolean).join(' ');

  const displayName = getDisplayName(space);
  const isActiveSpace = space.isActive;
  const tabCount = space.urls.length;
  const statusText = isActiveSpace ? 'Active' : `Closed ${new Date(space.lastModified).toLocaleDateString()}`;

  return (
    <div
      className={spaceItemClasses}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-testid={`space-item-${space.id}`}
    >
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editingName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={onSave}
          className="edit-input"
          data-testid={`edit-input-${space.id}`}
        />
      ) : (
        <>
          <div className="space-info">
            <div className="space-name" title={displayName}>
              {displayName}
            </div>
            <div className="space-details">
              {tabCount} tab{tabCount !== 1 ? 's' : ''} • {statusText}
            </div>
          </div>
          <div className="space-actions">
            {isActiveSpace && (
              <button
                onClick={handleEditButtonClick}
                className="edit-btn"
                title="Rename (F2)"
                data-testid={`edit-btn-${space.id}`}
              >
                ✏️
              </button>
            )}
            {!isActiveSpace && (
              <button
                onClick={handleDeleteButtonClick}
                className="delete-btn"
                title="Delete permanently"
                data-testid={`delete-btn-${space.id}`}
              >
                🗑️
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});

SpaceItem.displayName = 'UnifiedSpaceItem';

export default SpaceItem;