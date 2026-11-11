import type { FeatureCollection } from 'geojson';
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  Map as MlMap,
} from 'maplibre-gl';

import type { GeometryFamily } from '@/lib/geo/types';
import { MAP_COLORS, PLOT } from '@/lib/palette';

export const SOURCES = {
  data: 'studio-data',
  labels: 'studio-labels',
  grid: 'studio-grid',
  draw: 'studio-draw',
  marker: 'studio-marker',
} as const;

export const DATA_LAYERS: Record<GeometryFamily, string[]> = {
  polygon: ['studio-fill', 'studio-outline'],
  line: ['studio-line'],
  point: ['studio-point'],
};

/** Layers that can be clicked, top-most first. */
export const INTERACTIVE_LAYERS = ['studio-point', 'studio-line', 'studio-fill', 'studio-outline'];

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
const matched: ExpressionSpecification = ['boolean', ['feature-state', 'matched'], false];
const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

function familyFilter(family: GeometryFamily): FilterSpecification {
  return ['==', ['get', '__g'], family];
}

/**
 * Numeric simplestyle property with a default. Guarded by `has` because MapLibre's `to-number`
 * converts a missing (null) value to 0 instead of using the fallback, which made lines 0px wide.
 */
export function numProp(prop: string, fallback: number): ExpressionSpecification {
  return ['case', ['has', prop], ['to-number', ['get', prop], fallback], fallback];
}

/** simplestyle-spec property as a colour, falling back to the QBDS data colour. */
export function styleColor(prop: string, fallback: string = MAP_COLORS.feature): ExpressionSpecification {
  return ['case', ['has', prop], ['to-color', ['get', prop], fallback], fallback];
}

function stateColor(base: ExpressionSpecification): ExpressionSpecification {
  return ['case', selected, MAP_COLORS.selected, matched, MAP_COLORS.matched, base];
}

const choroOr = (fallback: ExpressionSpecification): ExpressionSpecification => [
  'case',
  ['has', '__choro'],
  ['to-color', ['get', '__choro']],
  fallback,
];

function firstSymbolLayer(map: MlMap): string | undefined {
  return map.getStyle().layers?.find(l => l.type === 'symbol')?.id;
}

/** The basemap's own label font, so our labels can use glyphs the style actually serves. */
export function basemapFont(map: MlMap, fallback: string[]): string[] {
  const stacks: string[][] = [];
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const font = (layer.layout as Record<string, unknown> | undefined)?.['text-font'];
    if (Array.isArray(font) && font.length && font.every(f => typeof f === 'string')) stacks.push(font as string[]);
  }
  // Water labels come first in most styles and are italic; data labels should be upright regular.
  const upright = stacks.filter(s => !/italic/i.test(s[0]));
  return upright.find(s => /regular/i.test(s[0])) ?? upright.find(s => /medium/i.test(s[0])) ?? upright[0] ?? stacks[0] ?? fallback;
}

