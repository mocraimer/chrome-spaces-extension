import { useMemo, useCallback } from 'react';
import { Space } from '@/shared/types/Space';

export interface SpaceFilteringResult {
  filteredSpaces: Space[];
  filteredClosedSpaces: Space[];
  totalFilteredCount: number;
  hasResults: boolean;
}

export const useSpaceFiltering = (
  spaces: Record<string, Space>,
  closedSpaces: Record<string, Space>,
  searchQuery: string
): SpaceFilteringResult => {
  // Get display name for a space (custom name takes precedence)
  const getDisplayName = useCallback((space: Space): string => {
    return space.customName || space.name;
  }, []);

  // Filter function for spaces based on search query
  const filterSpaces = useCallback((spacesArray: Space[], query: string): Space[] => {
    if (!query.trim()) {
      return spacesArray;
    }

    const lowerQuery = query.toLowerCase();
    return spacesArray.filter(space => {
      const displayName = getDisplayName(space);
      // Search in display name
      if (displayName.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in URLs
      return space.urls.some(url => url.toLowerCase().includes(lowerQuery));
    });
  }, [getDisplayName]);

  // Convert spaces objects to arrays and apply filtering
  const result = useMemo(() => {
    // Convert to arrays, filtering for active/inactive status
    const activeSpacesArray = Object.values(spaces).filter(space => space.isActive);
    const closedSpacesArray = Object.values(closedSpaces).filter(space => !space.isActive);

    // Apply search filtering
    const filteredSpaces = filterSpaces(activeSpacesArray, searchQuery);
    const filteredClosedSpaces = filterSpaces(closedSpacesArray, searchQuery);

    const totalFilteredCount = filteredSpaces.length + filteredClosedSpaces.length;
    const hasResults = totalFilteredCount > 0;

    return {
      filteredSpaces,
      filteredClosedSpaces,
      totalFilteredCount,
      hasResults
    };
  }, [spaces, closedSpaces, searchQuery, filterSpaces]);

  return result;
};