/**
 * The Woltaphor palette, taken from the logo rather than guessed at.
 *
 * INK is sampled from the artwork's own backdrop, so a logo placed on it has no visible
 * edge — the mark is a photograph of a metal sign, not a transparent cutout, and any
 * other background shows as a rectangle around it.
 */
export const BRAND = {
  /** The logo's backdrop. Anything the mark sits on should be this. */
  ink: '#0d0e0d',
  /** A step up from ink, for bars and panels that need to read as raised. */
  inkSoft: '#191b1d',
  inkLine: 'rgba(203, 213, 225, 0.14)',
  /** The amber from the hexagon. The brand's one loud colour — used sparingly. */
  amber: '#e8a33d',
  amberDeep: '#c07f1c',
  /** The brushed metal of the lettering. */
  silver: '#cfd6dd',
  silverDim: '#8b949e',
} as const;

export const LOGO_HORIZONTAL = '/brand/logo-horizontal.png';
export const LOGO_MARK = '/brand/logo-mark.png';
export const HERO = '/brand/hero.jpg';

/**
 * The admin portal's accent. Only the sign-in and change-password screens need it — they
 * sit outside AdminLayout, so they inherit none of its styling.
 */
export const ADMIN_ACCENT = '#722ed1';
