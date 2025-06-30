import { Theme } from '@react-navigation/native';

interface FontStyle {
  fontFamily: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
}

export interface AppTheme extends Omit<Theme, 'fonts' | 'colors' | 'dark'> {
  colors: {
    // Primary colors
    primary: string;
    primaryLight: string;
    primaryDark: string;
    
    // Secondary colors
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;
    
    // Background colors
    background: string;
    surface: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textTertiary: string;
    onPrimary: string;
    onSecondary: string;
    onSurface: string;
    
    // Status colors
    error: string;
    success: string;
    warning: string;
    info: string;
    
    // UI colors
    border: string;
    divider: string;
    card: string;
    notification: string;
    
    // Background variants
    backgroundVariant: string;
  };
  
  spacing: {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  
  fontSizes: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    body1: number;
    body2: number;
    caption: number;
    button: number;
    overline: number;
  };
  
  borderRadius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  
  shadows: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  
  fonts: {
    thin: FontStyle;
    light: FontStyle;
    regular: FontStyle;
    medium: FontStyle;
    semibold: FontStyle;
    bold: FontStyle;
    heavy: FontStyle;
  };
  
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
}

// Create the base theme without the dark property
const baseTheme: Omit<AppTheme, 'dark'> = {
  colors: {
    // Primary colors
    primary: '#4F46E5',
    primaryLight: '#818CF8',
    primaryDark: '#4338CA',
    
    // Secondary colors
    secondary: '#10B981',
    secondaryLight: '#34D399',
    secondaryDark: '#059669',
    
    // Background colors
    background: '#F9FAFB',
    surface: '#FFFFFF',
    
    // Text colors
    text: '#111827',
    textSecondary: '#4B5563',
    textTertiary: '#9CA3AF',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#111827',
    
    // Status colors
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    
    // UI colors
    border: '#E5E7EB',
    divider: '#F3F4F6',
    card: '#FFFFFF',
    notification: '#3B82F6',
    
    // Background variants
    backgroundVariant: '#F3F4F6',
  },
  
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  fontSizes: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    h5: 16,
    body1: 16,
    body2: 14,
    caption: 12,
    button: 14,
    overline: 10,
  },
  
  borderRadius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  fonts: {
    thin: {
      fontFamily: 'System',
      fontWeight: '100',
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300',
    },
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    semibold: {
      fontFamily: 'System',
      fontWeight: '600',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900',
    },
  },
  
  transitions: {
    fast: '100ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
};

// Create the final theme with the dark property
export const theme: AppTheme & { dark: boolean } = {
  ...baseTheme,
  dark: false, // Required by @react-navigation/native Theme type
};
