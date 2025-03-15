import { useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  showClosedSpaces: boolean;
  autoCloseEmpty: boolean;
  confirmSpaceClose: boolean;
  groupTabs: boolean;
  sortSpacesBy: 'name' | 'created' | 'lastModified';
  hotkeys: {
    enabled: boolean;
    shortcuts: Record<string, string>;
  };
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  compactMode: false,
  showClosedSpaces: true,
  autoCloseEmpty: false,
  confirmSpaceClose: true,
  groupTabs: true,
  sortSpacesBy: 'lastModified',
  hotkeys: {
    enabled: true,
    shortcuts: {
      createSpace: 'ctrl+n',
      closeSpace: 'ctrl+w',
      switchSpace: 'ctrl+[num]',
      search: '/',
      help: '?'
    }
  }
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from storage
  const loadPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await chrome.storage.sync.get('preferences');
      const storedPreferences = result.preferences as UserPreferences | undefined;

      if (storedPreferences) {
        // Merge with defaults to handle new preferences added in updates
        setPreferences({
          ...defaultPreferences,
          ...storedPreferences
        });
      } else {
        // No stored preferences, use defaults
        setPreferences(defaultPreferences);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
      console.error('Failed to load preferences:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to storage
  const savePreferences = useCallback(async (newPreferences: Partial<UserPreferences>) => {
    try {
      setError(null);

      const updatedPreferences = {
        ...preferences,
        ...newPreferences
      };

      await chrome.storage.sync.set({
        preferences: updatedPreferences
      });

      setPreferences(updatedPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      console.error('Failed to save preferences:', err);
      throw err;
    }
  }, [preferences]);

  // Update a single preference
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    return savePreferences({ [key]: value });
  }, [savePreferences]);

  // Reset preferences to defaults
  const resetPreferences = useCallback(async () => {
    try {
      await chrome.storage.sync.remove('preferences');
      setPreferences(defaultPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset preferences');
      console.error('Failed to reset preferences:', err);
      throw err;
    }
  }, []);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Listen for preference changes from other contexts
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === 'sync' && changes.preferences) {
        const newPreferences = changes.preferences.newValue;
        if (newPreferences) {
          setPreferences(newPreferences);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
    savePreferences,
    resetPreferences,
    reloadPreferences: loadPreferences
  };
}

// Example usage:
/*
const MyComponent: React.FC = () => {
  const { 
    preferences, 
    isLoading, 
    updatePreference 
  } = usePreferences();

  if (isLoading) return <div>Loading preferences...</div>;

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={preferences.compactMode}
          onChange={(e) => updatePreference('compactMode', e.target.checked)}
        />
        Compact Mode
      </label>
      <select
        value={preferences.theme}
        onChange={(e) => updatePreference('theme', e.target.value as 'light' | 'dark' | 'system')}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
};
*/
