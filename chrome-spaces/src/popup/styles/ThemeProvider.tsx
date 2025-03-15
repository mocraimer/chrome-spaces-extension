import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, lightTheme, darkTheme, generateThemeVariables } from './theme';
import { injectGlobalStyles } from './globals';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialize theme based on system preference
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const theme = isDark ? darkTheme : lightTheme;

  // Handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Inject global styles and theme variables
  useEffect(() => {
    injectGlobalStyles();
    const styleElement = document.createElement('style');
    styleElement.setAttribute('id', 'theme-variables');
    styleElement.textContent = generateThemeVariables(theme);
    document.head.appendChild(styleElement);

    return () => {
      const element = document.getElementById('theme-variables');
      if (element) {
        element.remove();
      }
    };
  }, [theme]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const value = {
    theme,
    isDark,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme toggle button component
export const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};

// Styles for theme toggle
const styles = `
  .theme-toggle {
    position: fixed;
    bottom: var(--spacing-md);
    right: var(--spacing-md);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary);
    box-shadow: var(--shadow-md);
    z-index: 1000;
    padding: 0;
    transition: transform var(--transition-fast);
  }

  .theme-toggle:hover {
    transform: scale(1.1);
  }

  .theme-toggle:active {
    transform: scale(0.9);
  }
`;

// Inject theme toggle styles
const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
