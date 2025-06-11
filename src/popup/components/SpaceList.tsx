import React, { useCallback, useMemo, useEffect } from 'react';
import { Space } from '@/shared/types/Space';
import { useAppSelector, useAppDispatch } from '../../shared/hooks/storeHooks';
import { selectSpace } from '../store/slices/spacesSlice';
import { CssClasses } from '@/shared/constants';
import { useContextMenu } from '../hooks/useContextMenu';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import SpaceItem from './SpaceItem';
import useIntersectionObserver from '../hooks/useIntersectionObserver';
import { injectListStyles } from './SpaceList.styles';

const SPACE_ITEM_HEIGHT = 72; // Height of each space item in pixels
const INITIAL_LOAD_COUNT = 10; // Number of items to load initially

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
  useEffect(() => {
    injectListStyles();
  }, []);

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

  // All hooks must be called before any conditional returns
  const [loadedCount, setLoadedCount] = React.useState(INITIAL_LOAD_COUNT);
  
  const { show: showContextMenu, ContextMenu } = useContextMenu({
    items: () => [
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
  const sortedSpaces = useMemo(() => {
    return Object.entries(spaces)
      .sort(([, a], [, b]) => b.lastModified - a.lastModified)
      .slice(0, loadedCount);
  }, [spaces, loadedCount]);

  const loadMoreRef = React.useRef(null);
  const handleLoadMore = useCallback(() => {
    if (Object.keys(spaces).length > loadedCount) {
      setLoadedCount(prev => prev + INITIAL_LOAD_COUNT);
    }
  }, [spaces, loadedCount]);
  
  useIntersectionObserver(loadMoreRef, handleLoadMore);

  const Row = useCallback(({ index, style, data }: ListChildComponentProps<[string, Space][]>) => {
    const [id, space] = data![index];
    const isSelected = id === selectedSpaceId;
    const isCurrent = id === currentWindowId;

    return (
      <li
        style={style}
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
          isLoaded={index < loadedCount}
        />
      </li>
    );
  }, [selectedSpaceId, currentWindowId, handleSpaceClick, showContextMenu, type, editMode, loadedCount]);

  return (
    <>
      <div className="space-list-header">
        <h2>{type === 'active' ? 'Active Spaces' : 'Closed Spaces'}</h2>
      </div>
      <div className="space-list-container">
        <AutoSizer>
          {({ height, width }: { height: number; width: number }) => (
            <FixedSizeList<[string, Space][]>
              height={height}
              itemCount={sortedSpaces.length}
              itemSize={SPACE_ITEM_HEIGHT}
              width={width}
              overscanCount={5}
              itemData={sortedSpaces}
            >
              {Row}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>
      <div ref={loadMoreRef} className="infinite-scroll-trigger" />
      <ContextMenu />
    </>
  );
};
