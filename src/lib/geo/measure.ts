import type { BBox, LngLat } from './types';

const EARTH_RADIUS_M = 6_371_008.8;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLength(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toLocaleString('en-GB', { maximumFractionDigits: 3 })} km`;
  return `${metres.toLocaleString('en-GB', { maximumFractionDigits: 1 })} m`;
}

/** 6 decimal places ~ 0.1 m; enough for any web map and short enough to read. */
export function formatCoord(value: number): string {
  return value.toFixed(6);
}

export function formatLngLat([lng, lat]: LngLat): string {
  return `${formatCoord(lng)}, ${formatCoord(lat)}`;
}

export function bboxFromCorners(a: LngLat, b: LngLat): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

export function bboxToPolygonCoords(box: BBox): number[][][] {
  const [w, s, e, n] = box;
  return [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ];
}

/**
 * Parse "lng, lat" (comma and/or whitespace separated). Returns null unless both numbers are in range.
 * Matches the reference tool, which takes longitude first like GeoJSON.
 */
export function parseLngLat(input: string): LngLat | null {
  const parts = input
    .trim()
    .replace(/^\[|\]$/g, '')
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const [lng, lat] = parts.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
}

export function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
