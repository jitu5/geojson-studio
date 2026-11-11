import maplibregl, { type GeoJSONSource, type Map as MlMap, type PointLike } from 'maplibre-gl';
import type { Feature as GeoJsonFeature, FeatureCollection as GeoJsonCollection } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';

import { toast } from '@/components/ui/sonner';
import { geometryBBox } from '@/lib/geo/bbox';
import { buildDrawData, nextToolPoints } from '@/lib/geo/draw';
import { buildLabelData, buildRenderData } from '@/lib/geo/render';
import { lngLatToTile, tileBounds, tilesInBBox, tileToQuadkey, tmsY } from '@/lib/geo/tiles';
import type { LngLat } from '@/lib/geo/types';
import { type MapHandle, useStudio } from '@/state/studio';

import { basemapIsDark, FALLBACK_FONT, resolveStyle } from './basemaps';
import { addStudioLayers, basemapFont, DATA_LAYERS, INTERACTIVE_LAYERS, SOURCES } from './layers';

const FIT_PADDING = 64;

function source(map: MlMap, id: string): GeoJSONSource | undefined {
  return map.getSource(id) as GeoJSONSource | undefined;
}

/** Grid zoom: integer zoom of the tiles currently on screen. */
function gridZoom(map: MlMap): number {
  return Math.max(0, Math.min(22, Math.floor(map.getZoom())));
}

