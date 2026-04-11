import type { ViewStyle } from 'react-native';

/** Tema claro — app de delivery/alimentação, visual atual (2024+). */
export const Colors = {
  primary: '#EA580C',
  primaryDark: '#C2410C',
  primaryLight: '#FB923C',
  secondary: '#D97706',
  background: '#F8F6F3',
  surface: '#FFFFFF',
  surfaceElevated: '#F3F0EB',
  surfaceMuted: '#EDE9E3',
  border: '#E7E2DA',
  borderStrong: '#D6D0C5',
  text: '#1C1917',
  textSecondary: '#57534E',
  textMuted: '#78716C',
  success: '#15803D',
  warning: '#CA8A04',
  error: '#DC2626',
  info: '#2563EB',
  white: '#FFFFFF',
  black: '#0C0A09',
  /** Fundos suaves para alertas / destaques */
  toneWarning: '#FFFBEB',
  toneSuccess: '#F0FDF4',
  toneInfo: '#EFF6FF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 26,
  full: 999,
};

/** Sombras leves para cartões e CTAs (iOS + Android). */
export const Shadows = {
  card: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  } satisfies ViewStyle,
  button: {
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  } satisfies ViewStyle,
};
