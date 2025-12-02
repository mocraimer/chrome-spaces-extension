import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchSpaces, cleanupStaleOptimisticUpdates } from '../store/slices/spacesSlice';
import { MessageTypes } from '@/shared/constants';
import { store } from '../store';

// Get AppDispatch type from store
type AppDispatch = typeof store.dispatch;

/**
 * Component that listens to broadcast messages from the background
 * and updates the popup state in real-time
 */
export const BroadcastListener: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const handleMessage = (message: any) => {
      // Only handle state update messages
      if (message.type === MessageTypes.SPACES_UPDATED ||
          message.type === MessageTypes.SPACE_UPDATED ||
          message.type === MessageTypes.STATE_CHANGED) {
        // Clean up any stale optimistic updates before fetching new state
        dispatch(cleanupStaleOptimisticUpdates());
        // Refresh spaces data when state changes
        dispatch(fetchSpaces());
      }
    };

    // Listen for broadcast messages from background
    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [dispatch]);

  // This component doesn't render anything
  return null;
};

export default BroadcastListener;