import { ActionTypes } from '@/shared/constants';
import {
  SpacesState,
  BaseAction,
  AsyncAction,
  createAction,
  createAsyncAction,
  FetchSpacesResponse,
  isAsyncAction,
  OptimisticUpdate,
  ActionQueue,
  AppDispatch,
  RootState
} from '../types';

// Message timeout configuration (15 seconds allows for service worker initialization)
const MESSAGE_TIMEOUT = 15000;

// Retry configuration for fetchSpaces
const MAX_RETRIES = 3;

// Optimistic update timeout configuration (5 seconds)
const OPTIMISTIC_UPDATE_TIMEOUT = 5000;

// Stale optimistic update threshold (10 seconds)
const STALE_OPTIMISTIC_UPDATE_THRESHOLD = 10000;

// Store timeout IDs externally (cannot be in Redux state)
const optimisticUpdateTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Initial state
const initialState: SpacesState = {
  spaces: {},
  closedSpaces: {},
  currentWindowId: null,
  isLoading: false,
  error: null,
  selectedSpaceId: null,
  searchQuery: '',
  editMode: false,
  // Optimization features
  optimisticUpdates: {},
  actionQueue: [],
  lastSyncTimestamp: 0,
  syncInProgress: false,
  operationErrors: {}
};

// Action Types
export const FETCH_SPACES = 'spaces/fetchAll';
export const RENAME_SPACE = 'spaces/rename';
export const CLOSE_SPACE = 'spaces/close';
export const SWITCH_TO_SPACE = 'spaces/switchTo';
export const RESTORE_SPACE = 'spaces/restore';
export const REMOVE_CLOSED_SPACE = 'spaces/removeClosed';
export const SET_CURRENT_WINDOW = 'spaces/setCurrentWindow';
export const SELECT_SPACE = 'spaces/selectSpace';
export const CLEAR_ERROR = 'spaces/clearError';
export const SET_SEARCH = 'spaces/setSearch';
export const TOGGLE_EDIT_MODE = 'spaces/toggleEditMode';
export const UPDATE_SPACE_NAME = 'spaces/updateSpaceName';
export const ADD_OPTIMISTIC_UPDATE = 'spaces/addOptimisticUpdate';
export const REMOVE_OPTIMISTIC_UPDATE = 'spaces/removeOptimisticUpdate';
export const ROLLBACK_OPTIMISTIC_UPDATE = 'spaces/rollbackOptimisticUpdate';
export const ADD_TO_ACTION_QUEUE = 'spaces/addToActionQueue';
export const REMOVE_FROM_ACTION_QUEUE = 'spaces/removeFromActionQueue';
export const SET_OPERATION_ERROR = 'spaces/setOperationError';
export const CLEAR_OPERATION_ERROR = 'spaces/clearOperationError';
export const CLEANUP_STALE_OPTIMISTIC_UPDATES = 'spaces/cleanupStaleOptimisticUpdates';

export const setSearch = createAction<string>(SET_SEARCH);
export const toggleEditMode = createAction(TOGGLE_EDIT_MODE);
export const updateSpaceName = createAction<{ id: string; name: string }>(UPDATE_SPACE_NAME);
export const addOptimisticUpdate = createAction<OptimisticUpdate>(ADD_OPTIMISTIC_UPDATE);
export const removeOptimisticUpdate = createAction<string>(REMOVE_OPTIMISTIC_UPDATE);
export const rollbackOptimisticUpdate = createAction<string>(ROLLBACK_OPTIMISTIC_UPDATE);
export const addToActionQueue = createAction<ActionQueue>(ADD_TO_ACTION_QUEUE);
export const removeFromActionQueue = createAction<string>(REMOVE_FROM_ACTION_QUEUE);
export const setOperationError = createAction<{ id: string; error: string }>(SET_OPERATION_ERROR);
export const clearOperationError = createAction<string>(CLEAR_OPERATION_ERROR);
const cleanupStaleOptimisticUpdatesAction = createAction(CLEANUP_STALE_OPTIMISTIC_UPDATES);

