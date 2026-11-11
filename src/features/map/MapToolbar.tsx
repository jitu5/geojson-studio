import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import type { Map as MlMap } from 'maplibre-gl';
import { type ReactElement, useEffect, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { Toolbar, ToolbarButton, ToolbarSeparator, toolbarIconShellSizeMap, useToolbar } from '@/components/ui/toolbar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudio } from '@/state/studio';

import { BASEMAPS, type BasemapId } from './basemaps';

/** toolbar.json#ToolbarVertical: icon in an IconShell sized by the toolbar. */
function ToolbarIcon({ icon }: { icon: string }) {
  const { size } = useToolbar();
  return (
    <IconShell size={toolbarIconShellSizeMap[size]} variant="secondary">
      <Icon icon={icon} />
    </IconShell>
  );
}

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function MapToolbar({ map }: { map: MlMap | null }) {
  const studio = useStudio();
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 0);
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      setZoom(map.getZoom());
      setRotated(Math.abs(map.getBearing()) > 0.5 || map.getPitch() > 0.5);
    };
    update();
    map.on('move', update);
    return () => {
      map.off('move', update);
    };
  }, [map]);

  const canFit = Boolean(studio.analysis.bbox);

  return (
    <Toolbar
      aria-label="Map controls"
      orientation="vertical"
      boxed
      shape="square"
      className="absolute top-4 right-4 z-10">
      <Tip label="Zoom in">
        <ToolbarButton aria-label="Zoom in" onClick={() => studio.mapRef.current?.zoomIn()}>
          <ToolbarIcon icon="add" />
        </ToolbarButton>
      </Tip>
      <span className="label-small-primary text-fg-secondary py-0.5 text-center tabular-nums" aria-label={`Zoom level ${zoom.toFixed(1)}`}>
        {zoom.toFixed(1)}
      </span>
      <Tip label="Zoom out">
        <ToolbarButton aria-label="Zoom out" onClick={() => studio.mapRef.current?.zoomOut()}>
          <ToolbarIcon icon="remove" />
        </ToolbarButton>
      </Tip>
      <ToolbarSeparator />
      <Tip label="Fit to data">
        <ToolbarButton
          aria-label="Fit to data"
          disabled={!canFit}
          onClick={() => studio.analysis.bbox && studio.mapRef.current?.fitBounds(studio.analysis.bbox)}>
          <ToolbarIcon icon="fit_screen" />
        </ToolbarButton>
      </Tip>
      {rotated ? (
        <Tip label="Reset north and tilt">
          <ToolbarButton aria-label="Reset north and tilt" onClick={() => studio.mapRef.current?.resetNorth()}>
            <ToolbarIcon icon="explore" />
          </ToolbarButton>
        </Tip>
      ) : null}
      <ToolbarSeparator />
      <DropdownMenu>
        <DropdownMenuTrigger render={<ToolbarButton aria-label="Basemap" />}>
          <ToolbarIcon icon="layers" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Basemap</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={studio.basemap} onValueChange={v => studio.setBasemap(v as BasemapId)}>
              {BASEMAPS.map(b => (
                <DropdownMenuRadioItem key={b.id} value={b.id}>
                  <span className="flex flex-col">
                    <span>{b.label}</span>
                    <span className="paragraph-small-primary text-fg-tertiary">{b.description}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip label={studio.tileGrid.enabled ? 'Hide tile grid' : 'Show tile grid'}>
        <ToolbarButton
          aria-label="Tile grid"
          // Pressed fill is fill-active; flip the icon so it stays visible (QBDS Toggle does the same).
          className="data-[pressed]:**:data-[slot=icon]:text-fill-active-inverse"
          render={
            <TogglePrimitive
              pressed={studio.tileGrid.enabled}
              onPressedChange={enabled => studio.setTileGrid({ ...studio.tileGrid, enabled })}
            />
          }>
          <ToolbarIcon icon="grid_on" />
        </ToolbarButton>
      </Tip>
      <Tip label={studio.mapOnly ? 'Show panel (Esc)' : 'Map only'}>
        <ToolbarButton aria-label={studio.mapOnly ? 'Show panel' : 'Map only'} onClick={() => studio.setMapOnly(!studio.mapOnly)}>
          <ToolbarIcon icon={studio.mapOnly ? 'close_fullscreen' : 'open_in_full'} />
        </ToolbarButton>
      </Tip>
    </Toolbar>
  );
}
