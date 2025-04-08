import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Space } from '../../shared/types/Space';

interface SpaceItemProps {
  space: Space;
  isEditing: boolean;
  onSwitchClick: (e: React.MouseEvent) => void;
  showActions: boolean;
  actionLabel: string;
}

const SpaceItem: React.FC<SpaceItemProps> = ({
  space,
  isEditing,
  onSwitchClick,
  showActions,
  actionLabel
}) => {
  const [newName, setNewName] = useState(space.name);
  const dispatch = useDispatch();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value);
  };

  const handleSave = () => {
    if (newName.trim() !== '') {
      dispatch({
        type: 'spaces/updateSpaceName',
        payload: { id: space.id, name: newName }
      });
    }
    setNewName(space.name);
  };

  const handleCancel = () => {
    setNewName(space.name);
  };

  return (
    <div className="space-info">
      <span className="space-icon">
        {isEditing ? '✎' : '🖥️'}
      </span>
      {isEditing ? (
        <div className="space-name-edit">
          <input
            type="text"
            value={newName}
            onChange={handleNameChange}
            className="space-name-input"
            data-testid="space-name-input"
          />
          <button onClick={handleSave} className="save-btn">Save</button>
          <button onClick={handleCancel} className="cancel-btn">Cancel</button>
        </div>
      ) : (
        <>
          <span className="space-name">{space.name}</span>
          <span className="space-tabs-count">
            {space.urls.length} {space.urls.length === 1 ? 'tab' : 'tabs'}
          </span>
          {showActions && (
            <div className="space-actions">
              <button
                className="action-btn"
                onClick={onSwitchClick}
              >
                {actionLabel}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};


// Styles
const itemStyles = `
.space-info {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  margin-bottom: var(--spacing-sm);
  background: var(--background-secondary);
}
.space-icon {
  margin-right: var(--spacing-xs);
}
.space-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}
.save-btn, .cancel-btn {
  margin-left: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--border-radius-sm);
  background: var(--primary-color);
  color: #fff;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.save-btn:hover, .cancel-btn:hover {
  background: var(--primary-color-dark);
}
`;
const itemStyleSheet = document.createElement('style');
itemStyleSheet.textContent = itemStyles;
document.head.appendChild(itemStyleSheet);

export default SpaceItem;