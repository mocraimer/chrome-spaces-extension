import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isPlainObject } from '@reduxjs/toolkit';

export interface SettingsState {
  general: {
    theme: 'light' | 'dark' | 'system';
    saveOnClose: boolean;
    confirmDeletion: boolean;
    autoRestore: boolean;
  };
  shortcuts: {
    enabled: boolean;
    openPopup: string;
    nextSpace: string;
    prevSpace: string;
  };
}

const initialState: SettingsState = {
  general: {
    theme: 'system',
    saveOnClose: true,
    confirmDeletion: true,
    autoRestore: false,
  },
  shortcuts: {
    enabled: true,
    openPopup: 'Ctrl+Shift+Space',
    nextSpace: 'Ctrl+Shift+Right',
    prevSpace: 'Ctrl+Shift+Left',
  },
};

// Type guard for settings validation
export const isValidSettings = (settings: unknown): settings is SettingsState => {
  if (!isPlainObject(settings)) return false;
  const s = settings as Partial<SettingsState>;

  return (
    isPlainObject(s.general) &&
    ['light', 'dark', 'system'].includes(s.general?.theme || '') &&
    typeof s.general?.saveOnClose === 'boolean' &&
    typeof s.general?.confirmDeletion === 'boolean' &&
    typeof s.general?.autoRestore === 'boolean' &&
    isPlainObject(s.shortcuts) &&
    typeof s.shortcuts?.enabled === 'boolean' &&
    typeof s.shortcuts?.openPopup === 'string' &&
    typeof s.shortcuts?.nextSpace === 'string' &&
    typeof s.shortcuts?.prevSpace === 'string'
  );
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateGeneralSettings: (
      state,
      action: PayloadAction<Partial<SettingsState['general']>>
    ) => {
      state.general = { ...state.general, ...action.payload };
    },
    updateShortcuts: (
      state,
      action: PayloadAction<Partial<SettingsState['shortcuts']>>
    ) => {
      state.shortcuts = { ...state.shortcuts, ...action.payload };
    },
    loadSettings: (state, action: PayloadAction<SettingsState>) => {
      if (isValidSettings(action.payload)) {
        return action.payload;
      }
      return state;
    },
  },
});

export const { updateGeneralSettings, updateShortcuts, loadSettings } = settingsSlice.actions;
export default settingsSlice.reducer;