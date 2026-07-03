// ─── ARIA Design System ───────────────────────────────────────────────────────
// Inspiré Apple Health + Doctolib + Linear

export const palette = {
  // Primaires
  navy:        "#0A2A3F",
  navyLight:   "#0D3554",
  blue:        "#1F6B9E",
  blueMid:     "#2980B9",
  blueLight:   "#EBF4FB",
  bluePale:    "#F0F7FF",

  // Rôles
  violet:      "#7C3AED",
  violetLight: "#F3F0FF",
  amber:       "#B45309",
  amberLight:  "#FEF3C7",

  // Sémantiques
  success:     "#059669",
  successBg:   "#ECFDF5",
  danger:      "#DC2626",
  dangerBg:    "#FEF2F2",
  warning:     "#D97706",
  warningBg:   "#FFFBEB",
  info:        "#0284C7",
  infoBg:      "#F0F9FF",

  // Neutres
  white:       "#FFFFFF",
  gray50:      "#F9FAFB",
  gray100:     "#F3F4F6",
  gray200:     "#E5E7EB",
  gray300:     "#D1D5DB",
  gray400:     "#9CA3AF",
  gray500:     "#6B7280",
  gray600:     "#4B5563",
  gray700:     "#374151",
  gray800:     "#1F2937",
  gray900:     "#111827",

  // Dark mode
  dark900:     "#0F172A",
  dark800:     "#1E293B",
  dark700:     "#334155",
  dark600:     "#475569",
  dark400:     "#94A3B8",
  dark300:     "#CBD5E1",
};

export const colors = {
  // Backgrounds
  background:      palette.gray50,
  surface:         palette.white,
  surfaceSecondary: palette.gray100,
  surfaceElevated: palette.white,

  // Brand
  primary:         palette.blue,
  primaryDark:     palette.navy,
  primaryBg:       palette.blueLight,
  primaryPale:     palette.bluePale,

  // Text
  textPrimary:     palette.gray900,
  textSecondary:   palette.gray600,
  textMuted:       palette.gray400,
  textInverse:     palette.white,

  // Borders
  border:          palette.gray200,
  borderFocus:     palette.blue,

  // Status
  success:         palette.success,
  successBg:       palette.successBg,
  danger:          palette.danger,
  dangerBg:        palette.dangerBg,
  warning:         palette.warning,
  warningBg:       palette.warningBg,
  info:            palette.info,
  infoBg:          palette.infoBg,

  // Legacy (compatibilité)
  normal:          palette.success,
  normalBg:        palette.successBg,
  critical:        palette.danger,
  criticalBg:      palette.dangerBg,
  high:            palette.amber,
  highBg:          palette.amberLight,
};

export const shadows = {
  none: {},
  xs: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  colored: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  }),
};

export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  full: 999,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  xs:   { fontSize: 11, lineHeight: 16 },
  sm:   { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 15, lineHeight: 22 },
  lg:   { fontSize: 17, lineHeight: 24 },
  xl:   { fontSize: 20, lineHeight: 28 },
  xxl:  { fontSize: 24, lineHeight: 32 },
  xxxl: { fontSize: 30, lineHeight: 38 },
  display: { fontSize: 36, lineHeight: 44 },
};
