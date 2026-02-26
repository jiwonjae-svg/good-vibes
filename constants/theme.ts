export const LightColors = {
  primary: '#FF9F7E',
  primaryLight: '#FFD4C2',
  secondary: '#7EC8E3',
  secondaryLight: '#C5E8F7',
  accent: '#FFD166',
  background: '#FFF8F0',
  surface: '#FFFFFF',
  surfaceAlt: '#FFF0E6',
  textPrimary: '#2D2D2D',
  textSecondary: '#6B6B6B',
  textLight: '#FFFFFF',
  textMuted: '#A0A0A0',
  grass0: '#EBEDF0',
  grass1: '#9BE9A8',
  grass2: '#40C463',
  grass3: '#30A14E',
  grass4: '#216E39',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  cardGradients: [
    ['#FFE5D9', '#FFD4C2'],
    ['#D4E8FF', '#C5E8F7'],
    ['#FFF3D4', '#FFE8A3'],
    ['#E8D4FF', '#D4C2FF'],
    ['#D4FFE8', '#C2FFD4'],
    ['#FFD4E8', '#FFC2D4'],
    ['#D4F5FF', '#C2E8FF'],
    ['#FFF4D4', '#FFE4B5'],
  ] as [string, string][],
} as const;

export const DarkColors = {
  primary: '#FF9F7E',
  primaryLight: '#8B5E4B',
  secondary: '#7EC8E3',
  secondaryLight: '#3A6B80',
  accent: '#FFD166',
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#2A2A2A',
  textPrimary: '#E8E8E8',
  textSecondary: '#A0A0A0',
  textLight: '#FFFFFF',
  textMuted: '#606060',
  grass0: '#2A2A2A',
  grass1: '#0E4429',
  grass2: '#006D32',
  grass3: '#26A641',
  grass4: '#39D353',
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
  cardGradients: [
    ['#3D2A22', '#2E1F18'],
    ['#1A2E3D', '#15253A'],
    ['#3D3520', '#2E2818'],
    ['#2E223D', '#22183A'],
    ['#1A3D2A', '#153A22'],
    ['#3D1A2A', '#3A1522'],
    ['#1A323D', '#15293A'],
    ['#3D3320', '#2E2818'],
  ] as [string, string][],
} as const;

// Default export for backward compat — overridden by useThemeColors() at runtime
export const Colors = LightColors;

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8, md: 12, lg: 20, xl: 28, full: 9999,
} as const;

export const FontSize = {
  xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32, hero: 40,
} as const;

export const Fonts = {
  quote: { fontFamily: 'serif', fontWeight: '300' as const },
  body: { fontWeight: '400' as const },
  heading: { fontWeight: '700' as const },
} as const;

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
