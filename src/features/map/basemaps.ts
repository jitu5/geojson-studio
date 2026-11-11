import type { StyleSpecification } from 'maplibre-gl';

export type Theme = 'dark' | 'light';

export type BasemapId = 'auto' | 'dark' | 'light' | 'streets' | 'here-explore' | 'here-satellite' | 'here-topo';

export interface Basemap {
  id: BasemapId;
  label: string;
  description: string;
}

/** Your own HERE key (https://platform.here.com). Never commit it; read from .env.local. */
const HERE_API_KEY = (import.meta.env.VITE_HERE_API_KEY as string | undefined)?.trim() || '';

export const hasHereKey = HERE_API_KEY.length > 0;

/** Fonts for label layers on raster styles (raster styles ship no glyphs). */
const FALLBACK_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FALLBACK_FONT = ['Noto Sans Regular'];

export const BASEMAPS: Basemap[] = [
  { id: 'auto', label: 'Match theme', description: 'Dark or light, following the app theme' },
  { id: 'dark', label: 'Dark', description: 'CARTO Dark Matter' },
  { id: 'light', label: 'Light', description: 'CARTO Positron' },
  { id: 'streets', label: 'Streets', description: 'OpenFreeMap Liberty' },
  ...(hasHereKey
    ? ([
        { id: 'here-explore', label: 'HERE Explore', description: 'HERE raster tiles, follows theme' },
        { id: 'here-satellite', label: 'HERE Satellite', description: 'HERE satellite imagery' },
        { id: 'here-topo', label: 'HERE Terrain', description: 'HERE topographic' },
      ] satisfies Basemap[])
    : []),
];

function hereRaster(style: string, label: string): StyleSpecification {
  return {
    version: 8,
    glyphs: FALLBACK_GLYPHS,
    sources: {
      here: {
        type: 'raster',
        tiles: [`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?style=${style}&size=256&apiKey=${HERE_API_KEY}`],
        tileSize: 256,
        maxzoom: 20,
        attribution: `© ${new Date().getFullYear()} HERE`,
      },
    },
    layers: [{ id: label, type: 'raster', source: 'here' }],
  };
}

/** Resolve a basemap choice to a MapLibre style URL or object. */
export function resolveStyle(id: BasemapId, theme: Theme): string | StyleSpecification {
  const effective = id === 'auto' ? theme : id;
  switch (effective) {
    case 'light':
      return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    case 'streets':
      return 'https://tiles.openfreemap.org/styles/liberty';
    case 'here-explore':
      return hasHereKey ? hereRaster(theme === 'dark' ? 'explore.night' : 'explore.day', 'here-explore') : resolveStyle('auto', theme);
    case 'here-satellite':
      return hasHereKey ? hereRaster('explore.satellite.day', 'here-satellite') : resolveStyle('auto', theme);
    case 'here-topo':
      return hasHereKey ? hereRaster('topo.day', 'here-topo') : resolveStyle('auto', theme);
    case 'dark':
    default:
      return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
  }
}

/** Whether data drawn on this basemap should use dark-mode plot ink. */
export function basemapIsDark(id: BasemapId, theme: Theme): boolean {
  if (id === 'auto' || id === 'here-explore') return theme === 'dark';
  return id === 'dark' || id === 'here-satellite';
}
