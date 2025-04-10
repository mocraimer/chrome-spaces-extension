import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { updateGeneralSettings } from '../../store/slices/settingsSlice';
import { SettingsContainer, SettingItem, SettingsHeading } from './GeneralSettings.styles';

const GeneralSettings: React.FC = () => {
  const dispatch = useDispatch();
  const generalSettings = useSelector((state: RootState) => state.settings.general);

  const handleToggleChange = (setting: keyof typeof generalSettings) => {
    dispatch(updateGeneralSettings({ [setting]: !generalSettings[setting] }));
  };

  return (
    <SettingsContainer>
      <SettingsHeading>General Settings</SettingsHeading>
      <SettingItem>
        <label>
          <input
            type="checkbox"
            checked={generalSettings.autoRestore}
            onChange={() => handleToggleChange('autoRestore')}
          />
          Auto-restore spaces when Chrome starts
        </label>
      </SettingItem>
      <SettingItem>
        <label>
          <input
            type="checkbox"
            checked={generalSettings.saveOnClose}
            onChange={() => handleToggleChange('saveOnClose')}
          />
          Save spaces on window close
        </label>
      </SettingItem>
      <SettingItem>
        <label>
          <input
            type="checkbox"
            checked={generalSettings.confirmDeletion}
            onChange={() => handleToggleChange('confirmDeletion')}
          />
          Confirm before deleting spaces
        </label>
      </SettingItem>
    </SettingsContainer>
  );
};

export default GeneralSettings;