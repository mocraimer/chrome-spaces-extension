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
  ActionQueue
} from '../types';

// Message timeout configuration (10 seconds allows for service worker initialization)
const MESSAGE_TIMEOUT = 10000;

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

// Sync Action Creators
export const setCurrentWindow = createAction<string>(SET_CURRENT_WINDOW);
export const selectSpace = createAction<string>(SELECT_SPACE);
export const clearError = createAction(CLEAR_ERROR);

// Async Action Creators
export const fetchSpaces = createAsyncAction(
  FETCH_SPACES,
  async () => {
    // Create a timeout promise that rejects after MESSAGE_TIMEOUT
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Message timeout: background service did not respond within 10 seconds')),
        MESSAGE_TIMEOUT
      )
    );

    try {
      // Race between the actual message and the timeout
      const response = await Promise.race([
        chrome.runtime.sendMessage({
          action: ActionTypes.GET_ALL_SPACES
        }),
        timeoutPromise
      ]);
      return response as FetchSpacesResponse;
    } catch (error) {
      // Log the error for debugging
      console.error('[fetchSpaces] Error fetching spaces:', error instanceof Error ? error.message : String(error));
      throw error;
    }
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
