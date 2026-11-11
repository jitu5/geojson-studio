import { bboxFromCorners, bboxToPolygonCoords, formatCoord, formatDistance, haversine, pathLength } from './measure';
import type { Feature, LngLat } from './types';

export type DrawTool = 'pick' | 'measure' | 'bbox';

interface DrawFeature {
  type: 'Feature';
  properties: { preview?: boolean };
  geometry: { type: 'Point'; coordinates: LngLat } | { type: 'LineString'; coordinates: LngLat[] } | { type: 'Polygon'; coordinates: number[][][] };
}

export interface DrawCollection {
  type: 'FeatureCollection';
  features: DrawFeature[];
}

/** Next point list after a map click, given the active tool. */
export function nextToolPoints(tool: DrawTool, points: LngLat[], finished: boolean, click: LngLat): { points: LngLat[]; finished: boolean } {
  switch (tool) {
    case 'pick':
      return { points: [click], finished: true };
    case 'measure':
      return finished ? { points: [click], finished: false } : { points: [...points, click], finished: false };
    case 'bbox':
      if (finished || points.length === 0) return { points: [click], finished: false };
      return { points: [points[0], click], finished: true };
  }
}

/** Geometry to draw for the tool, including a dashed preview segment to the cursor while drawing. */
export function buildDrawData(tool: DrawTool | null, points: LngLat[], finished: boolean, cursor: LngLat | null): DrawCollection {
  const features: DrawFeature[] = [];
  if (!tool || points.length === 0) return { type: 'FeatureCollection', features };
  const point = (p: LngLat): DrawFeature => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } });

  if (tool === 'pick') {
    features.push(point(points[0]));
  } else if (tool === 'measure') {
    if (points.length > 1) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } });
    }
    if (!finished && cursor) {
      features.push({
        type: 'Feature',
        properties: { preview: true },
        geometry: { type: 'LineString', coordinates: [points[points.length - 1], cursor] },
      });
    }
    points.forEach(p => features.push(point(p)));
  } else if (tool === 'bbox') {
    const corner = points[1] ?? (!finished ? cursor : null);
    if (corner) {
      features.push({
        type: 'Feature',
        properties: { preview: !finished },
        geometry: { type: 'Polygon', coordinates: bboxToPolygonCoords(bboxFromCorners(points[0], corner)) },
      });
    }
    features.push(point(points[0]));
    if (points[1]) features.push(point(points[1]));
  }
  return { type: 'FeatureCollection', features };
}

export interface ToolResult {
  rows: { label: string; value: string }[];
  copyText: string;
  feature: Feature | null;
}

export function toolResult(tool: DrawTool, points: LngLat[], finished: boolean): ToolResult | null {
  if (tool === 'pick' && points[0]) {
    const [lng, lat] = points[0];
    return {
      rows: [
        { label: 'Longitude', value: formatCoord(lng) },
        { label: 'Latitude', value: formatCoord(lat) },
      ],
      copyText: `${formatCoord(lng)},${formatCoord(lat)}`,
      feature: { type: 'Feature', properties: { name: 'Picked point' }, geometry: { type: 'Point', coordinates: [Number(formatCoord(lng)), Number(formatCoord(lat))] } },
    };
  }
  if (tool === 'measure' && points.length > 0) {
    const total = pathLength(points);
    const last = points.length > 1 ? haversine(points[points.length - 2], points[points.length - 1]) : 0;
    const coords = points.map(([x, y]) => [Number(formatCoord(x)), Number(formatCoord(y))]);
    return {
      rows: [
        { label: 'Total distance', value: formatDistance(total) },
        { label: 'Last segment', value: formatDistance(last) },
        { label: 'Vertices', value: String(points.length) },
      ],
      copyText: formatDistance(total),
      feature:
        points.length > 1
          ? {
              type: 'Feature',
              properties: { name: 'Measured line', distance_m: Math.round(total * 10) / 10 },
              geometry: { type: 'LineString', coordinates: coords },
            }
          : null,
    };
  }
  if (tool === 'bbox' && points.length === 2 && finished) {
    const box = bboxFromCorners(points[0], points[1]);
    const [w, s, e, n] = box.map(v => Number(formatCoord(v)));
    return {
      rows: [
        { label: 'West', value: formatCoord(w) },
        { label: 'South', value: formatCoord(s) },
        { label: 'East', value: formatCoord(e) },
        { label: 'North', value: formatCoord(n) },
      ],
      copyText: `${w},${s},${e},${n}`,
      feature: { type: 'Feature', properties: { name: 'Bounding box', bbox: [w, s, e, n] }, geometry: { type: 'Polygon', coordinates: bboxToPolygonCoords([w, s, e, n]) } },
    };
  }
  return null;
}
