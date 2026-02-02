import React, { memo, useCallback } from 'react';
import { Space } from '@/shared/types/Space';
import UnifiedSpaceItem from './UnifiedSpaceItem';
import MoveTabDropdown from './MoveTabDropdown';

export interface SpaceAction {
  type: 'edit' | 'switch' | 'restore' | 'delete' | 'save' | 'cancel' | 'editNameChange' | 'moveToNewSpace' | 'moveToExistingSpace';
  space?: Space;
  spaceId?: string;
  windowId?: number;
  name?: string;
}

export interface SpacesListProps {
  spaces: Space[];
  closedSpaces: Space[];
  selectedIndex: number;
  currentWindowId: string | null;
  editingSpaceId: string | null;
  editingName: string;
  showConfirmDelete: string | null;
  onSpaceAction: (action: SpaceAction) => void;
  getDisplayName: (space: Space) => string;
  className?: string;
  /** Whether the active tab is pinned (hides move dropdown) */
  isActiveTabPinned?: boolean;
}

const UnifiedSpacesList: React.FC<SpacesListProps> = memo(({
  spaces,
  closedSpaces,
  selectedIndex,
  currentWindowId,
  editingSpaceId,
  editingName,
  showConfirmDelete: _showConfirmDelete,
  onSpaceAction,
  getDisplayName,
  className = '',
  isActiveTabPinned = false
}) => {
  const handleSpaceAction = (action: Omit<SpaceAction, 'space' | 'spaceId' | 'windowId'>, space?: Space, spaceId?: string, windowId?: number, name?: string) => {
    onSpaceAction({
      ...action,
      space,
      spaceId,
      windowId,
      name
    });
  };

  const handleMoveToNewSpace = useCallback(() => {
    onSpaceAction({ type: 'moveToNewSpace' });
  }, [onSpaceAction]);

  const handleMoveToExistingSpace = useCallback((windowId: number) => {
    onSpaceAction({ type: 'moveToExistingSpace', windowId });
  }, [onSpaceAction]);

  const totalItems = spaces.length + closedSpaces.length;
  console.log('UnifiedSpacesList rendering:', { spacesCount: spaces.length, closedSpacesCount: closedSpaces.length });

  if (totalItems === 0) {
    return (
      <div className={`spaces-list ${className}`.trim()}>
        <div className="no-results" data-testid="no-results">
          No spaces found
        </div>
      </div>
    );
  }

  // Get current window id as number for dropdown
  const currentWindowIdNum = currentWindowId ? parseInt(currentWindowId, 10) : 0;

  return (
    <div className={`spaces-list ${className}`.trim()} data-testid="spaces-list">
      {/* Active Spaces */}
      {spaces.map((space, index) => {
        const isCurrent = space.windowId?.toString() === currentWindowId;
        return (
          <UnifiedSpaceItem
            key={space.id}
            space={space}
            isSelected={selectedIndex === index}
            isCurrent={isCurrent}
            isEditing={editingSpaceId === space.id}
            editingName={editingName}
            onEdit={(space) => handleSpaceAction({ type: 'edit' }, space)}
            onSave={() => handleSpaceAction({ type: 'save' })}
            onCancel={() => handleSpaceAction({ type: 'cancel' })}
            onSwitch={(windowId) => handleSpaceAction({ type: 'switch' }, undefined, undefined, windowId)}
            onRestore={(space) => handleSpaceAction({ type: 'restore' }, space)}
            onDelete={(spaceId) => handleSpaceAction({ type: 'delete' }, undefined, spaceId)}
            onEditNameChange={(name) => handleSpaceAction({ type: 'editNameChange' }, undefined, undefined, undefined, name)}
            getDisplayName={getDisplayName}
            renderActions={isCurrent && !isActiveTabPinned ? () => (
              <MoveTabDropdown
                spaces={spaces}
                currentWindowId={currentWindowIdNum}
                onMoveToNewSpace={handleMoveToNewSpace}
                onMoveToExistingSpace={handleMoveToExistingSpace}
              />
            ) : undefined}
          />
        );
      })}

      {/* Closed Spaces Section */}
      {closedSpaces.length > 0 && (
        <>
          <div className="section-header" data-testid="closed-spaces-header">
            Recently Closed
          </div>
          {closedSpaces.map((space, index) => (
            <UnifiedSpaceItem
              key={space.id}
              space={space}
              isSelected={selectedIndex === spaces.length + index}
              isCurrent={false}
              isEditing={false}
              editingName=""
              onEdit={() => {}}
              onSave={() => {}}
              onCancel={() => {}}
              onSwitch={() => {}}
              onRestore={(space) => handleSpaceAction({ type: 'restore' }, space)}
              onDelete={(spaceId) => handleSpaceAction({ type: 'delete' }, undefined, spaceId)}
              onEditNameChange={() => {}}
              getDisplayName={getDisplayName}
            />
          ))}
        </>
      )}
    </div>
  );
});

UnifiedSpacesList.displayName = 'UnifiedSpacesList';

export default UnifiedSpacesList;