export function addStudioLayers(map: MlMap, opts: { dark: boolean; font: string[] }): void {
  const plot = opts.dark ? PLOT.dark : PLOT.light;
  const add = (spec: LayerSpecification, beforeId?: string) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec, beforeId);
  };

  if (!map.getSource(SOURCES.data)) map.addSource(SOURCES.data, { type: 'geojson', data: empty(), promoteId: '__idx' });
  if (!map.getSource(SOURCES.labels)) map.addSource(SOURCES.labels, { type: 'geojson', data: empty() });
  if (!map.getSource(SOURCES.grid)) map.addSource(SOURCES.grid, { type: 'geojson', data: empty() });
  if (!map.getSource(SOURCES.draw)) map.addSource(SOURCES.draw, { type: 'geojson', data: empty() });
  if (!map.getSource(SOURCES.marker)) map.addSource(SOURCES.marker, { type: 'geojson', data: empty() });

  // Polygons sit under the basemap's place labels so the map stays readable.
  const beneathLabels = firstSymbolLayer(map);

  add(
    {
      id: 'studio-fill',
      type: 'fill',
      source: SOURCES.data,
      filter: familyFilter('polygon'),
      paint: {
        'fill-color': stateColor(choroOr(styleColor('fill'))),
        'fill-opacity': [
          'case',
          selected,
          0.5,
          matched,
          0.5,
          ['has', '__choro'],
          0.82,
          numProp('fill-opacity', 0.28),
        ],
      },
    },
    beneathLabels,
  );
  add(
    {
      id: 'studio-outline',
      type: 'line',
      source: SOURCES.data,
      filter: familyFilter('polygon'),
      paint: {
        'line-color': stateColor(['case', ['has', 'stroke'], styleColor('stroke'), choroOr(styleColor('fill'))]),
        'line-width': ['case', selected, 3, hovered, 2.5, numProp('stroke-width', 1.25)],
        'line-opacity': numProp('stroke-opacity', 0.95),
      },
    },
    beneathLabels,
  );
  add({
    id: 'studio-line',
    type: 'line',
    source: SOURCES.data,
    filter: familyFilter('line'),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': stateColor(choroOr(styleColor('stroke'))),
      'line-width': ['case', selected, 5, hovered, 4, numProp('stroke-width', 2.5)],
      'line-opacity': numProp('stroke-opacity', 1),
    },
  });
  add({
    id: 'studio-point',
    type: 'circle',
    source: SOURCES.data,
    filter: familyFilter('point'),
    paint: {
      'circle-color': stateColor(choroOr(styleColor('marker-color'))),
      'circle-radius': [
        'case',
        selected,
        8,
        hovered,
        7,
        ['match', ['get', 'marker-size'], 'small', 4, 'large', 8, 5.5],
      ],
      'circle-stroke-color': plot.background,
      'circle-stroke-width': 1.5,
    },
  });
  add({
    id: 'studio-label',
    type: 'symbol',
    source: SOURCES.labels,
    layout: {
      'text-field': ['get', '__label'],
      'text-font': opts.font,
      'text-size': 12,
      'text-offset': ['case', ['==', ['get', '__src'], 'point'], ['literal', [0, 0.9]], ['literal', [0, 0]]],
      'text-anchor': ['case', ['==', ['get', '__src'], 'point'], 'top', 'center'],
      'text-max-width': 12,
      'text-allow-overlap': false,
    },
    paint: { 'text-color': plot.title, 'text-halo-color': plot.background, 'text-halo-width': 1.5 },
  });

  // Tile grid
  add({
    id: 'studio-grid-fill',
    type: 'fill',
    source: SOURCES.grid,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'selected'], true]],
    paint: { 'fill-color': MAP_COLORS.matched, 'fill-opacity': 0.16 },
  });
  add({
    id: 'studio-grid-line',
    type: 'line',
    source: SOURCES.grid,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': ['case', ['==', ['get', 'selected'], true], MAP_COLORS.matched, plot.axis],
      'line-width': ['case', ['==', ['get', 'selected'], true], 2, 1],
    },
  });
  add({
    id: 'studio-grid-label',
    type: 'symbol',
    source: SOURCES.grid,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': opts.font,
      'text-size': 11,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': plot.label, 'text-halo-color': plot.background, 'text-halo-width': 1 },
  });

  // Tool drawings and the go-to marker
  add({
    id: 'studio-draw-fill',
    type: 'fill',
    source: SOURCES.draw,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': MAP_COLORS.drawing, 'fill-opacity': 0.14 },
  });
  add({
    id: 'studio-draw-line',
    type: 'line',
    source: SOURCES.draw,
    filter: ['all', ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]], ['!=', ['get', 'preview'], true]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': MAP_COLORS.drawing, 'line-width': 2.5 },
  });
  add({
    id: 'studio-draw-preview',
    type: 'line',
    source: SOURCES.draw,
    filter: ['==', ['get', 'preview'], true],
    paint: { 'line-color': MAP_COLORS.drawing, 'line-width': 2, 'line-dasharray': [1.5, 1.5] },
  });
  add({
    id: 'studio-draw-point',
    type: 'circle',
    source: SOURCES.draw,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': MAP_COLORS.drawing,
      'circle-radius': 5,
      'circle-stroke-color': plot.background,
      'circle-stroke-width': 1.5,
    },
  });
  add({
    id: 'studio-marker',
    type: 'circle',
    source: SOURCES.marker,
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': 12,
      'circle-stroke-color': MAP_COLORS.selected,
      'circle-stroke-width': 3,
    },
  });
}
