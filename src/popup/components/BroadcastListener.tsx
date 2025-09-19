import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchSpaces } from '../store/slices/spacesSlice';
import { MessageTypes } from '@/shared/constants';

/**
 * Component that listens to broadcast messages from the background
 * and updates the popup state in real-time
 */
export const BroadcastListener: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const handleMessage = (message: any) => {
      // Only handle state update messages
      if (message.type === MessageTypes.SPACES_UPDATED ||
          message.type === MessageTypes.SPACE_UPDATED ||
          message.type === MessageTypes.STATE_CHANGED) {
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