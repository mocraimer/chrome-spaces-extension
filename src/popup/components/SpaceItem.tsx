import React, { useEffect } from 'react';
import { Space } from '../../shared/types/Space';
import { useAppDispatch } from '../../shared/hooks/storeHooks';
import { renameSpace, toggleEditMode } from '../store/slices/spacesSlice';
import { injectSpaceItemStyles } from './SpaceItem.styles';

interface SpaceItemProps {
  space: Space;
  onSwitchClick: (e: React.MouseEvent) => void;
  showActions: boolean;
  actionLabel: string;
  isEditing: boolean;
  isLoaded?: boolean;
}

const SpaceItem: React.FC<SpaceItemProps> = ({
  space,
  onSwitchClick,
  showActions,
  actionLabel,
  isEditing,
  isLoaded = true
}) => {
  const [editedName, setEditedName] = React.useState(space.name);
  const dispatch = useAppDispatch();
  
  useEffect(() => {
    injectSpaceItemStyles();
  }, []);

  const handleSave = async () => {
    try {
      await dispatch(renameSpace({ 
        windowId: parseInt(space.id), 
        name: editedName 
      }));
      dispatch(toggleEditMode());
    } catch (error) {
      console.error('Failed to rename space:', error);
      // Reset to original name on error
      setEditedName(space.name);
    }
  };

  const handleCancel = () => {
    setEditedName(space.name);
    dispatch(toggleEditMode());
  };

  return (
    <div className={`space-info ${!isLoaded ? 'loading' : ''}`} data-testid="space-item">
      {!isLoaded ? (
        <>
          <div className="skeleton icon-skeleton" />
          <div className="skeleton name-skeleton" />
          <div className="skeleton tabs-skeleton" />
        </>
      ) : (
        <>
          {/* Title and editing controls - positioned above clickable area */}
          <div className="space-header" onClick={(e) => e.stopPropagation()}>
            {isEditing ? (
              <div className="space-name-edit-container">
                <input
                  type="text"
                  data-testid="space-name-input"
                  className="space-name-input"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSave();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCancel();
                    }
                  }}
                  autoFocus
                />
                <div className="edit-actions">
                  <button className="action-btn save-btn" onClick={handleSave}>Save</button>
                  <button className="action-btn cancel-btn" onClick={handleCancel}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-name-container">
                <span className="space-name">{space.name}</span>
                <button 
                  className="edit-name-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dispatch(toggleEditMode());
                  }}
                  title="Edit space name"
                  aria-label="Edit space name"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          {/* Space content - this area can be clicked to switch spaces */}
          <div className="space-content">
            <span className="space-icon">🖥️</span>
            <span className="space-tabs-count">
              {space.urls.length} {space.urls.length === 1 ? 'tab' : 'tabs'}
            </span>
            {!isEditing && showActions && (
              <div className="space-actions">
                <button
                  className="action-btn"
                  onClick={onSwitchClick}
                >
                  {actionLabel}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SpaceItem;