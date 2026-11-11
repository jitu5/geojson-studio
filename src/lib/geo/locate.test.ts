import { describe, expect, it } from 'vitest';

import { appendFeatures, featureAtOffset, featureRanges, mergeDocuments } from './locate';
import { analyse } from './normalize';
import type { Feature } from './types';

const fc = {
  type: 'FeatureCollection',
  name: 'demo',
  features: [
    { type: 'Feature', properties: { a: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } },
    { type: 'Feature', properties: { a: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } },
  ],
};
const text = JSON.stringify(fc, null, 2);

describe('featureRanges', () => {
  it('returns one range per feature, aligned with analyse()', () => {
    const ranges = featureRanges(text);
    expect(ranges).toHaveLength(analyse(text).features.length);
    expect(JSON.parse(text.slice(ranges[1].from, ranges[1].to)).properties.a).toBe(2);
  });

  it('covers a single Feature document', () => {
    const single = JSON.stringify(fc.features[0]);
    expect(featureRanges(single)).toEqual([{ from: 0, to: single.length }]);
  });

  it('expands collections nested in a top-level array', () => {
    expect(featureRanges(JSON.stringify([fc, fc.features[0]]))).toHaveLength(3);
  });
});

describe('featureAtOffset', () => {
  const ranges = featureRanges(text);
  it('finds the feature containing the caret', () => {
    expect(featureAtOffset(ranges, ranges[0].from + 5)).toBe(0);
    expect(featureAtOffset(ranges, ranges[1].to)).toBe(1);
  });
  it('returns -1 between features', () => {
    expect(featureAtOffset(ranges, 0)).toBe(-1);
  });
});

describe('appendFeatures', () => {
  const extra: Feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [5, 5] } };

  it('creates a collection from empty text', () => {
    expect(JSON.parse(appendFeatures('', [extra])).features).toHaveLength(1);
  });

  it('keeps foreign members of an existing collection', () => {
    const out = JSON.parse(appendFeatures(text, [extra]));
    expect(out.name).toBe('demo');
    expect(out.features).toHaveLength(3);
  });

  it('wraps a single feature', () => {
    expect(JSON.parse(appendFeatures(JSON.stringify(fc.features[0]), [extra])).features).toHaveLength(2);
  });
});

describe('mergeDocuments', () => {
  it('merges collections, features and bare geometries', () => {
    const merged = mergeDocuments([fc, fc.features[0], { type: 'Point', coordinates: [9, 9] }]);
    expect(merged.features).toHaveLength(4);
  });
});
