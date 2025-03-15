import { Space } from '@/shared/types/Space';

export interface RootState {
  spaces: SpacesState;
}

export interface SpacesState {
  spaces: Record<string, Space>;
  closedSpaces: Record<string, Space>;
  currentWindowId: string | null;
  isLoading: boolean;
  error: string | null;
  selectedSpaceId: string | null;
}

// Action types
export interface BaseAction<T = any> {
  type: string;
  payload?: T;
  error?: boolean;
}

export interface AsyncActionMeta {
  arg: any;
  requestId: string;
  requestStatus: 'pending' | 'fulfilled' | 'rejected';
}

export interface AsyncAction<T = any> extends BaseAction<T> {
  meta: AsyncActionMeta;
}

// Response types
export interface FetchSpacesResponse {
  spaces: Record<string, Space>;
  closedSpaces: Record<string, Space>;
}

export interface SwitchToSpaceResponse {
  success: boolean;
  spaces?: Record<string, Space>;
  error?: string;
}

export interface RestoreSpaceResponse {
  success: boolean;
  windowId?: number;
  error?: string;
}

// Thunk types
export type AppDispatch = {
  <A extends BaseAction | AsyncAction>(action: A): A;
  <R>(asyncAction: AppThunk<R>): R;
};

export type AppThunk<R = void> = (
  dispatch: AppDispatch,
  getState: () => RootState
) => R;

// Action creator types
export type ActionCreator<T = void> = T extends void
  ? () => BaseAction
  : (payload: T) => BaseAction<T>;

export type AsyncActionCreator<Args = void, Result = void> = (
  args: Args
) => AppThunk<Promise<Result>>;

// Helper functions
export function createAction<T = void>(type: string): ActionCreator<T> {
  return ((payload?: T) => ({ type, payload })) as ActionCreator<T>;
}

export function createAsyncAction<Args = void, Result = void>(
  type: string,
  payloadCreator: (args: Args) => Promise<Result>
): AsyncActionCreator<Args, Result> {
  return (args: Args) => async (dispatch) => {
    const requestId = Math.random().toString(36).substring(7);
    
    dispatch({
      type: `${type}/pending`,
      meta: {
        arg: args,
        requestId,
        requestStatus: 'pending'
      }
    });

    try {
      const result = await payloadCreator(args);
      dispatch({
        type: `${type}/fulfilled`,
        payload: result,
        meta: {
          arg: args,
          requestId,
          requestStatus: 'fulfilled'
        }
      });
      return result;
    } catch (error) {
      dispatch({
        type: `${type}/rejected`,
        error: true,
        payload: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          arg: args,
          requestId,
          requestStatus: 'rejected'
        }
      });
      throw error;
    }
  };
}

// Type guards
export function isAsyncAction(action: BaseAction | AsyncAction): action is AsyncAction {
  return 'meta' in action && 
    'requestStatus' in (action as AsyncAction).meta;
}
