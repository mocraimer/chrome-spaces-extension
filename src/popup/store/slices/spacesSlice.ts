import { Space } from '@/shared/types/Space';
import { ActionTypes } from '@/shared/constants';
import {
  SpacesState,
  BaseAction,
  AsyncAction,
  createAction,
  createAsyncAction,
  FetchSpacesResponse,
  isAsyncAction
} from '../types';

// Initial state
const initialState: SpacesState = {
  spaces: {},
  closedSpaces: {},
  currentWindowId: null,
  isLoading: false,
  error: null,
  selectedSpaceId: null,
  searchQuery: ''
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
export const setSearch = createAction<string>(SET_SEARCH);

// Sync Action Creators
export const setCurrentWindow = createAction<string>(SET_CURRENT_WINDOW);
export const selectSpace = createAction<string>(SELECT_SPACE);
export const clearError = createAction(CLEAR_ERROR);

// Async Action Creators
export const fetchSpaces = createAsyncAction(
  FETCH_SPACES,
  async () => {
    const response = await chrome.runtime.sendMessage({
      action: ActionTypes.GET_ALL_SPACES
    });
    return response as FetchSpacesResponse;
  }
);

export const renameSpace = createAsyncAction(
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
              name
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
        const { [action.meta.arg]: _, ...remainingClosedSpaces } = state.closedSpaces;
        return {
          ...state,
          closedSpaces: remainingClosedSpaces
        };
      }
      return state;
    }

    case `${REMOVE_CLOSED_SPACE}/fulfilled`: {
      const { [action.payload]: _, ...remainingClosedSpaces } = state.closedSpaces;
      return {
        ...state,
        closedSpaces: remainingClosedSpaces
      };
    }

    default:
      return state;
  }
}
