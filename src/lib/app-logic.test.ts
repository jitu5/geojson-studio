import { describe, expect, it } from 'vitest';

import { analyse } from './geo/normalize';
import { featureTitle, matchingIndexes, numericKeys, propertyKeys } from './geo/properties';
import { buildLabelData, buildRenderData, choroplethRange } from './geo/render';
import { SAMPLES } from './samples';
import { readStartupParams, withUrlParam } from './urlParams';

describe('samples', () => {
  it.each(SAMPLES.map(s => [s.id, s] as const))('%s analyses cleanly', (_, sample) => {
    const a = analyse(JSON.stringify(sample.build()));
    expect(a.status).toBe('ok');
    if (sample.id === 'broken') {
      expect(a.counts.failed).toBe(3);
      expect(a.counts.rendered).toBe(2);
    } else {
      expect(a.counts.failed).toBe(0);
      expect(a.counts.rendered).toBe(a.counts.total);
    }
  });

  it('matches the counts in the sample descriptions', () => {
    const count = (id: string) => SAMPLES.find(s => s.id === id)!.build().features.length;
    expect(count('capitals')).toBe(39);
    expect(count('routes')).toBe(12);
    expect(count('grid')).toBe(196);
  });
});

describe('properties', () => {
  const a = analyse(JSON.stringify(SAMPLES.find(s => s.id === 'grid')!.build()));

  it('lists keys and numeric keys', () => {
    expect(propertyKeys(a.features, a.valid)).toEqual(['band', 'cell', 'score']);
    expect(numericKeys(a.features, a.valid)).toEqual(['score']);
  });

  it('finds every feature with a property value', () => {
    const idx = matchingIndexes(a.features, a.valid, 'band', 'high');
    expect(idx.length).toBeGreaterThan(0);
    expect(idx.every(i => a.features[i].properties?.band === 'high')).toBe(true);
  });

  it('titles features from common name keys', () => {
    expect(featureTitle({ type: 'Feature', properties: { name: 'Vondelpark' }, geometry: null }, 0)).toBe('Vondelpark');
    expect(featureTitle({ type: 'Feature', properties: {}, geometry: null }, 4)).toBe('Feature 5');
  });
});

describe('render data', () => {
  it('explodes GeometryCollections into parts sharing the source index', () => {
    const a = analyse(JSON.stringify(SAMPLES.find(s => s.id === 'every-type')!.build()));
    const data = buildRenderData(a, null);
    const parts = data.features.filter(f => f.properties.__idx === 6);
    expect(parts.map(p => p.properties.__g).sort()).toEqual(['line', 'point']);
  });

  it('adds choropleth colours without touching source properties', () => {
    const a = analyse(JSON.stringify(SAMPLES.find(s => s.id === 'grid')!.build()));
    const range = choroplethRange(a, 'score');
    expect(range).not.toBeNull();
    const data = buildRenderData(a, range);
    expect(data.features.every(f => typeof f.properties.__choro === 'string')).toBe(true);
    expect(a.features[0].properties).not.toHaveProperty('__choro');
  });

  it('places one label per feature with the value', () => {
    const a = analyse(JSON.stringify(SAMPLES.find(s => s.id === 'capitals')!.build()));
    const labels = buildLabelData(a, 'name');
    expect(labels.features).toHaveLength(39);
    expect(labels.features[0].properties.__label).toBe('London');
  });

  it('skips invalid features', () => {
    const a = analyse(JSON.stringify(SAMPLES.find(s => s.id === 'broken')!.build()));
    expect(new Set(buildRenderData(a, null).features.map(f => f.properties.__idx))).toEqual(new Set([0, 5]));
  });
});

describe('url params', () => {
  it('reads several ?url= sources and the map view', () => {
    const p = readStartupParams('https://app.test/?url=https%3A%2F%2Fa.test%2Fx.json%3Bhttps%3A%2F%2Fb.test%2Fy.json&map=4.9,52.37,12&maponly=true');
    expect(p.urls).toEqual(['https://a.test/x.json', 'https://b.test/y.json']);
    expect(p.view).toEqual({ center: [4.9, 52.37], zoom: 12 });
    expect(p.mapOnly).toBe(true);
    expect(p.fromHash).toBe(false);
  });

  it('keeps query strings inside #url= links', () => {
    const p = readStartupParams('https://app.test/#url=https://data.test/r.geojson?$limit=100&page=2');
    expect(p.urls).toEqual(['https://data.test/r.geojson?$limit=100&page=2']);
    expect(p.fromHash).toBe(true);
  });

  it('writes and clears ?url=', () => {
    const withUrl = withUrlParam('https://app.test/?e2e=1', ['https://a.test/x.json']);
    expect(new URL(withUrl).searchParams.get('url')).toBe('https://a.test/x.json');
    expect(new URL(withUrlParam(withUrl, null)).search).toBe('?e2e=1');
  });
});
