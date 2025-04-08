# Options Page State Management

## Store Architecture

The options page uses Redux for state management, providing a centralized and predictable state container.

## Store Configuration

### Store Setup

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { optionsReducer } from './slices';
import { storageMiddleware } from './middleware';

export const store = configureStore({
  reducer: {
    options: optionsReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(storageMiddleware)
});
```

### State Structure

```typescript
interface OptionsState {
  settings: {
    general: GeneralSettings;
    spaces: SpacesSettings;
    keyboard: KeyboardSettings;
  };
  ui: {
    currentSection: string;
    isLoading: boolean;
    error: Error | null;
  };
}
```

## State Management Patterns

### Slices

Organize state into logical slices using Redux Toolkit:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateGeneralSettings: (state, action: PayloadAction<GeneralSettings>) => {
      state.general = { ...state.general, ...action.payload };
    },
    updateSpacesSettings: (state, action: PayloadAction<SpacesSettings>) => {
      state.spaces = { ...state.spaces, ...action.payload };
    }
  }
});
```

### Selectors

Use selectors for accessing state:

```typescript
const selectGeneralSettings = (state: RootState) => state.options.settings.general;
const selectSpacesSettings = (state: RootState) => state.options.settings.spaces;
```

### Actions

Define typed actions for state updates:

```typescript
export const { updateGeneralSettings, updateSpacesSettings } = settingsSlice.actions;
```

## Storage Integration

### Chrome Storage Sync

```typescript
const storageMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);
  
  if (action.type.startsWith('settings/')) {
    const state = store.getState();
    chrome.storage.sync.set({ settings: state.options.settings });
  }
  
  return result;
};
```

### Initial State Loading

```typescript
async function loadInitialState() {
  const { settings } = await chrome.storage.sync.get('settings');
  store.dispatch(initializeSettings(settings));
}
```

## Best Practices

1. **State Updates**
   - Use immer for immutable updates
   - Implement proper error handling
   - Validate state changes

2. **Performance**
   - Memoize selectors
   - Batch related changes
   - Optimize middleware

3. **Testing**
   ```typescript
   describe('settings slice', () => {
     it('should handle updateGeneralSettings', () => {
       const initialState = { general: {} };
       const newSettings = { theme: 'dark' };
       
       const nextState = settingsSlice.reducer(
         initialState,
         updateGeneralSettings(newSettings)
       );
       
       expect(nextState.general.theme).toBe('dark');
     });
   });
   ```

## Extension Guidelines

### Adding New State

1. Define types for new state
2. Create or update relevant slice
3. Add selectors
4. Implement storage handling
5. Add tests

Example:

```typescript
// New feature slice
const newFeatureSlice = createSlice({
  name: 'newFeature',
  initialState: {
    enabled: false,
    config: {}
  },
  reducers: {
    toggleFeature: (state) => {
      state.enabled = !state.enabled;
    },
    updateConfig: (state, action: PayloadAction<FeatureConfig>) => {
      state.config = { ...state.config, ...action.payload };
    }
  }
});

// Selector
const selectFeatureConfig = (state: RootState) => state.newFeature.config;

// Usage in component
const FeatureComponent = () => {
  const dispatch = useDispatch();
  const config = useSelector(selectFeatureConfig);
  
  const handleConfigUpdate = (newConfig: FeatureConfig) => {
    dispatch(updateConfig(newConfig));
  };
  
  return (
    <ConfigSection>
      <FeatureConfigForm config={config} onUpdate={handleConfigUpdate} />
    </ConfigSection>
  );
};