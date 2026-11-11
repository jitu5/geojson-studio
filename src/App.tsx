import { useEffect } from 'react';

import { AppHeader } from '@/components/layout/AppHeader';
import { PanelResizer } from '@/components/layout/PanelResizer';
import { SidePanel } from '@/components/layout/SidePanel';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DropOverlay } from '@/features/data/FileDrop';
import { MapPane } from '@/features/map/MapPane';
import { DEFAULT_PANEL_WIDTH, StudioProvider, useStudio } from '@/state/studio';

const MIN_PANEL = 320;
const MIN_MAP = 320;

function useEscape() {
  const studio = useStudio();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Leave Escape to open menus, selects and the editor search panel.
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="menu"], [role="listbox"], .cm-panels')) return;
      if (studio.tool) studio.setTool(null);
      else if (studio.selection || studio.tileInfo || studio.matches) {
        studio.select(null);
        studio.setTileInfo(null);
        studio.clearMatches();
      } else if (studio.mapOnly) studio.setMapOnly(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);
}

function Workspace() {
  const studio = useStudio();
  useEscape();
  const maxPanel = Math.max(MIN_PANEL, (typeof window === 'undefined' ? 1280 : window.innerWidth) - MIN_MAP);

  return (
    <div className="bg-surface-base text-fg-primary flex h-svh flex-col overflow-hidden">
      {studio.mapOnly ? null : <AppHeader />}
      <main className="flex min-h-0 flex-1">
        <MapPane />
        {studio.mapOnly ? null : (
          <>
            <PanelResizer
              width={studio.panelWidth}
              min={MIN_PANEL}
              max={maxPanel}
              onChange={studio.setPanelWidth}
              onReset={() => studio.setPanelWidth(DEFAULT_PANEL_WIDTH)}
            />
            <SidePanel />
          </>
        )}
      </main>
      <DropOverlay />
      <Toaster position="bottom-right" />
    </div>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <TooltipProvider>
        <Workspace />
      </TooltipProvider>
    </StudioProvider>
  );
}