/** Topmost feature index under a point, preferring points over lines over polygons. */
function pickFeature(map: MlMap, point: { x: number; y: number }): number | null {
  const layers = INTERACTIVE_LAYERS.filter(id => map.getLayer(id));
  if (!layers.length) return null;
  const box: [PointLike, PointLike] = [
    [point.x - 4, point.y - 4],
    [point.x + 4, point.y + 4],
  ];
  const hits = map.queryRenderedFeatures(box, { layers });
  for (const layer of INTERACTIVE_LAYERS) {
    const candidates = hits.filter(h => h.layer.id === layer && typeof h.properties?.__idx === 'number');
    if (!candidates.length) continue;
    if (layer !== 'studio-point') return candidates[0].properties.__idx as number;
    // Points overlap at low zoom: take the one nearest the cursor, not the one drawn last.
    let best = candidates[0];
    let bestDist = Infinity;
    for (const c of candidates) {
      if (c.geometry.type !== 'Point') continue;
      const p = map.project(c.geometry.coordinates as [number, number]);
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best.properties.__idx as number;
  }
  return null;
}

export function MapView({ onReady }: { onReady: (map: MlMap | null) => void }) {
  const studio = useStudio();
  const latest = useRef(studio);
  latest.current = studio;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const cursorRef = useRef<LngLat | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);

  const { analysis, choropleth, labelProperty, selection, matches, hiddenFamilies, tool, toolPoints, toolFinished } =
    studio;

  const renderData = useMemo(() => buildRenderData(analysis, choropleth), [analysis, choropleth]);
  const labelData = useMemo(() => buildLabelData(analysis, labelProperty), [analysis, labelProperty]);

  // ---- create the map once ----------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const initial = latest.current.initialView;
    const map = new maplibregl.Map({
      container,
      style: resolveStyle(latest.current.basemap, latest.current.theme),
      center: initial?.center ?? [10, 28],
      zoom: initial?.zoom ?? 1.6,
      bearing: initial?.bearing ?? 0,
      pitch: initial?.pitch ?? 0,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    let styleErrorShown = false;
    map.on('error', e => {
      const message = e.error?.message ?? '';
      if (!styleErrorShown && /style|Failed to fetch/i.test(message)) {
        styleErrorShown = true;
        toast.error('The basemap could not be loaded. Data still renders.');
      }
    });

    map.on('style.load', () => {
      const st = latest.current;
      addStudioLayers(map, { dark: basemapIsDark(st.basemap, st.theme), font: basemapFont(map, FALLBACK_FONT) });
      setStyleEpoch(n => n + 1);
    });

    map.on('click', e => {
      const st = latest.current;
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (st.tool) {
        const next = nextToolPoints(st.tool, st.toolPoints, st.toolFinished, p);
        st.setToolPoints(next.points);
        st.setToolFinished(next.finished);
        return;
      }
      const hit = pickFeature(map, e.point);
      if (hit !== null) {
        st.select({ idx: hit, origin: 'map' });
        return;
      }
      st.select(null);
      st.clearMatches();
      st.setTileInfo(st.tileGrid.enabled ? lngLatToTile(p, gridZoom(map)) : null);
    });

    map.on('dblclick', e => {
      const st = latest.current;
      if (st.tool !== 'measure' || st.toolFinished) return;
      e.preventDefault();
      // A double-click also fired two clicks at the same spot: drop the duplicate vertex.
      const pts = [...st.toolPoints];
      while (pts.length > 1) {
        const a = map.project(pts[pts.length - 1] as [number, number]);
        const b = map.project(pts[pts.length - 2] as [number, number]);
        if (Math.hypot(a.x - b.x, a.y - b.y) > 4) break;
        pts.pop();
      }
      st.setToolPoints(pts);
      st.setToolFinished(true);
    });

    let hoverId: number | null = null;
    map.on('mousemove', e => {
      cursorRef.current = [e.lngLat.lng, e.lngLat.lat];
      const st = latest.current;
      const canvas = map.getCanvas();
      if (st.tool) {
        canvas.style.cursor = 'crosshair';
        if (!st.toolFinished && st.toolPoints.length) {
          source(map, SOURCES.draw)?.setData(buildDrawData(st.tool, st.toolPoints, false, cursorRef.current));
        }
        return;
      }
      const hit = pickFeature(map, e.point);
      if (hit !== hoverId) {
        if (hoverId !== null) map.setFeatureState({ source: SOURCES.data, id: hoverId }, { hover: false });
        if (hit !== null) map.setFeatureState({ source: SOURCES.data, id: hit }, { hover: true });
        hoverId = hit;
      }
      canvas.style.cursor = hit !== null ? 'pointer' : '';
    });
    map.on('mouseout', () => {
      if (hoverId !== null) map.setFeatureState({ source: SOURCES.data, id: hoverId }, { hover: false });
      hoverId = null;
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      latest.current.persistView({
        center: [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))],
        zoom: Number(map.getZoom().toFixed(2)),
        bearing: Number(map.getBearing().toFixed(1)),
        pitch: Number(map.getPitch().toFixed(1)),
      });
      drawGrid(map);
    });

    const handle: MapHandle = {
      fitBounds: box =>
        map.fitBounds(
          [
            [box[0], box[1]],
            [box[2], box[3]],
          ],
          { padding: FIT_PADDING, maxZoom: 16, duration: 600 },
        ),
      flyTo: (center, zoom) => map.flyTo({ center, zoom: zoom ?? Math.max(map.getZoom(), 12), duration: 800 }),
      zoomIn: () => map.zoomIn({ duration: 200 }),
      zoomOut: () => map.zoomOut({ duration: 200 }),
      resetNorth: () => map.easeTo({ bearing: 0, pitch: 0, duration: 400 }),
      resize: () => map.resize(),
    };
    const handleRef = latest.current.mapRef;
    handleRef.current = handle;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    if (import.meta.env.DEV || window.location.search.includes('e2e=1')) {
      (window as unknown as { __studioMap?: MlMap }).__studioMap = map;
    }
    onReady(map);

    return () => {
      ro.disconnect();
      handleRef.current = null;
      onReady(null);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once; handlers read `latest`
  }, []);

  // ---- basemap / theme --------------------------------------------------------------------
  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    mapRef.current?.setStyle(resolveStyle(studio.basemap, studio.theme), { diff: false });
  }, [studio.basemap, studio.theme]);

  // ---- data -------------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (map && styleEpoch) source(map, SOURCES.data)?.setData(renderData as unknown as GeoJsonCollection);
  }, [renderData, styleEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleEpoch) source(map, SOURCES.labels)?.setData(labelData as unknown as GeoJsonCollection);
  }, [labelData, styleEpoch]);

  // Selection + property matches are feature-state, so the data never re-uploads for a click.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleEpoch || !map.getSource(SOURCES.data)) return;
    map.removeFeatureState({ source: SOURCES.data });
    matches?.indexes.forEach(id => map.setFeatureState({ source: SOURCES.data, id }, { matched: true }));
    if (selection) map.setFeatureState({ source: SOURCES.data, id: selection.idx }, { selected: true });
  }, [selection, matches, renderData, styleEpoch]);

  // Editor-driven selection: bring the feature into view if it is off screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selection || selection.origin === 'map') return;
    const box = geometryBBox(latest.current.analysis.features[selection.idx]?.geometry ?? null);
    if (!box) return;
    const view = map.getBounds();
    const visible = box[2] >= view.getWest() && box[0] <= view.getEast() && box[3] >= view.getSouth() && box[1] <= view.getNorth();
    if (!visible || selection.origin === 'inspector') {
      map.fitBounds(
        [
          [box[0], box[1]],
          [box[2], box[3]],
        ],
        { padding: FIT_PADDING * 2, maxZoom: Math.max(map.getZoom(), 14), duration: 600 },
      );
    }
  }, [selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleEpoch) return;
    (Object.keys(DATA_LAYERS) as (keyof typeof DATA_LAYERS)[]).forEach(family => {
      const visibility = hiddenFamilies.includes(family) ? 'none' : 'visible';
      DATA_LAYERS[family].forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', visibility));
    });
  }, [hiddenFamilies, styleEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    const box = latest.current.analysis.bbox;
    if (map && studio.fitToken && box) latest.current.mapRef.current?.fitBounds(box);
  }, [studio.fitToken]);

  // ---- tools ------------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tool) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = tool ? 'crosshair' : '';
  }, [tool]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleEpoch) source(map, SOURCES.draw)?.setData(buildDrawData(tool, toolPoints, toolFinished, cursorRef.current));
  }, [tool, toolPoints, toolFinished, styleEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = studio.marker;
    if (!map || !styleEpoch) return;
    const src = source(map, SOURCES.marker);
    if (!marker) return;
    src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: marker.at } });
    const t = window.setTimeout(() => src?.setData({ type: 'FeatureCollection', features: [] }), 4000);
    return () => window.clearTimeout(t);
  }, [studio.marker, styleEpoch]);

  // ---- tile grid --------------------------------------------------------------------------
  function drawGrid(map: MlMap) {
    const st = latest.current;
    const src = source(map, SOURCES.grid);
    if (!src) return;
    if (!st.tileGrid.enabled) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const z = gridZoom(map);
    const b = map.getBounds();
    const tiles = tilesInBBox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z) ?? [];
    const features: GeoJsonFeature[] = [];
    for (const t of tiles) {
      const [w, s, e, n] = tileBounds(t);
      const isSelected = st.tileInfo?.z === t.z && st.tileInfo.x === t.x && st.tileInfo.y === t.y;
      const row = st.tileGrid.scheme === 'tms' ? tmsY(t) : t.y;
      features.push({
        type: 'Feature',
        properties: { selected: isSelected },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
        },
      });
      features.push({
        type: 'Feature',
        properties: { label: `${t.z}/${t.x}/${row}${t.z ? `\n${tileToQuadkey(t)}` : ''}` },
        geometry: { type: 'Point', coordinates: [(w + e) / 2, (s + n) / 2] },
      });
    }
    src.setData({ type: 'FeatureCollection', features });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (map && styleEpoch) drawGrid(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drawGrid reads latest state
  }, [studio.tileGrid, studio.tileInfo, styleEpoch]);

  // maplibre-gl.css sets `.maplibregl-map { position: relative }` as unlayered CSS, which beats Tailwind v4's
  // layered `absolute` on the same element. Positioning lives on a wrapper; MapLibre owns the inner div.
  return (
    <div className="bg-surface-base absolute inset-0">
      <div ref={containerRef} className="h-full w-full" aria-label="Map" role="application" />
    </div>
  );
}
