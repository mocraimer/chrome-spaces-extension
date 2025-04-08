# Options Page Configuration

## Available Settings

The options page provides various configuration settings for customizing the Chrome Spaces extension.

### General Settings

| Setting | Description | Type | Default |
|---------|-------------|------|---------|
| Theme | UI theme preference | `'light' \| 'dark' \| 'system'` | `'system'` |
| Animation Speed | Speed of UI animations | `'fast' \| 'normal' \| 'slow'` | `'normal'` |
| Notifications | Enable/disable notifications | `boolean` | `true` |
| Auto-save | Auto-save space changes | `boolean` | `true` |

### Spaces Settings

| Setting | Description | Type | Default |
|---------|-------------|------|---------|
| Default View | Default spaces list view | `'list' \| 'grid'` | `'list'` |
| Sort Order | Default sort order | `'name' \| 'created' \| 'updated'` | `'name'` |
| Group By | Group spaces by attribute | `'none' \| 'category' \| 'tag'` | `'none'` |
| Preview Mode | Tab preview style | `'hover' \| 'click' \| 'off'` | `'hover'` |

### Keyboard Settings

| Shortcut | Action | Default |
|----------|--------|---------|
| `Ctrl+Space` | Open extension popup | Enabled |
| `Ctrl+Shift+S` | Save current tabs as space | Enabled |
| `Ctrl+Shift+F` | Search spaces | Enabled |
| `Ctrl+Shift+N` | Create new space | Enabled |

## Configuration Types

### Type Definitions

```typescript
interface GeneralSettings {
  theme: 'light' | 'dark' | 'system';
  animationSpeed: 'fast' | 'normal' | 'slow';
  notifications: boolean;
  autoSave: boolean;
}

interface SpacesSettings {
  defaultView: 'list' | 'grid';
  sortOrder: 'name' | 'created' | 'updated';
  groupBy: 'none' | 'category' | 'tag';
  previewMode: 'hover' | 'click' | 'off';
}

interface KeyboardSettings {
  shortcuts: {
    [key: string]: {
      enabled: boolean;
      key: string;
      modifiers: string[];
    };
  };
}
```

## Storage Management

Settings are persisted in Chrome's sync storage:

```typescript
// Save settings
const saveSettings = async (settings: Settings) => {
  await chrome.storage.sync.set({ settings });
};

// Load settings
const loadSettings = async (): Promise<Settings> => {
  const { settings } = await chrome.storage.sync.get('settings');
  return settings ?? defaultSettings;
};
```

## Configuration Guidelines

### Adding New Settings

1. Define the setting type
2. Add default value
3. Update storage schema
4. Create UI components
5. Add validation

Example:

```typescript
// 1. Define type
interface NewFeatureSettings {
  enabled: boolean;
  mode: 'basic' | 'advanced';
  timeout: number;
}

// 2. Add defaults
const defaultNewFeatureSettings: NewFeatureSettings = {
  enabled: false,
  mode: 'basic',
  timeout: 3000
};

// 3. Update schema
interface Settings {
  general: GeneralSettings;
  spaces: SpacesSettings;
  keyboard: KeyboardSettings;
  newFeature: NewFeatureSettings; // Add new section
}

// 4. Create component
const NewFeatureSettings: React.FC = () => {
  const settings = useSelector(selectNewFeatureSettings);
  const dispatch = useDispatch();

  return (
    <ConfigSection title="New Feature">
      <ConfigOption
        type="checkbox"
        label="Enable Feature"
        value={settings.enabled}
        onChange={(enabled) => dispatch(updateNewFeatureSettings({ enabled }))}
      />
      {settings.enabled && (
        <>
          <ConfigOption
            type="select"
            label="Mode"
            value={settings.mode}
            options={[
              { label: 'Basic', value: 'basic' },
              { label: 'Advanced', value: 'advanced' }
            ]}
            onChange={(mode) => dispatch(updateNewFeatureSettings({ mode }))}
          />
          <ConfigOption
            type="number"
            label="Timeout (ms)"
            value={settings.timeout}
            onChange={(timeout) => dispatch(updateNewFeatureSettings({ timeout }))}
          />
        </>
      )}
    </ConfigSection>
  );
};
```

### Best Practices

1. **Validation**
   - Validate settings before saving
   - Provide default values
   - Handle migration of old settings

2. **UI/UX**
   - Group related settings
   - Use appropriate input types
   - Provide clear labels and descriptions

3. **Storage**
   - Handle storage limits
   - Implement error recovery
   - Use sync storage for cross-device support