import { Middleware } from 'redux';
import { isPlainObject } from '@reduxjs/toolkit';

const safeSerialize = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(safeSerialize);
  }
  
  if (isPlainObject(obj)) {
    return Object.entries(obj).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: safeSerialize(value),
    }), {});
  }
  
  if (typeof obj === 'function' || typeof obj === 'symbol') {
    return undefined;
  }
  
  return obj;
};

export const validationMiddleware: Middleware = () => (next) => (action) => {
  // Create safe copy of action with serializable values
  const safeAction = {
    ...action,
    payload: safeSerialize(action.payload),
  };
  
  // Log warning if action was modified
  if (JSON.stringify(safeAction) !== JSON.stringify(action)) {
    console.warn(
      'Non-serializable values were detected in an action.',
      'Original:', action,
      'Sanitized:', safeAction
    );
  }
  
  return next(safeAction);
};