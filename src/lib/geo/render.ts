import { sequentialColor } from '../palette';
import { labelPoint } from './bbox';
import { geometryFamilies } from './normalize';
import type { Analysis } from './normalize';
import { featureValue } from './properties';
import type { Feature, Geometry, GeometryFamily } from './types';

/** GeoJSON handed to MapLibre. `__idx` links every rendered part back to the source feature. */
export interface RenderFeature {
  type: 'Feature';
  id?: number;
  geometry: Geometry;
  properties: Record<string, unknown> & { __idx: number; __g: GeometryFamily };
}

export interface RenderCollection {
  type: 'FeatureCollection';
  features: RenderFeature[];
}

export interface Choropleth {
  property: string;
  min: number;
  max: number;
  count: number;
}

function family(g: Geometry): GeometryFamily | null {
  switch (g.type) {
    case 'Point':
    case 'MultiPoint':
      return 'point';
    case 'LineString':
    case 'MultiLineString':
      return 'line';
    case 'Polygon':
    case 'MultiPolygon':
      return 'polygon';
    default:
      return null;
  }
}

function explode(g: Geometry, out: Geometry[] = []): Geometry[] {
  if (g.type === 'GeometryCollection') g.geometries.forEach(child => explode(child, out));
  else out.push(g);
  return out;
}

/** Numeric range of a property across valid features, or null when no feature has a numeric value. */
export function choroplethRange(analysis: Analysis, property: string): Choropleth | null {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  analysis.features.forEach((f, i) => {
    if (!analysis.valid[i]) return;
    const v = featureValue(f, property);
    if (typeof v === 'number' && Number.isFinite(v)) {
      count++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  });
  return count ? { property, min, max, count } : null;
}

export function buildRenderData(analysis: Analysis, choropleth: Choropleth | null): RenderCollection {
  const features: RenderFeature[] = [];
  analysis.features.forEach((f: Feature, idx) => {
    if (!analysis.valid[idx] || !f.geometry) return;
    const props: Record<string, unknown> = { ...(f.properties ?? {}) };
    if (choropleth) {
      const v = featureValue(f, choropleth.property);
      if (typeof v === 'number' && Number.isFinite(v)) {
        props.__choro = sequentialColor(v, choropleth.min, choropleth.max);
      }
    }
    for (const part of explode(f.geometry)) {
      const g = family(part);
      if (!g) continue;
      features.push({ type: 'Feature', geometry: part, properties: { ...props, __idx: idx, __g: g } });
    }
  });
  return { type: 'FeatureCollection', features };
}

export function buildLabelData(analysis: Analysis, property: string | null): RenderCollection {
  const features: RenderFeature[] = [];
  if (!property) return { type: 'FeatureCollection', features };
  analysis.features.forEach((f, idx) => {
    if (!analysis.valid[idx]) return;
    const value = featureValue(f, property);
    if (value === undefined || value === null || value === '') return;
    const p = labelPoint(f.geometry);
    if (!p) return;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p },
      properties: {
        __idx: idx,
        __g: 'point',
        __label: typeof value === 'object' ? JSON.stringify(value) : String(value),
        // Points get their label beside the marker; lines and polygons get it centred.
        __src: geometryFamilies(f.geometry).has('point') && geometryFamilies(f.geometry).size === 1 ? 'point' : 'shape',
      },
    });
  });
  return { type: 'FeatureCollection', features };
}
