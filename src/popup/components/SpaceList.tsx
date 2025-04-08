import React from 'react';
import { Space } from '@/shared/types/Space';
import { useAppSelector, useAppDispatch } from '../../shared/hooks/storeHooks';
import { selectSpace, toggleEditMode } from '../store/slices/spacesSlice';
import { CssClasses } from '@/shared/constants';
import { useContextMenu } from '../hooks/useContextMenu';
import SpaceItem from './SpaceItem';

interface SpaceListProps {
  spaces: Record<string, Space>;
  type: 'active' | 'closed';
  onSpaceAction: (spaceId: string, action: 'switch' | 'restore' | 'delete') => void;
}

export const SpaceList: React.FC<SpaceListProps> = ({
  spaces,
  type,
  onSpaceAction
}) => {
  const selectedSpaceId = useAppSelector(state => state.spaces.selectedSpaceId);
  const currentWindowId = useAppSelector(state => state.spaces.currentWindowId);
  const editMode = useAppSelector(state => state.spaces.editMode);
  const dispatch = useAppDispatch();

  const handleSpaceClick = (spaceId: string) => {
    dispatch(selectSpace(spaceId));
  };

  const handleActionClick = (
    e: React.MouseEvent,
    spaceId: string,
    action: 'switch' | 'restore' | 'delete'
  ) => {
    e.stopPropagation();
    onSpaceAction(spaceId, action);
  };

  const { show: showContextMenu, ContextMenu } = useContextMenu({
    items: [
      {
        id: 'delete',
        label: 'Delete Space',
        icon: '🗑️',
        onClick: () => {
          if (selectedSpaceId) {
            onSpaceAction(selectedSpaceId, 'delete');
          }
        }
      }
    ]
  });

  if (Object.keys(spaces).length === 0) {
    return (
      <div className={CssClasses.EMPTY_LIST}>
        No {type} spaces found
      </div>
    );
  }

  return (
    <>
      <div className="space-list-header">
        <h2>{type === 'active' ? 'Active Spaces' : 'Closed Spaces'}</h2>
      </div>
      <ul className="space-list">
        {Object.entries(spaces).map(([id, space]) => {
          const isSelected = id === selectedSpaceId;
          const isCurrent = id === currentWindowId;

          return (
            <li
              key={id}
              className={`${CssClasses.SPACE_ITEM} ${
                isSelected ? CssClasses.ENTER_TARGET : ''
              } ${isCurrent ? 'current' : ''}`}
              onClick={() => handleSpaceClick(id)}
              onContextMenu={showContextMenu}
              data-id={id}
            >
              <SpaceItem
                space={space}
                onSwitchClick={(e) => handleActionClick(e, id, type === 'active' ? 'switch' : 'restore')}
                showActions={!isCurrent}
                actionLabel={type === 'active' ? 'Switch' : 'Restore'}
                isEditing={editMode && isSelected}
              />
            </li>
          );
        })}
      </ul>
      <ContextMenu />
    </>
  );
};
