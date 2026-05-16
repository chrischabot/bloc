/** 19-value rich-text colour palette (10 foreground + 9 background). */
export const PALETTE = {
  default: { fg: 'var(--text-primary)', bg: 'transparent' },
  gray: { fg: '#787774', bg: '#f1f1ef' },
  brown: { fg: '#9f6b53', bg: '#f4eeee' },
  orange: { fg: '#d9730d', bg: '#fbecdd' },
  yellow: { fg: '#cb912f', bg: '#fbf3db' },
  green: { fg: '#448361', bg: '#edf3ec' },
  blue: { fg: '#337ea9', bg: '#e7f3f8' },
  purple: { fg: '#9065b0', bg: '#f4f0f7' },
  pink: { fg: '#c14c8a', bg: '#fbeef5' },
  red: { fg: '#d44c47', bg: '#fdebec' },
} as const;

export const PALETTE_DARK = {
  default: { fg: 'var(--text-primary)', bg: 'transparent' },
  gray: { fg: '#9b9b9b', bg: '#2f2f2f' },
  brown: { fg: '#bb8a73', bg: '#4a3228' },
  orange: { fg: '#c47d3a', bg: '#5c3b23' },
  yellow: { fg: '#cab74a', bg: '#564328' },
  green: { fg: '#529e72', bg: '#243d30' },
  blue: { fg: '#5a91b9', bg: '#143a4e' },
  purple: { fg: '#a37bcb', bg: '#3c2d49' },
  pink: { fg: '#cc6798', bg: '#4e2c3c' },
  red: { fg: '#df5452', bg: '#522e2a' },
} as const;

/** 8-px base spacing scale. */
export const SPACING = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Border radii. */
export const RADIUS = {
  sm: 3,
  md: 4,
  lg: 6,
  xl: 10,
  full: 9999,
} as const;

/** Viewport breakpoints (min-width, px). */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;
