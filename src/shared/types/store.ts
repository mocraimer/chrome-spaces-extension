import {
  SpacesState,
  BaseAction,
  AsyncAction,
  AppThunk
} from '../../popup/store/types';

// Re-export the store structure
export interface RootState {
  spaces: SpacesState;
}

// Type-safe dispatch that handles both sync and async actions
export type AppDispatch = {
  <A extends BaseAction | AsyncAction>(action: A): A;
  <R>(asyncAction: AppThunk<R>): Promise<R>;
};