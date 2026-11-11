import type { BBox, LngLat } from './types';

/** Web Mercator tile maths (slippy map / XYZ), plus Bing-style quadkeys and TMS rows. */

export interface Tile {
  z: number;
  x: number;
  y: number;
}

const MAX_LAT = 85.0511287798066;

export function lngLatToTile([lng, lat]: LngLat, z: number): Tile {
  const n = 2 ** z;
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { z, x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

function tile2lng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileBounds({ z, x, y }: Tile): BBox {
  return [tile2lng(x, z), tile2lat(y + 1, z), tile2lng(x + 1, z), tile2lat(y, z)];
}

export function tileToQuadkey({ z, x, y }: Tile): string {
  let key = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    key += String(digit);
  }
  return key;
}

export function quadkeyToTile(quadkey: string): Tile {
  let x = 0;
  let y = 0;
  const z = quadkey.length;
  for (let i = z; i > 0; i--) {
    const mask = 1 << (i - 1);
    const digit = quadkey[z - i];
    if (digit === '1') x |= mask;
    else if (digit === '2') y |= mask;
    else if (digit === '3') {
      x |= mask;
      y |= mask;
    } else if (digit !== '0') throw new Error(`Invalid quadkey digit "${digit}"`);
  }
  return { z, x, y };
}

/** TMS counts rows from the south. */
export function tmsY({ z, y }: Tile): number {
  return 2 ** z - 1 - y;
}

/**
 * Tiles covering a bounding box at zoom z. Returns null when there would be more than `limit`
 * tiles, so callers can ask the user to zoom in instead of drawing thousands of cells.
 */
export function tilesInBBox(box: BBox, z: number, limit = 400): Tile[] | null {
  const west = Math.max(-180, box[0]);
  const east = Math.min(180, box[2]);
  const nw = lngLatToTile([west, box[3]], z);
  const se = lngLatToTile([east, box[1]], z);
  const count = (se.x - nw.x + 1) * (se.y - nw.y + 1);
  if (count > limit) return null;
  const tiles: Tile[] = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) tiles.push({ z, x, y });
  }
  return tiles;
}
