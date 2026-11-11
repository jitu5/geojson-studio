import type { BBox, Feature, Geometry, LngLat, Position } from './types';

function extend(box: BBox, p: Position): void {
  const [x, y] = p;
  if (x < box[0]) box[0] = x;
  if (y < box[1]) box[1] = y;
  if (x > box[2]) box[2] = x;
  if (y > box[3]) box[3] = y;
}

function walk(geometry: Geometry, visit: (p: Position) => void): void {
  switch (geometry.type) {
    case 'Point':
      visit(geometry.coordinates);
      break;
    case 'MultiPoint':
    case 'LineString':
      geometry.coordinates.forEach(visit);
      break;
    case 'MultiLineString':
    case 'Polygon':
      geometry.coordinates.forEach(part => part.forEach(visit));
      break;
    case 'MultiPolygon':
      geometry.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(visit)));
      break;
    case 'GeometryCollection':
      geometry.geometries.forEach(g => walk(g, visit));
      break;
  }
}

export function geometryBBox(geometry: Geometry | null): BBox | null {
  if (!geometry) return null;
  const box: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  walk(geometry, p => extend(box, p));
  return Number.isFinite(box[0]) ? box : null;
}

export function featuresBBox(features: Feature[]): BBox | null {
  const box: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) {
    const b = geometryBBox(f.geometry);
    if (!b) continue;
    extend(box, [b[0], b[1]]);
    extend(box, [b[2], b[3]]);
  }
  return Number.isFinite(box[0]) ? box : null;
}

export function bboxCenter(box: BBox): LngLat {
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

/** Signed area and centroid of a ring (planar, good enough for label placement). */
function ringCentroid(ring: Position[]): { area: number; c: LngLat } | null {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (area === 0) return null;
  area /= 2;
  return { area: Math.abs(area), c: [cx / (6 * area), cy / (6 * area)] };
}

/** A representative point for a label: the point itself, a line's middle vertex, or the largest ring's centroid. */
export function labelPoint(geometry: Geometry | null): LngLat | null {
  if (!geometry) return null;
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates[0], geometry.coordinates[1]];
    case 'MultiPoint':
    case 'LineString': {
      const coords = geometry.coordinates;
      if (coords.length === 0) return null;
      const mid = coords[Math.floor((coords.length - 1) / 2)];
      return [mid[0], mid[1]];
    }
    case 'MultiLineString': {
      const longest = [...geometry.coordinates].sort((a, b) => b.length - a.length)[0];
      return longest ? labelPoint({ type: 'LineString', coordinates: longest }) : null;
    }
    case 'Polygon': {
      const outer = geometry.coordinates[0];
      if (!outer) return null;
      const res = ringCentroid(outer);
      const box = geometryBBox(geometry);
      return res ? res.c : box ? bboxCenter(box) : null;
    }
    case 'MultiPolygon': {
      let best: { area: number; c: LngLat } | null = null;
      for (const poly of geometry.coordinates) {
        const res = poly[0] ? ringCentroid(poly[0]) : null;
        if (res && (!best || res.area > best.area)) best = res;
      }
      if (best) return best.c;
      const box = geometryBBox(geometry);
      return box ? bboxCenter(box) : null;
    }
    case 'GeometryCollection':
      for (const g of geometry.geometries) {
        const p = labelPoint(g);
        if (p) return p;
      }
      return null;
  }
}
