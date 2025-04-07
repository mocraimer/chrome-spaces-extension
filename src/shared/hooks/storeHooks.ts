import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../types/store';

// Debug logging
const logHookUsage = (hookName: string) => {
  console.log(`[Redux Hook] ${hookName} called`);
};

// Type-safe hooks
export function useAppDispatch() {
  logHookUsage('useAppDispatch');
  const dispatch = useDispatch();
  return dispatch as AppDispatch;
}

export function useAppSelector<Selected = unknown>(
  selector: (state: RootState) => Selected
): Selected {
  logHookUsage('useAppSelector');
  return useSelector(selector);
}