import { useCallback, useState, useRef, MutableRefObject } from 'react';
import { Space } from '@/shared/types/Space';

export interface UnifiedPopupNavigationProps {
  filteredSpaces: Space[];
  filteredClosedSpaces: Space[];
  editingSpaceId: string | null;
  onSwitchToSpace: (windowId: number) => void;
  onRestoreSpace: (space: Space) => void;
  onStartEditing: (space: Space) => void;
  onCancelEdit: () => void;
}

export interface UnifiedPopupNavigationReturn {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export const useUnifiedPopupNavigation = ({
  filteredSpaces,
  filteredClosedSpaces,
  editingSpaceId,
  onSwitchToSpace,
  onRestoreSpace,
  onStartEditing,
  onCancelEdit
}: UnifiedPopupNavigationProps): UnifiedPopupNavigationReturn => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredSpaces.length + filteredClosedSpaces.length;

    if (totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex < filteredSpaces.length) {
          const space = filteredSpaces[selectedIndex];
          if (space.windowId) {
            onSwitchToSpace(space.windowId);
          }
        } else {
          const closedSpace = filteredClosedSpaces[selectedIndex - filteredSpaces.length];
          if (closedSpace) {
            onRestoreSpace(closedSpace);
          }
        }
        break;

      case 'F2':
        e.preventDefault();
        if (selectedIndex < filteredSpaces.length) {
          const space = filteredSpaces[selectedIndex];
          onStartEditing(space);
        }
        break;

      case 'Escape':
        if (editingSpaceId) {
          onCancelEdit();
        } else {
          window.close();
        }
        break;

      default:
        // Allow other keys to pass through (for search input, etc.)
        break;
    }
  }, [
    selectedIndex,
    filteredSpaces,
    filteredClosedSpaces,
    editingSpaceId,
    onSwitchToSpace,
    onRestoreSpace,
    onStartEditing,
    onCancelEdit
  ]);

  // Reset selected index when filtered results change
  const resetSelectedIndex = useCallback(() => {
    setSelectedIndex(0);
  }, []);

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown
  };
};