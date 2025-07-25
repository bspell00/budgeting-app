/**
 * Standardized color system for consistent theming
 */

export const colors = {
  // Primary brand colors
  primary: {
    50: '#fef7f0',
    100: '#feebd9',
    200: '#fbd4b2',
    300: '#f8b780',
    400: '#f29676', // Main brand color
    500: '#ed7f5a',
    600: '#de6439',
    700: '#b84d2a',
    800: '#933f26',
    900: '#763523',
  },
  
  // Text colors
  text: {
    primary: '#1f2937',    // found-text equivalent
    secondary: '#6b7280',  // found-text opacity-60 equivalent
    tertiary: '#9ca3af',   // found-text opacity-40 equivalent
    inverse: '#ffffff',
  },
  
  // Surface colors
  surface: {
    primary: '#ffffff',    // found-surface equivalent
    secondary: '#f9fafb',  // found-surface-secondary equivalent
    tertiary: '#f3f4f6',
  },
  
  // Border colors
  border: {
    primary: '#e5e7eb',    // found-divider equivalent
    secondary: '#d1d5db',
    tertiary: '#9ca3af',
  },
  
  // Accent colors
  accent: {
    primary: '#f29676',    // found-accent equivalent
    secondary: '#ed7f5a',
  },
  
  // AI Assistant colors
  ai: {
    primary: '#86b686',    // Finley AI color for buttons and branding
    secondary: '#9cc49c',  // Lighter variant
    dark: '#73a373',       // Darker variant
  },
  
  // Status colors
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  // Semantic colors
  semantic: {
    positive: '#10b981',   // green for income/positive amounts
    negative: '#ef4444',   // red for expenses/negative amounts
    neutral: '#6b7280',    // gray for neutral states
  }
};

// Tailwind-compatible class names
export const colorClasses = {
  // Text classes
  textPrimary: 'text-gray-800',
  textSecondary: 'text-gray-600', 
  textTertiary: 'text-gray-400',
  textInverse: 'text-white',
  
  // Background classes
  bgPrimary: 'bg-white',
  bgSecondary: 'bg-gray-50',
  bgTertiary: 'bg-gray-100',
  
  // Border classes
  borderPrimary: 'border-gray-200',
  borderSecondary: 'border-gray-300',
  
  // Brand classes
  brandPrimary: 'bg-orange-400', // f29676 equivalent
  brandPrimaryHover: 'hover:bg-orange-500',
  brandText: 'text-orange-400',
  
  // AI Assistant classes
  aiPrimary: 'bg-[#86b686]',
  aiPrimaryHover: 'hover:bg-[#73a373]',
  aiText: 'text-[#86b686]',
  aiSecondary: 'bg-[#9cc49c]',
  
  // Status classes
  success: 'text-green-600',
  successBg: 'bg-green-50',
  warning: 'text-yellow-600', 
  warningBg: 'bg-yellow-50',
  error: 'text-red-600',
  errorBg: 'bg-red-50',
  info: 'text-blue-600',
  infoBg: 'bg-blue-50',
};

// Helper function to get status color
export const getStatusColor = (status: 'success' | 'warning' | 'error' | 'info') => {
  const colorMap = {
    success: colorClasses.success,
    warning: colorClasses.warning,
    error: colorClasses.error,
    info: colorClasses.info,
  };
  return colorMap[status];
};

// Helper function to get amount color (positive/negative)
export const getAmountColor = (amount: number) => {
  if (amount > 0) return colorClasses.success;
  if (amount < 0) return colorClasses.error;
  return colorClasses.textSecondary;
};