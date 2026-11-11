/**
 * Map data colours. Map features are data, so they use the QBDS chart palettes
 * (DESIGN.md § Chart colours) — the one documented exception to "no raw hex".
 * UI chrome never uses these; it uses TOKENS.md utilities.
 */

export const QUALITATIVE = [
  '#097DFE',
  '#6F39E3',
  '#05D0F0',
  '#0F766E',
  '#8C8DE9',
  '#11B883',
  '#E77EC2',
  '#C84189',
  '#C0CA33',
  '#3E495B',
] as const;

/** Default continuous scale, light (low) -> dark (high). */
export const SEQUENTIAL = [
  '#DBEBFE',
  '#BDDCFE',
  '#8CC6FF',
  '#4BA5FF',
  '#097DFE',
  '#0063F6',
  '#004DE0',
  '#0B40B4',
  '#163B8B',
] as const;

export const MAP_COLORS = {
  feature: QUALITATIVE[0],
  selected: QUALITATIVE[6],
  matched: QUALITATIVE[2],
  drawing: QUALITATIVE[5],
} as const;

/** Mode-specific plot tokens from DESIGN.md, used for map overlays (tile grid, halos, point outlines). */
export const PLOT = {
  dark: {
    background: '#141721',
    axis: 'rgba(255,255,255,0.380)',
    label: 'rgba(255,255,255,0.5)',
    title: 'rgba(255,255,255,0.878)',
  },
  light: {
    background: '#FAFAFB',
    axis: 'rgba(20,23,33,0.380)',
    label: 'rgba(20,23,33,0.5)',
    title: 'rgba(20,23,33,0.878)',
  },
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Colour for `value` on the sequential scale between min and max (linear interpolation between stops). */
export function sequentialColor(value: number, min: number, max: number, stops: readonly string[] = SEQUENTIAL): string {
  if (!Number.isFinite(value)) return MAP_COLORS.feature;
  if (max === min) return stops[Math.floor(stops.length / 2)];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const pos = t * (stops.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(stops.length - 1, lo + 1);
  const f = pos - lo;
  const a = hexToRgb(stops[lo]);
  const b = hexToRgb(stops[hi]);
  return toHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
}
