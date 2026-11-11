import { describe, expect, it } from 'vitest';

import { sequentialColor, SEQUENTIAL } from '../palette';
import { labelPoint } from './bbox';
import { buildDrawData, nextToolPoints, toolResult } from './draw';
import { formatDistance, haversine, isHttpUrl, parseLngLat } from './measure';
import { lngLatToTile, quadkeyToTile, tileBounds, tilesInBBox, tileToQuadkey, tmsY } from './tiles';

describe('measure', () => {
  it('computes London–Paris at about 344 km', () => {
    const km = haversine([-0.1276, 51.5072], [2.3522, 48.8566]) / 1000;
    expect(km).toBeGreaterThan(342);
    expect(km).toBeLessThan(345);
  });

  it('formats metres and kilometres', () => {
    expect(formatDistance(12.345)).toBe('12.3 m');
    expect(formatDistance(1234.5)).toBe('1.235 km');
  });

  it('parses "lng, lat" in the forms people paste', () => {
    expect(parseLngLat('4.9, 52.37')).toEqual([4.9, 52.37]);
    expect(parseLngLat('[4.9,52.37]')).toEqual([4.9, 52.37]);
    expect(parseLngLat('4.9 52.37')).toEqual([4.9, 52.37]);
    expect(parseLngLat('52.37')).toBeNull();
    expect(parseLngLat('10, 95')).toBeNull();
  });

  it('recognises http(s) URLs only', () => {
    expect(isHttpUrl('https://example.com/a.geojson')).toBe(true);
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('4.9, 52.37')).toBe(false);
  });
});

describe('tiles', () => {
  it('matches the Bing Maps quadkey reference example', () => {
    expect(tileToQuadkey({ z: 3, x: 3, y: 5 })).toBe('213');
    expect(quadkeyToTile('213')).toEqual({ z: 3, x: 3, y: 5 });
  });

  it('finds the slippy-map tile for London at z10', () => {
    expect(lngLatToTile([-0.1276, 51.5072], 10)).toEqual({ z: 10, x: 511, y: 340 });
  });

  it('flips rows for TMS', () => {
    expect(tmsY({ z: 10, x: 511, y: 340 })).toBe(683);
  });

  it('gives world bounds for the root tile', () => {
    const [w, s, e, n] = tileBounds({ z: 0, x: 0, y: 0 });
    expect([w, e]).toEqual([-180, 180]);
    expect(n).toBeCloseTo(85.0511, 3);
    expect(s).toBeCloseTo(-85.0511, 3);
  });

  it('refuses to enumerate too many tiles', () => {
    expect(tilesInBBox([-180, -85, 180, 85], 2)).toHaveLength(16);
    expect(tilesInBBox([-180, -85, 180, 85], 10)).toBeNull();
  });
});

describe('palette', () => {
  it('maps min, mid and max onto the QBDS sequential stops', () => {
    expect(sequentialColor(0, 0, 100)).toBe(SEQUENTIAL[0]);
    expect(sequentialColor(50, 0, 100)).toBe(SEQUENTIAL[4]);
    expect(sequentialColor(100, 0, 100)).toBe(SEQUENTIAL[8]);
    expect(sequentialColor(5, 5, 5)).toBe(SEQUENTIAL[4]);
  });
});

describe('labelPoint', () => {
  it('uses the centroid of a square', () => {
    const p = labelPoint({ type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] });
    expect(p?.[0]).toBeCloseTo(1);
    expect(p?.[1]).toBeCloseTo(1);
  });
});

describe('coordinate tools', () => {
  it('builds a bounding box from two clicks', () => {
    const first = nextToolPoints('bbox', [], false, [1, 1]);
    const second = nextToolPoints('bbox', first.points, first.finished, [0, 3]);
    expect(second.finished).toBe(true);
    expect(toolResult('bbox', second.points, true)?.copyText).toBe('0,1,1,3');
  });

  it('restarts a finished measurement on the next click', () => {
    expect(nextToolPoints('measure', [[0, 0], [1, 1]], true, [5, 5])).toEqual({ points: [[5, 5]], finished: false });
  });

  it('draws a dashed preview segment while measuring', () => {
    const data = buildDrawData('measure', [[0, 0]], false, [1, 1]);
    expect(data.features.some(f => f.properties.preview)).toBe(true);
  });

  it('reports the measured distance and offers a LineString', () => {
    const r = toolResult('measure', [[-0.1276, 51.5072], [2.3522, 48.8566]], true);
    expect(r?.rows[0].value).toMatch(/^34\d\.\d+ km$/);
    expect(r?.feature?.geometry?.type).toBe('LineString');
  });
});
