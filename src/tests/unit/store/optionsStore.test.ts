import { store } from '../../../options/store';
import { updateGeneralSettings, loadSettings } from '../../../options/store/slices/settingsSlice';
import { SettingsState } from '../../../options/store/slices/settingsSlice';

describe('Options Store', () => {
  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const state = store.getState();
      expect(state.settings.general).toEqual({
        theme: 'system',
        saveOnClose: true,
        confirmDeletion: true,
        autoRestore: false,
      });
    });
  });

  describe('General Settings', () => {
    it('should update autoRestore setting', () => {
      store.dispatch(updateGeneralSettings({ autoRestore: true }));
      const state = store.getState();
      expect(state.settings.general.autoRestore).toBe(true);
    });

    it('should update multiple general settings', () => {
      store.dispatch(updateGeneralSettings({
        autoRestore: true,
        saveOnClose: false,
        theme: 'dark' as const
      }));
      
      const state = store.getState();
      expect(state.settings.general).toMatchObject({
        autoRestore: true,
        saveOnClose: false,
        theme: 'dark'
      });
    });
  });

  describe('Settings Loading', () => {
    it('should load valid settings', () => {
      const newSettings: SettingsState = {
        general: {
          theme: 'dark',
          saveOnClose: false,
          confirmDeletion: false,
          autoRestore: true,
        },
        shortcuts: {
          enabled: true,
          openPopup: 'Ctrl+Shift+S',
          nextSpace: 'Ctrl+Shift+N',
          prevSpace: 'Ctrl+Shift+P',
        },
      };

      store.dispatch(loadSettings(newSettings));
      const state = store.getState();
      expect(state.settings).toEqual(newSettings);
    });

    it('should reject invalid settings', () => {
      const initialState = store.getState();
      const invalidSettings = {
        general: {
          theme: 'invalid',
          saveOnClose: 'not-a-boolean',
          confirmDeletion: null,
          autoRestore: 'not-a-boolean',
        },
      };

      // @ts-expect-error Testing invalid type
      store.dispatch(loadSettings(invalidSettings));
      const state = store.getState();
      expect(state.settings).toEqual(initialState.settings);
    });
  });
});