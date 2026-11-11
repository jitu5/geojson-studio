const KEY = 'geojson-studio:v1';
const MAX_TEXT = 2 * 1024 * 1024;

export interface SavedState {
  view?: { center: [number, number]; zoom: number; bearing: number; pitch: number };
  basemap?: string;
  theme?: 'dark' | 'light';
  panelWidth?: number;
  tileScheme?: 'xyz' | 'tms';
  text?: string;
}

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedState) : {};
  } catch {
    return {};
  }
}

export function saveState(patch: SavedState): void {
  try {
    const next = { ...loadState(), ...patch };
    if (next.text && next.text.length > MAX_TEXT) delete next.text;
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable (private mode): persistence is best-effort.
  }
}
