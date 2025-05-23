import React from 'react';
import { Space } from '../../shared/types/Space';
import { useAppDispatch } from '../../shared/hooks/storeHooks';
import { updateSpaceName } from '../store/slices/spacesSlice';

interface SpaceItemProps {
  space: Space;
  onSwitchClick: (e: React.MouseEvent) => void;
  showActions: boolean;
  actionLabel: string;
  isEditing: boolean;
}

const SpaceItem: React.FC<SpaceItemProps> = ({
  space,
  onSwitchClick,
  showActions,
  actionLabel,
  isEditing
}) => {
  const [editedName, setEditedName] = React.useState(space.name);
  const dispatch = useAppDispatch();

  const handleSave = () => {
    dispatch(updateSpaceName({ id: space.id, name: editedName }));
  };

  const handleCancel = () => {
    setEditedName(space.name);
  };

  return (
    <div className="space-info">
      <span className="space-icon">🖥️</span>
      {isEditing ? (
        <input
          type="text"
          data-testid="space-name-input"
          className="space-name-input"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
        />
      ) : (
        <span className="space-name">{space.name}</span>
      )}
      <span className="space-tabs-count">
        {space.urls.length} {space.urls.length === 1 ? 'tab' : 'tabs'}
      </span>
      <div className="space-actions">
        {isEditing ? (
          <>
            <button className="action-btn save-btn" onClick={handleSave}>Save</button>
            <button className="action-btn cancel-btn" onClick={handleCancel}>Cancel</button>
          </>
        ) : (
          showActions && (
            <button
              className="action-btn"
              onClick={onSwitchClick}
            >
              {actionLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
};

// Styles
const itemStyles = `
.space-info {
  display: flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  margin-bottom: var(--spacing-sm);
  background: var(--background-secondary);
}

.space-icon {
  margin-right: var(--spacing-xs);
}

.space-name, .space-name-input {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-right: var(--spacing-sm);
}

.space-name-input {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-xs);
  padding: var(--spacing-xs);
  background: var(--background-primary);
}

.space-tabs-count {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-right: auto;
}

.space-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.action-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--primary-color);
  border-radius: var(--border-radius-sm);
  background: transparent;
  color: var(--primary-color);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--primary-color);
  color: white;
}

.save-btn {
  border-color: var(--success-color);
  color: var(--success-color);
}

.save-btn:hover {
  background: var(--success-color);
}

.cancel-btn {
  border-color: var(--error-color);
  color: var(--error-color);
}

.cancel-btn:hover {
  background: var(--error-color);
}
`;

const itemStyleSheet = document.createElement('style');
itemStyleSheet.textContent = itemStyles;
document.head.appendChild(itemStyleSheet);

export default SpaceItem;