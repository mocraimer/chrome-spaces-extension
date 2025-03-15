export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    background: {
      primary: string;
      secondary: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
    border: string;
    error: string;
    success: string;
    overlay: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      bold: number;
    };
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

export const lightTheme: Theme = {
  colors: {
    primary: '#1a73e8',
    primaryDark: '#1557b0',
    background: {
      primary: '#ffffff',
      secondary: '#f8f9fa'
    },
    text: {
      primary: '#202124',
      secondary: '#5f6368'
    },
    border: '#dadce0',
    error: '#d93025',
    success: '#188038',
    overlay: 'rgba(32, 33, 36, 0.6)'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '16px'
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      bold: 600
    }
  },
  transitions: {
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease'
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
    md: '0 2px 4px rgba(0, 0, 0, 0.1)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.1)'
  }
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    primary: '#8ab4f8',
    primaryDark: '#669df6',
    background: {
      primary: '#202124',
      secondary: '#292a2d'
    },
    text: {
      primary: '#e8eaed',
      secondary: '#9aa0a6'
    },
    border: '#3c4043',
    error: '#f28b82',
    success: '#81c995',
    overlay: 'rgba(232, 234, 237, 0.1)'
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 2px 4px rgba(0, 0, 0, 0.3)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.3)'
  }
};

// Generate CSS variables from theme
export function generateThemeVariables(theme: Theme): string {
  return `
    :root {
      --primary-color: ${theme.colors.primary};
      --primary-color-dark: ${theme.colors.primaryDark};
      --background-primary: ${theme.colors.background.primary};
      --background-secondary: ${theme.colors.background.secondary};
      --text-primary: ${theme.colors.text.primary};
      --text-secondary: ${theme.colors.text.secondary};
      --border-color: ${theme.colors.border};
      --error-color: ${theme.colors.error};
      --success-color: ${theme.colors.success};
      --overlay-color: ${theme.colors.overlay};
      
      --spacing-xs: ${theme.spacing.xs};
      --spacing-sm: ${theme.spacing.sm};
      --spacing-md: ${theme.spacing.md};
      --spacing-lg: ${theme.spacing.lg};
      --spacing-xl: ${theme.spacing.xl};
      
      --border-radius-sm: ${theme.borderRadius.sm};
      --border-radius-md: ${theme.borderRadius.md};
      --border-radius-lg: ${theme.borderRadius.lg};
      
      --font-family: ${theme.typography.fontFamily};
      --font-size-xs: ${theme.typography.fontSize.xs};
      --font-size-sm: ${theme.typography.fontSize.sm};
      --font-size-md: ${theme.typography.fontSize.md};
      --font-size-lg: ${theme.typography.fontSize.lg};
      --font-size-xl: ${theme.typography.fontSize.xl};
      
      --font-weight-normal: ${theme.typography.fontWeight.normal};
      --font-weight-medium: ${theme.typography.fontWeight.medium};
      --font-weight-bold: ${theme.typography.fontWeight.bold};
      
      --transition-fast: ${theme.transitions.fast};
      --transition-normal: ${theme.transitions.normal};
      --transition-slow: ${theme.transitions.slow};
      
      --shadow-sm: ${theme.shadows.sm};
      --shadow-md: ${theme.shadows.md};
      --shadow-lg: ${theme.shadows.lg};
    }
  `;
}
