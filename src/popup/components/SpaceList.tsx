import React from 'react';
import { Space } from '@/shared/types/Space';
import { useAppSelector, useAppDispatch } from '../../shared/hooks/storeHooks';
import { selectSpace } from '../store/slices/spacesSlice';
import { CssClasses } from '@/shared/constants';
import { useContextMenu } from '../hooks/useContextMenu';

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
              <div className="space-info">
                <span className="space-icon">
                  {type === 'active' ? '🖥️' : '📁'}
                </span>
                <span className="space-name">{space.name}</span>
                <span className="space-tabs-count">
                  {space.urls.length} {space.urls.length === 1 ? 'tab' : 'tabs'}
                </span>
              </div>

              {!isCurrent && (
                <div className="space-actions">
                  <button
                    className={type === 'active' ? 'switch-btn' : 'restore-btn'}
                    onClick={(e) =>
                      handleActionClick(e, id, type === 'active' ? 'switch' : 'restore')
                    }
                  >
                    {type === 'active' ? 'Switch' : 'Restore'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ContextMenu />
    </>
  );
};
