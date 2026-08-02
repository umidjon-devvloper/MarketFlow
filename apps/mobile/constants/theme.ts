export const Colors = {
  primary: '#2563eb',
  primaryLight: '#dbeafe',
  primaryDark: '#1e40af',

  success: '#16a34a',
  successLight: '#dcfce7',

  danger: '#dc2626',
  dangerLight: '#fee2e2',

  warning: '#eab308',
  warningLight: '#fef3c7',

  purple: '#9333ea',
  purpleLight: '#f3e8ff',

  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  white: '#ffffff',
  black: '#000000',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};

export const MARKETPLACES = {
  UZUM: { name: 'Uzum', color: '#9333ea', icon: '🛒' },
  OZON: { name: 'Ozon', color: '#2563eb', icon: '📦' },
  WB: { name: 'Wildberries', color: '#ec4899', icon: '🛍️' },
  YANDEX: { name: 'Yandex Market', color: '#eab308', icon: '🏪' },
} as const;
