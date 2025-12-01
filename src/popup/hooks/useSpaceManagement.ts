import { useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Space } from '@/shared/types/Space';
import { RootState, AppDispatch } from '../store/types';
import {
  renameSpaceOptimistic,
  switchToSpace,
  restoreSpace,
  removeClosedSpace,
  fetchSpaces
} from '../store/slices/spacesSlice';

const MAX_NAME_LENGTH = 100;

export interface SpaceManagementState {
  editingSpaceId: string | null;
  editingName: string;
  showConfirmDelete: string | null;
  existingNames: Set<string>;
}

export interface SpaceManagementActions {
  startEditing: (space: Space) => void;
  handleSaveEdit: () => Promise<void>;
  handleCancelEdit: () => void;
  handleEditNameChange: (name: string) => void;
  handleSwitchToSpace: (windowId: number) => Promise<void>;
  handleRestoreSpace: (space: Space) => Promise<void>;
  handleRemoveSpace: (spaceId: string) => Promise<void>;
  showDeleteConfirmation: (spaceId: string) => void;
  hideDeleteConfirmation: () => void;
  validateSpaceName: (name: string, currentSpaceId?: string) => { valid: boolean; error?: string };
}

export const useSpaceManagement = (): SpaceManagementState & SpaceManagementActions => {
  const dispatch = useDispatch<AppDispatch>();
  const { spaces, closedSpaces } = useSelector((state: RootState) => state.spaces);

  // Local state for editing and confirmation
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  // Get display name for a space
  const getDisplayName = useCallback((space: Space): string => {
    return space.name;
  }, []);

  // Calculate existing names set
  const existingNames = useMemo(() => {
    const allNames = new Set<string>();
    // Process active spaces
    Object.values(spaces).forEach(space => {
      if (space.isActive) {
        const displayName = getDisplayName(space);
        allNames.add(displayName.toLowerCase());
      }
    });
    // Process closed spaces
    Object.values(closedSpaces).forEach(space => {
      if (!space.isActive) {
        const displayName = getDisplayName(space);
        allNames.add(displayName.toLowerCase());
      }
    });
    return allNames;
  }, [spaces, closedSpaces, getDisplayName]);

  // Validate space name
  const validateSpaceName = useCallback((name: string, currentSpaceId?: string): { valid: boolean; error?: string } => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return { valid: false, error: 'Name cannot be empty' };
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` };
    }

    // Check for duplicate names (case-insensitive)
    const lowerName = trimmedName.toLowerCase();
    if (existingNames.has(lowerName)) {
      // Allow if it's the same space being edited
      const currentSpace = currentSpaceId ? spaces[currentSpaceId] || closedSpaces[currentSpaceId] : null;
      const currentName = currentSpace ? getDisplayName(currentSpace) : null;
      if (!currentName || currentName.toLowerCase() !== lowerName) {
        return { valid: false, error: 'This name is already used by another space' };
      }
    }

    return { valid: true };
  }, [existingNames, spaces, closedSpaces, getDisplayName]);

  // Start editing a space
  const startEditing = useCallback((space: Space) => {
    setEditingSpaceId(space.id);
    setEditingName(getDisplayName(space));
  }, [getDisplayName]);

  // Handle save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingSpaceId) return;

    const validation = validateSpaceName(editingName, editingSpaceId);
    if (!validation.valid) {
      console.warn('[useSpaceManagement] Validation failed:', validation.error);
      return;
    }

    try {
      const space = spaces[editingSpaceId] || closedSpaces[editingSpaceId];
      if (space && space.windowId) {
        console.log(`[useSpaceManagement] Renaming space ${space.id} from "${getDisplayName(space)}" to "${editingName.trim()}"`);

        await dispatch(renameSpaceOptimistic({ windowId: space.windowId, name: editingName.trim() }));

        // Refresh data after rename to get the latest state
        await dispatch(fetchSpaces());

        console.log(`[useSpaceManagement] Successfully renamed space ${space.id}`);
      } else {
        console.error('[useSpaceManagement] Cannot rename space: missing windowId', space);
      }

      setEditingSpaceId(null);
      setEditingName('');
    } catch (err) {
      console.error('[useSpaceManagement] Failed to save space name:', err);
    }
  }, [editingSpaceId, editingName, validateSpaceName, spaces, closedSpaces, dispatch, getDisplayName]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingSpaceId(null);
    setEditingName('');
  }, []);

  // Handle edit name change
  const handleEditNameChange = useCallback((name: string) => {
    setEditingName(name);
  }, []);

  // Handle switch to space
  const handleSwitchToSpace = useCallback(async (windowId: number) => {
    try {
      await dispatch(switchToSpace(windowId));
      window.close();
    } catch (err) {
      console.error('Failed to switch to space:', err);
    }
  }, [dispatch]);

  // Handle restore space
  const handleRestoreSpace = useCallback(async (space: Space) => {
    try {
      await dispatch(restoreSpace(space.id));
      // Refresh data after restore
      await dispatch(fetchSpaces());
    } catch (err) {
      console.error('Failed to restore space:', err);
    }
  }, [dispatch]);

  // Handle remove space
  const handleRemoveSpace = useCallback(async (spaceId: string) => {
    try {
      await dispatch(removeClosedSpace(spaceId));
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Failed to remove space:', err);
    }
  }, [dispatch]);

  // Show delete confirmation
  const showDeleteConfirmation = useCallback((spaceId: string) => {
    setShowConfirmDelete(spaceId);
  }, []);

  // Hide delete confirmation
  const hideDeleteConfirmation = useCallback(() => {
    setShowConfirmDelete(null);
  }, []);

  return {
    // State
    editingSpaceId,
    editingName,
    showConfirmDelete,
    existingNames,

    // Actions
    startEditing,
    handleSaveEdit,
    handleCancelEdit,
    handleEditNameChange,
    handleSwitchToSpace,
    handleRestoreSpace,
    handleRemoveSpace,
    showDeleteConfirmation,
    hideDeleteConfirmation,
    validateSpaceName
  };
};