/**
 * Clears the timeout for an optimistic update.
 * Should be called when confirming or rolling back an update.
 */
export function clearOptimisticUpdateTimeout(updateId: string): void {
  const timeoutId = optimisticUpdateTimeouts.get(updateId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    optimisticUpdateTimeouts.delete(updateId);
  }
}

/**
 * Thunk action creator that adds an optimistic update with timeout protection.
 * Automatically rolls back the update after OPTIMISTIC_UPDATE_TIMEOUT if not confirmed.
 */
export const addOptimisticUpdateWithTimeout = (update: OptimisticUpdate) => {
  return (dispatch: AppDispatch) => {
    // Clear any existing timeout for this update ID
    clearOptimisticUpdateTimeout(update.id);

    // Add the optimistic update
    dispatch(addOptimisticUpdate(update));

    // Set up auto-rollback timeout
    const timeoutId = setTimeout(() => {
      optimisticUpdateTimeouts.delete(update.id);

      // Dispatch rollback with error message
      dispatch(rollbackOptimisticUpdate(update.id));

      // Set user-visible error based on operation type
      const errorMessage = getTimeoutErrorMessage(update.type);
      dispatch(setOperationError({ id: update.id, error: errorMessage }));

      console.warn(`[Optimistic Update] Timeout: ${update.type} operation for ${update.id} timed out after ${OPTIMISTIC_UPDATE_TIMEOUT}ms`);
    }, OPTIMISTIC_UPDATE_TIMEOUT);

    optimisticUpdateTimeouts.set(update.id, timeoutId);
  };
};

/**
 * Thunk action creator that removes an optimistic update and clears its timeout.
 * Use this when the operation succeeds.
 */
export const confirmOptimisticUpdate = (updateId: string) => {
  return (dispatch: AppDispatch) => {
    clearOptimisticUpdateTimeout(updateId);
    dispatch(removeOptimisticUpdate(updateId));
  };
};

/**
 * Thunk action creator that rolls back an optimistic update with an error message.
 * Use this when the operation fails.
 */
export const rollbackOptimisticUpdateWithError = (updateId: string, errorMessage?: string) => {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    clearOptimisticUpdateTimeout(updateId);

    const state = getState();
    const update = state.spaces.optimisticUpdates[updateId];

    dispatch(rollbackOptimisticUpdate(updateId));

    // Set user-visible error
    const message = errorMessage || getFailureErrorMessage(update?.type);
    dispatch(setOperationError({ id: updateId, error: message }));
  };
};

/**
 * Thunk action creator that cleans up stale optimistic updates.
 * Should be called during state reconciliation (when new state arrives from background).
 */
export const cleanupStaleOptimisticUpdates = () => {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const now = Date.now();
    const staleUpdateIds: string[] = [];

    // Find stale optimistic updates
    Object.entries(state.spaces.optimisticUpdates).forEach(([id, update]) => {
      if (now - update.timestamp > STALE_OPTIMISTIC_UPDATE_THRESHOLD) {
        staleUpdateIds.push(id);
      }
    });

    // Clean up each stale update
    staleUpdateIds.forEach(id => {
      clearOptimisticUpdateTimeout(id);
      dispatch(rollbackOptimisticUpdate(id));
      console.warn(`[Optimistic Update] Cleaned up stale update: ${id}`);
    });

    if (staleUpdateIds.length > 0) {
      dispatch(cleanupStaleOptimisticUpdatesAction());
    }
  };
};

/**
 * Get error message for timeout based on operation type.
 */
function getTimeoutErrorMessage(type?: OptimisticUpdate['type']): string {
  switch (type) {
    case 'rename':
      return 'Failed to rename space: operation timed out. Changes reverted.';
    case 'close':
      return 'Failed to close space: operation timed out. Changes reverted.';
    case 'restore':
      return 'Failed to restore space: operation timed out. Changes reverted.';
    case 'remove':
      return 'Failed to remove space: operation timed out. Changes reverted.';
    default:
      return 'Operation timed out. Changes reverted.';
  }
}

