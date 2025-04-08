# Options Page Components

## Component Overview

The options page is built using React components that provide a modular and maintainable structure for managing extension settings.

## Layout Components

### OptionsLayout

The main layout component that provides the page structure and navigation.

```typescript
interface OptionsLayoutProps {
  children: React.ReactNode;
}

const OptionsLayout: React.FC<OptionsLayoutProps> = ({ children }) => {
  return (
    <div className="options-layout">
      <Navigation />
      <main>{children}</main>
    </div>
  );
};
```

### Navigation Component

Handles section navigation and routing within the options page.

```typescript
const Navigation: React.FC = () => {
  return (
    <nav>
      <NavItem path="/general" label="General Settings" />
      <NavItem path="/spaces" label="Spaces Configuration" />
      <NavItem path="/keyboard" label="Keyboard Shortcuts" />
    </nav>
  );
};
```

## Feature Components

### ConfigSection

Wrapper component for configuration sections.

```typescript
interface ConfigSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const ConfigSection: React.FC<ConfigSectionProps> = ({
  title,
  description,
  children
}) => {
  return (
    <section className="config-section">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </section>
  );
};
```

### ConfigOption

Reusable component for individual settings.

```typescript
interface ConfigOptionProps {
  label: string;
  value: string | boolean | number;
  onChange: (value: any) => void;
  type?: 'text' | 'checkbox' | 'number' | 'select';
  options?: Array<{ label: string; value: any }>;
}
```

## Component Best Practices

1. **State Management**
   - Use hooks for local state
   - Connect to Redux store when needed
   - Implement proper cleanup

2. **Error Handling**
   ```typescript
   const ConfigOption: React.FC<ConfigOptionProps> = (props) => {
     try {
       // Component logic
     } catch (error) {
       console.error('ConfigOption Error:', error);
       return <ErrorDisplay error={error} />;
     }
   };
   ```

3. **Performance Optimization**
   - Memoize callbacks and values
   - Use React.memo for pure components
   - Implement proper dependencies in hooks

## Testing Components

```typescript
describe('OptionsLayout', () => {
  it('renders navigation and content', () => {
    render(
      <OptionsLayout>
        <div data-testid="content">Test Content</div>
      </OptionsLayout>
    );
    
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
```

## Adding New Components

1. Create component file in appropriate directory
2. Define TypeScript interfaces
3. Implement component logic
4. Add necessary tests
5. Update documentation

Example new component:

```typescript
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ConfigSection, ConfigOption } from '../common';
import { updateSettings } from '../../store/actions';

interface NewFeatureProps {
  initialValue?: string;
}

export const NewFeature: React.FC<NewFeatureProps> = ({ initialValue = '' }) => {
  const dispatch = useDispatch();
  const settings = useSelector(state => state.settings);

  const handleChange = React.useCallback((value: string) => {
    dispatch(updateSettings({ newFeature: value }));
  }, [dispatch]);

  return (
    <ConfigSection title="New Feature">
      <ConfigOption
        label="Feature Setting"
        value={settings.newFeature ?? initialValue}
        onChange={handleChange}
      />
    </ConfigSection>
  );
};