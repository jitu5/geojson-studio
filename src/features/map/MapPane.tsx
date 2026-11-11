import type { Map as MlMap } from 'maplibre-gl';
import { useState } from 'react';

import { FeatureInspector } from './FeatureInspector';
import { MapSearch } from './MapSearch';
import { MapToolbar } from './MapToolbar';
import { MapView } from './MapView';
import { CursorReadout, EmptyMapHint, GeometryFilters, ToolHint } from './MapOverlays';

export function MapPane() {
  const [map, setMap] = useState<MlMap | null>(null);
  return (
    <section className="relative min-w-80 flex-1 overflow-hidden" aria-label="Map area">
      <MapView onReady={setMap} />
      <MapSearch />
      <FeatureInspector />
      <ToolHint />
      <MapToolbar map={map} />
      <GeometryFilters />
      <CursorReadout map={map} />
      <EmptyMapHint />
    </section>
  );
}
