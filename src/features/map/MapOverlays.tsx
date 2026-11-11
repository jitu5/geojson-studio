import type { Map as MlMap } from 'maplibre-gl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { TagToggle } from '@/components/ui/tag-toggle';
import { formatLngLat } from '@/lib/geo/measure';
import type { GeometryFamily } from '@/lib/geo/types';
import { useStudio } from '@/state/studio';

const FAMILIES: { id: GeometryFamily; label: string; icon: string }[] = [
  { id: 'point', label: 'Points', icon: 'location_on' },
  { id: 'line', label: 'Lines', icon: 'polyline' },
  { id: 'polygon', label: 'Polygons', icon: 'pentagon' },
];

/** tag-toggle.json#TagToggleDemo — pressed chip = family visible. */
export function GeometryFilters() {
  const { analysis, hiddenFamilies, toggleFamily } = useStudio();
  const present = FAMILIES.filter(f => analysis.counts[f.id] > 0);
  if (present.length === 0) return null;
  return (
    <div className="absolute bottom-9 left-4 z-10 flex flex-wrap gap-2" role="group" aria-label="Show geometry types">
      {present.map(f => (
        <TagToggle
          key={f.id}
          size="sm"
          pressed={!hiddenFamilies.includes(f.id)}
          onPressedChange={() => toggleFamily(f.id)}
          aria-label={`${f.label}: ${analysis.counts[f.id]}`}
          className="shadow-elevation-1">
          <IconShell size="sm" type="neutral" variant="primary">
            <Icon icon={f.icon} />
          </IconShell>
          {f.label} {analysis.counts[f.id].toLocaleString()}
        </TagToggle>
      ))}
    </div>
  );
}

const HINTS = {
  pick: 'Click the map to read coordinates',
  measure: 'Click to add points, double-click to finish',
  bbox: 'Click two opposite corners',
} as const;

export function ToolHint() {
  const { tool, setTool, toolFinished, setToolFinished, toolPoints } = useStudio();
  if (!tool) return null;
  return (
    <div
      className="bg-surface-primary border-stroke-tertiary shadow-elevation-1 absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 border py-1 pr-1 pl-3"
      role="status">
      <span className="label-regular-primary text-fg-primary whitespace-nowrap">{HINTS[tool]}</span>
      {tool === 'measure' && !toolFinished && toolPoints.length > 1 ? (
        <Button size="sm" variant="secondary" onClick={() => setToolFinished(true)}>
          Finish
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => setTool(null)}>
        Cancel
      </Button>
    </div>
  );
}

export function CursorReadout({ map }: { map: MlMap | null }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!map) return;
    const move = (e: { lngLat: { lng: number; lat: number } }) => setText(formatLngLat([e.lngLat.lng, e.lngLat.lat]));
    const out = () => setText(null);
    map.on('mousemove', move);
    map.on('mouseout', out);
    return () => {
      map.off('mousemove', move);
      map.off('mouseout', out);
    };
  }, [map]);
  if (!text) return null;
  return (
    <div className="bg-surface-primary/80 paragraph-code-text text-fg-secondary pointer-events-none absolute right-4 bottom-11 z-10 px-2 py-1 tabular-nums">
      {text}
    </div>
  );
}

export function EmptyMapHint() {
  const { analysis, setTab, setMapOnly, tool } = useStudio();
  if (analysis.status !== 'empty' || tool) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center">
      <div className="bg-surface-primary border-stroke-tertiary shadow-elevation-1 pointer-events-auto flex items-center gap-3 border px-4 py-3">
        <IconShell size="default" type="neutral" variant="secondary">
          <Icon icon="upload_file" />
        </IconShell>
        <span className="paragraph-regular-primary text-fg-secondary">Drop GeoJSON files here, paste into the editor, or</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setMapOnly(false);
            setTab('data');
          }}>
          Open samples
        </Button>
      </div>
    </div>
  );
}
