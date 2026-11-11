import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';

import { numProp, styleColor } from './layers';

/** Evaluate a MapLibre expression the way the renderer does, for one feature's properties. */
function evaluate(expression: unknown, properties: Record<string, unknown>) {
  const parsed = createExpression(expression);
  if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value));
  return parsed.value.evaluate({ zoom: 5 }, { type: 2, properties } as never);
}

describe('paint expressions', () => {
  it('uses the default when a numeric simplestyle property is missing (to-number(null) is 0)', () => {
    // Regression: ['to-number', ['get', 'stroke-width'], 2.5] evaluates to 0 for a missing key.
    expect(evaluate(['to-number', ['get', 'stroke-width'], 2.5], {})).toBe(0);
    expect(evaluate(numProp('stroke-width', 2.5), {})).toBe(2.5);
    expect(evaluate(numProp('stroke-width', 2.5), { 'stroke-width': 6 })).toBe(6);
    expect(evaluate(numProp('stroke-width', 2.5), { 'stroke-width': '4' })).toBe(4);
  });

  it('falls back to the QBDS data colour for missing or invalid colours', () => {
    const fallback = evaluate(styleColor('stroke'), {}) as { r: number; g: number; b: number };
    // #097DFE
    expect([fallback.r, fallback.g, fallback.b].map(v => Math.round(v * 255))).toEqual([9, 125, 254]);
    const custom = evaluate(styleColor('stroke'), { stroke: '#ff0000' }) as { r: number };
    expect(custom.r).toBe(1);
    const invalid = evaluate(styleColor('stroke'), { stroke: 'not a colour' }) as { b: number };
    expect(Math.round(invalid.b * 255)).toBe(254);
  });
});
