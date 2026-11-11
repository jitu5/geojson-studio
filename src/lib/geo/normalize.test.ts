import { describe, expect, it } from 'vitest';

import { analyse, geometryProblems, parseJson } from './normalize';

const point = (lng: number, lat: number) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } });

describe('parseJson', () => {
  it('reports line and column of the first syntax error', () => {
    const r = parseJson('{\n  "type": "Feature",\n  "properties": {,}\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(3);
      expect(r.error.message).toMatch(/expected/i);
    }
  });
});

describe('analyse', () => {
  it('treats blank text as empty', () => {
    expect(analyse('   ').status).toBe('empty');
  });

  it('counts a FeatureCollection by geometry family', () => {
    const a = analyse(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          point(1, 2),
          { type: 'Feature', properties: null, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
          },
        ],
      }),
    );
    expect(a.status).toBe('ok');
    expect(a.counts).toMatchObject({ total: 3, rendered: 3, failed: 0, point: 1, line: 1, polygon: 1 });
    expect(a.bbox).toEqual([0, 0, 1, 2]);
  });

  it('wraps a bare geometry and flattens a top-level array', () => {
    expect(analyse('{"type":"Point","coordinates":[4,52]}').counts.rendered).toBe(1);
    expect(analyse(JSON.stringify([point(1, 1), point(2, 2)])).counts.rendered).toBe(2);
  });

  it('keeps invalid features in place so indexes match the editor', () => {
    const a = analyse(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [point(1, 1), { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0]] } }, point(3, 3)],
      }),
    );
    expect(a.features).toHaveLength(3);
    expect(a.valid).toEqual([true, false, true]);
    expect(a.issues).toEqual([{ featureIndex: 1, severity: 'error', message: 'LineString must have at least 2 positions' }]);
  });

  it('flags swapped coordinates through the latitude range', () => {
    const a = analyse(JSON.stringify(point(37.77, -122.42)));
    expect(a.counts.failed).toBe(1);
    expect(a.issues[0].message).toMatch(/swapped/);
  });

  it('treats a null geometry as a warning, not a failure', () => {
    const a = analyse(JSON.stringify({ type: 'Feature', properties: {}, geometry: null }));
    expect(a.counts).toMatchObject({ total: 1, rendered: 0, failed: 0 });
    expect(a.issues[0].severity).toBe('warning');
  });

  it('reports a non-GeoJSON document', () => {
    const a = analyse('{"type":"FeatureCollection","features":"nope"}');
    expect(a.issues[0]).toMatchObject({ featureIndex: null, severity: 'error' });
  });

  it('counts every family inside a GeometryCollection', () => {
    const a = analyse(
      JSON.stringify({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Point', coordinates: [0, 0] },
            { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
          ],
        },
      }),
    );
    expect(a.counts).toMatchObject({ point: 1, line: 1, polygon: 0, rendered: 1 });
  });
});

describe('geometryProblems', () => {
  it('requires closed polygon rings', () => {
    const problems = geometryProblems({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] });
    expect(problems.map(p => p.message)).toContain('Polygon ring is not closed (first and last positions differ)');
  });

  it('warns but accepts longitudes past the antimeridian', () => {
    const problems = geometryProblems({ type: 'Point', coordinates: [190, 10] });
    expect(problems).toEqual([{ severity: 'warning', message: 'Longitude 190 is outside -180..180' }]);
  });

  it('rejects unknown types', () => {
    expect(geometryProblems({ type: 'Circle', coordinates: [0, 0] })[0].message).toMatch(/Unknown geometry type/);
  });
});