/**
 * Get error message for failure based on operation type.
 */
function getFailureErrorMessage(type?: OptimisticUpdate['type']): string {
  switch (type) {
    case 'rename':
      return 'Failed to rename space. Changes reverted.';
    case 'close':
      return 'Failed to close space. Changes reverted.';
    case 'restore':
      return 'Failed to restore space. Changes reverted.';
    case 'remove':
      return 'Failed to remove space. Changes reverted.';
    default:
      return 'Operation failed. Changes reverted.';
  }
}

// Sync Action Creators
export const setCurrentWindow = createAction<string>(SET_CURRENT_WINDOW);
export const selectSpace = createAction<string>(SELECT_SPACE);
export const clearError = createAction(CLEAR_ERROR);

// Async Action Creators
export const fetchSpaces = createAsyncAction(
  FETCH_SPACES,
  async () => {
    // Retry loop with exponential backoff (1s, 2s, 3s)
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Create a timeout promise that rejects after MESSAGE_TIMEOUT
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Message timeout: background service did not respond within ${MESSAGE_TIMEOUT / 1000} seconds`)),
          MESSAGE_TIMEOUT
        )
      );

      try {
        console.log(`[fetchSpaces] Attempt ${attempt} of ${MAX_RETRIES}`);

        // Race between the actual message and the timeout
        const response = await Promise.race([
          chrome.runtime.sendMessage({
            action: ActionTypes.GET_ALL_SPACES
          }),
          timeoutPromise
        ]);

        console.log(`[fetchSpaces] Success on attempt ${attempt}`);
        return response as FetchSpacesResponse;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[fetchSpaces] Attempt ${attempt} failed:`, errorMessage);

        // If this was the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          console.error(`[fetchSpaces] All ${MAX_RETRIES} attempts exhausted, giving up`);
          throw error;
        }

        // Wait with exponential backoff before retrying (1s, 2s, 3s)
        const backoffMs = 1000 * attempt;
        console.log(`[fetchSpaces] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // This should never be reached due to the throw in the loop,
    // but TypeScript needs it for type safety
    throw new Error('fetchSpaces: unexpected end of retry loop');
  }
);

// Enhanced rename with optimistic updates and retry logic
export const renameSpaceOptimistic = createAsyncAction(
  RENAME_SPACE,
  async ({ windowId, name }: { windowId: number; name: string }) => {
    await chrome.runtime.sendMessage({
      action: ActionTypes.RENAME_SPACE,
      windowId,
      name
    });
    return { windowId: windowId.toString(), name };
  }
);

// Keep original action for backward compatibility
export const renameSpace = renameSpaceOptimistic;

export const closeSpace = createAsyncAction(
  CLOSE_SPACE,
  async (windowId: number) => {
    await chrome.runtime.sendMessage({
      action: ActionTypes.CLOSE_SPACE,
      windowId
    });
    return windowId.toString();
  }
);

export const switchToSpace = createAsyncAction(
  SWITCH_TO_SPACE,
  async (windowId: number) => {
    return chrome.runtime.sendMessage({
      action: ActionTypes.SWITCH_TO_SPACE,
      windowId
    });
  }
);

export const restoreSpace = createAsyncAction(
  RESTORE_SPACE,
  async (spaceId: string) => {
    return chrome.runtime.sendMessage({
      action: ActionTypes.RESTORE_SPACE,
      spaceId
    });
  }
);

export const removeClosedSpace = createAsyncAction(
  REMOVE_CLOSED_SPACE,
  async (spaceId: string) => {
    await chrome.runtime.sendMessage({
      action: ActionTypes.REMOVE_CLOSED_SPACE,
      spaceId
    });
    return spaceId;
  }
);

// Reducer
export default function spacesReducer(
  state = initialState,
  action: BaseAction | AsyncAction
): SpacesState {
  switch (action.type) {
    case SET_CURRENT_WINDOW:
      return {
        ...state,
        currentWindowId: action.payload
      };

    case SELECT_SPACE:
      return {
        ...state,
        selectedSpaceId: action.payload
      };

    case CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case SET_SEARCH:
      return {
        ...state,
        searchQuery: action.payload
      };

    case TOGGLE_EDIT_MODE:
      return {
        ...state,
        editMode: !state.editMode
      };

    case UPDATE_SPACE_NAME: {
      const { id, name } = action.payload;
      if (state.spaces[id]) {
        return {
          ...state,
          spaces: {
            ...state.spaces,
            [id]: {
              ...state.spaces[id],
              name,
              lastModified: Date.now()
            }
          }
        };
      }
      return state;
    }

    case ADD_OPTIMISTIC_UPDATE: {
      const update = action.payload;
      const updatedState = { ...state, optimisticUpdates: { ...state.optimisticUpdates, [update.id]: update } };

      // Apply optimistic change based on type
      switch (update.type) {
        case 'rename': {
          const { spaceId, name } = update.payload;
          const space = updatedState.spaces[spaceId] || updatedState.closedSpaces[spaceId];
          if (space) {
            const targetCollection = updatedState.spaces[spaceId] ? 'spaces' : 'closedSpaces';
            updatedState[targetCollection] = {
              ...updatedState[targetCollection],
              [spaceId]: {
                ...space,
                name,
                customName: name,
                named: true,
                lastModified: Date.now()
              }
            };
          }
          break;
        }
        case 'close': {
          const { windowId } = update.payload;
          const spaceId = windowId.toString();
          const space = updatedState.spaces[spaceId];
          if (space) {
            const { [spaceId]: closedSpace, ...remainingSpaces } = updatedState.spaces;
            updatedState.spaces = remainingSpaces;
            updatedState.closedSpaces = {
              ...updatedState.closedSpaces,
              [spaceId]: {
                ...closedSpace,
                windowId: undefined,
                isActive: false,
                lastModified: Date.now()
              }
            };
          }
          break;
        }
        case 'restore': {
          const { spaceId } = update.payload;
          const space = updatedState.closedSpaces[spaceId];
          if (space) {
            const { [spaceId]: restoredSpace, ...remainingClosed } = updatedState.closedSpaces;
            updatedState.closedSpaces = remainingClosed;
            updatedState.spaces = {
              ...updatedState.spaces,
              [spaceId]: {
                ...restoredSpace,
                isActive: true,
                lastModified: Date.now()
              }
            };
          }
          break;
        }
      }

      return updatedState;
    }

    case REMOVE_OPTIMISTIC_UPDATE: {
      const updateId = action.payload;
      const { [updateId]: _removed, ...remainingUpdates } = state.optimisticUpdates;
      return {
        ...state,
        optimisticUpdates: remainingUpdates
      };
    }

    case ROLLBACK_OPTIMISTIC_UPDATE: {
      const updateId = action.payload;
      const update = state.optimisticUpdates[updateId];
      if (!update) return state;

      const { [updateId]: _removed, ...remainingUpdates } = state.optimisticUpdates;
      const updatedState = { ...state, optimisticUpdates: remainingUpdates };

      // Rollback the optimistic change
      switch (update.type) {
        case 'rename': {
          const { spaceId } = update.payload;
          const { name, customName } = update.rollbackData;
          const space = updatedState.spaces[spaceId] || updatedState.closedSpaces[spaceId];
          if (space) {
            const targetCollection = updatedState.spaces[spaceId] ? 'spaces' : 'closedSpaces';
            updatedState[targetCollection] = {
              ...updatedState[targetCollection],
              [spaceId]: {
                ...space,
                name,
                customName,
                named: !!customName
              }
            };
          }
          break;
        }
        case 'close': {
          // Rollback: Move space back from closedSpaces to spaces
          const { windowId } = update.payload;
          const spaceId = windowId.toString();
          const { space: originalSpace } = update.rollbackData;
          const closedSpace = updatedState.closedSpaces[spaceId];
          if (closedSpace && originalSpace) {
            const { [spaceId]: _removed, ...remainingClosed } = updatedState.closedSpaces;
            updatedState.closedSpaces = remainingClosed;
            updatedState.spaces = {
              ...updatedState.spaces,
              [spaceId]: {
                ...closedSpace,
                windowId: originalSpace.windowId,
                isActive: true
              }
            };
          }
          break;
        }
        case 'restore': {
          // Rollback: Move space back from spaces to closedSpaces
          const { spaceId } = update.payload;
          const { space: originalSpace } = update.rollbackData;
          const restoredSpace = updatedState.spaces[spaceId];
          if (restoredSpace && originalSpace) {
            const { [spaceId]: _removed, ...remainingSpaces } = updatedState.spaces;
            updatedState.spaces = remainingSpaces;
            updatedState.closedSpaces = {
              ...updatedState.closedSpaces,
              [spaceId]: {
                ...restoredSpace,
                windowId: undefined,
                isActive: false
              }
            };
          }
          break;
        }
      }

      return updatedState;
    }

    case ADD_TO_ACTION_QUEUE: {
      const queueItem = action.payload;
      return {
        ...state,
        actionQueue: [...state.actionQueue, queueItem]
      };
    }

    case REMOVE_FROM_ACTION_QUEUE: {
      const itemId = action.payload;
      return {
        ...state,
        actionQueue: state.actionQueue.filter(item => item.id !== itemId)
      };
    }

    case SET_OPERATION_ERROR: {
      const { id, error } = action.payload;
      return {
        ...state,
        operationErrors: {
          ...state.operationErrors,
          [id]: error
        }
      };
    }

    case CLEAR_OPERATION_ERROR: {
      const errorId = action.payload;
      const { [errorId]: _removed, ...remainingErrors } = state.operationErrors;
      return {
        ...state,
        operationErrors: remainingErrors
      };
    }

    case `${FETCH_SPACES}/pending`:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case `${FETCH_SPACES}/fulfilled`:
      return {
        ...state,
        isLoading: false,
        spaces: action.payload.spaces,
        closedSpaces: action.payload.closedSpaces
      };

    case `${FETCH_SPACES}/rejected`:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };

    case `${RENAME_SPACE}/fulfilled`: {
      const { windowId, name } = action.payload;
      if (state.spaces[windowId]) {
        return {
          ...state,
          spaces: {
            ...state.spaces,
            [windowId]: {
              ...state.spaces[windowId],
              name,
              customName: name, // Keep customName in sync
              named: true,
              lastModified: Date.now(),
              version: (state.spaces[windowId].version || 1) + 1
            }
          }
        };
      }
      return state;
    }

    case `${CLOSE_SPACE}/fulfilled`: {
      const windowId = action.payload;
      if (state.spaces[windowId]) {
        const { [windowId]: closedSpace, ...remainingSpaces } = state.spaces;
        return {
          ...state,
          spaces: remainingSpaces,
          closedSpaces: {
            ...state.closedSpaces,
            [windowId]: {
              ...closedSpace,
              lastModified: Date.now()
            }
          }
        };
      }
      return state;
    }

    case `${RESTORE_SPACE}/fulfilled`: {
      if (isAsyncAction(action) && action.payload.success) {
        const { [action.meta.arg]: _removed, ...remainingClosedSpaces } = state.closedSpaces;
        return {
          ...state,
          closedSpaces: remainingClosedSpaces
        };
      }
      return state;
    }

    case `${REMOVE_CLOSED_SPACE}/fulfilled`: {
      const { [action.payload]: _removed, ...remainingClosedSpaces } = state.closedSpaces;
      return {
        ...state,
        closedSpaces: remainingClosedSpaces
      };
    }

    default:
      return state;
  }
}
