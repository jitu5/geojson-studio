import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import type { BasemapId, Theme } from '@/features/map/basemaps';
import { featureRanges, mergeDocuments, type Range } from '@/lib/geo/locate';
import { type Analysis, analyse, emptyAnalysis, parseJson } from '@/lib/geo/normalize';
import { matchingIndexes } from '@/lib/geo/properties';
import { type Choropleth, choroplethRange } from '@/lib/geo/render';
import type { Tile } from '@/lib/geo/tiles';
import type { GeometryFamily, LngLat } from '@/lib/geo/types';
import { EDITOR_LIMIT_BYTES, fetchUrls, LoadError, type LoadResult, readFiles } from '@/lib/loaders';
import { loadState, saveState } from '@/lib/persistence';
import { readStartupParams, withUrlParam } from '@/lib/urlParams';

export type ToolMode = 'pick' | 'measure' | 'bbox';
export type PanelTab = 'editor' | 'data' | 'tools';

export interface Selection {
  idx: number;
  origin: 'map' | 'editor' | 'inspector';
}

export interface Matches {
  key: string;
  value: unknown;
  indexes: number[];
}

export interface MapHandle {
  fitBounds: (box: [number, number, number, number]) => void;
  flyTo: (center: LngLat, zoom?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetNorth: () => void;
  resize: () => void;
}

interface StudioValue {
  // data
  text: string;
  textVersion: number;
  analysis: Analysis;
  ranges: Range[];
  largeInput: boolean;
  loading: boolean;
  setTextFromEditor: (text: string) => void;
  replaceText: (text: string, opts?: { fit?: boolean; message?: string }) => void;
  loadFiles: (files: File[], opts?: { merge?: boolean }) => Promise<void>;
  loadUrls: (urls: string[], opts?: { authorization?: string; pushUrl?: boolean }) => Promise<void>;
  clear: () => void;
  // selection
  selection: Selection | null;
  select: (sel: Selection | null) => void;
  matches: Matches | null;
  highlightMatches: (key: string, value: unknown) => void;
  clearMatches: () => void;
  hiddenFamilies: GeometryFamily[];
  toggleFamily: (family: GeometryFamily) => void;
  // tools
  tool: ToolMode | null;
  setTool: (tool: ToolMode | null) => void;
  toolPoints: LngLat[];
  setToolPoints: (points: LngLat[] | ((prev: LngLat[]) => LngLat[])) => void;
  toolFinished: boolean;
  setToolFinished: (done: boolean) => void;
  labelProperty: string | null;
  setLabelProperty: (key: string | null) => void;
  choropleth: Choropleth | null;
  applyChoropleth: (key: string | null) => void;
  tileGrid: { enabled: boolean; scheme: 'xyz' | 'tms' };
  setTileGrid: (next: { enabled: boolean; scheme: 'xyz' | 'tms' }) => void;
  tileInfo: Tile | null;
  setTileInfo: (tile: Tile | null) => void;
  marker: { at: LngLat; token: number } | null;
  showMarker: (at: LngLat) => void;
  // view
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
  theme: Theme;
  toggleTheme: () => void;
  mapOnly: boolean;
  setMapOnly: (v: boolean) => void;
  panelWidth: number;
  setPanelWidth: (px: number) => void;
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  fitToken: number;
  requestFit: () => void;
  mapRef: React.RefObject<MapHandle | null>;
  initialView: { center: [number, number]; zoom: number; bearing: number; pitch: number } | null;
  persistView: (view: { center: [number, number]; zoom: number; bearing: number; pitch: number }) => void;
}

const StudioContext = createContext<StudioValue | null>(null);

export const DEFAULT_PANEL_WIDTH = 440;

function bytes(text: string): number {
  // UTF-16 length is a good-enough proxy; exact UTF-8 size is not needed for a threshold.
  return text.length;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(() => loadState(), []);
  const startup = useMemo(() => readStartupParams(window.location.href), []);

  const [text, setText] = useState<string>(() => (startup.urls.length ? '' : (saved.text ?? '')));
  const [textVersion, setTextVersion] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis>(() => (text ? analyse(text) : emptyAnalysis()));
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [matches, setMatches] = useState<Matches | null>(null);
  const [hiddenFamilies, setHiddenFamilies] = useState<GeometryFamily[]>([]);
  const [tool, setToolState] = useState<ToolMode | null>(null);
  const [toolPoints, setToolPoints] = useState<LngLat[]>([]);
  const [toolFinished, setToolFinished] = useState(false);
  const [labelProperty, setLabelProperty] = useState<string | null>(null);
  const [choroplethKey, setChoroplethKey] = useState<string | null>(null);
  const [tileGrid, setTileGridState] = useState<{ enabled: boolean; scheme: 'xyz' | 'tms' }>({
    enabled: false,
    scheme: saved.tileScheme ?? 'xyz',
  });
  const [tileInfo, setTileInfo] = useState<Tile | null>(null);
  const [marker, setMarker] = useState<{ at: LngLat; token: number } | null>(null);
  const [basemap, setBasemapState] = useState<BasemapId>((saved.basemap as BasemapId) ?? 'auto');
  const [theme, setTheme] = useState<Theme>(saved.theme ?? 'dark');
  const [mapOnly, setMapOnly] = useState(startup.mapOnly);
  const [panelWidth, setPanelWidthState] = useState(saved.panelWidth ?? DEFAULT_PANEL_WIDTH);
  const [tab, setTab] = useState<PanelTab>('editor');
  const [fitToken, setFitToken] = useState(0);
  const mapRef = useRef<MapHandle | null>(null);

  const initialView = useMemo(() => {
    if (startup.view) return { center: startup.view.center, zoom: startup.view.zoom, bearing: 0, pitch: 0 };
    return saved.view ?? null;
  }, [saved.view, startup.view]);

  // ---- theme on <html> -------------------------------------------------------------------
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveState({ theme });
  }, [theme]);

  // ---- analysis (debounced for typing) ---------------------------------------------------
  const pendingFit = useRef(false);
  const debounce = useRef<number | undefined>(undefined);
  const runAnalysis = useCallback((next: string) => {
    const result = analyse(next);
    setAnalysis(result);
    if (pendingFit.current && result.bbox) setFitToken(t => t + 1);
    pendingFit.current = false;
    if (bytes(next) <= 2 * 1024 * 1024) saveState({ text: next });
    else saveState({ text: '' });
  }, []);

  const setTextFromEditor = useCallback(
    (next: string) => {
      setText(next);
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => runAnalysis(next), 300);
    },
    [runAnalysis],
  );

  const resetDerived = useCallback(() => {
    setSelection(null);
    setMatches(null);
    setTileInfo(null);
  }, []);

  const replaceText = useCallback(
    (next: string, opts?: { fit?: boolean; message?: string }) => {
      window.clearTimeout(debounce.current);
      resetDerived();
      setText(next);
      setTextVersion(v => v + 1);
      pendingFit.current = opts?.fit ?? true;
      runAnalysis(next);
      if (opts?.message) toast.success(opts.message);
    },
    [resetDerived, runAnalysis],
  );

  const ranges = useMemo(() => (bytes(text) > EDITOR_LIMIT_BYTES ? [] : featureRanges(text)), [text]);
  const largeInput = bytes(text) > EDITOR_LIMIT_BYTES;

  // ---- loading ------------------------------------------------------------------------------
  const applyLoad = useCallback(
    (result: LoadResult) => {
      const preview = analyse(result.text);
      replaceText(result.text, { fit: true });
      setTab('editor');
      const n = preview.counts.rendered;
      const failed = preview.counts.failed;
      if (failed && n === 0) toast.error(`No features could be drawn. ${failed} failed validation.`);
      else if (failed) toast.warning(`${n} features loaded, ${failed} failed validation`);
      else toast.success(`${n} feature${n === 1 ? '' : 's'} loaded`);
      result.failures.forEach(f => toast.error(f.reason));
      if (bytes(result.text) > EDITOR_LIMIT_BYTES) {
        toast.info('Large input: the editor is read-only, the map shows all features.');
      }
    },
    [replaceText],
  );

  const loadFiles = useCallback(
    async (files: File[], opts?: { merge?: boolean }) => {
      if (!files.length) return;
      setLoading(true);
      try {
        const result = await readFiles(files);
        if (opts?.merge && text.trim()) {
          const current = parseJson(text);
          if (current.ok) {
            result.text = JSON.stringify(mergeDocuments([current.value, JSON.parse(result.text)]), null, 2);
          }
        }
        applyLoad(result);
        window.history.replaceState(null, '', withUrlParam(window.location.href, null));
      } catch (e) {
        toast.error(e instanceof LoadError ? e.message : 'Could not read the file');
      } finally {
        setLoading(false);
      }
    },
    [applyLoad, text],
  );

  const loadUrls = useCallback(
    async (urls: string[], opts?: { authorization?: string; pushUrl?: boolean }) => {
      if (!urls.length) return;
      setLoading(true);
      try {
        const result = await fetchUrls(urls, opts?.authorization);
        applyLoad(result);
        if (opts?.pushUrl !== false) window.history.pushState(null, '', withUrlParam(window.location.href, result.sources));
      } catch (e) {
        toast.error(e instanceof LoadError ? e.message : 'Could not load the URL');
      } finally {
        setLoading(false);
      }
    },
    [applyLoad],
  );

  // Deep links: ?url=a;b or #url=...
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || !startup.urls.length) return;
    startedRef.current = true;
    void loadUrls(startup.urls, { pushUrl: false });
  }, [loadUrls, startup.urls]);

  const clear = useCallback(() => {
    const previous = text;
    replaceText('', { fit: false });
    setLabelProperty(null);
    setChoroplethKey(null);
    window.history.replaceState(null, '', withUrlParam(window.location.href, null));
    if (!previous.trim()) return;
    let id: string | number = 0;
    id = toast.default('Data cleared', {
      duration: 8000,
      action: (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            replaceText(previous, { fit: false });
            toast.dismiss(id);
          }}>
          Undo
        </Button>
      ),
    });
  }, [replaceText, text]);

  // ---- selection --------------------------------------------------------------------------
  const select = useCallback((sel: Selection | null) => {
    setSelection(prev => (prev?.idx === sel?.idx && prev?.origin === sel?.origin ? prev : sel));
    if (sel) setTileInfo(null);
  }, []);

  const highlightMatches = useCallback(
    (key: string, value: unknown) => {
      const indexes = matchingIndexes(analysis.features, analysis.valid, key, value);
      setMatches({ key, value, indexes });
      const shown = typeof value === 'string' ? value : JSON.stringify(value);
      toast.info(`Highlighting ${indexes.length} of ${analysis.counts.rendered} features with ${key} = ${shown}`);
    },
    [analysis],
  );
  const clearMatches = useCallback(() => setMatches(null), []);

  const toggleFamily = useCallback((family: GeometryFamily) => {
    setHiddenFamilies(prev => (prev.includes(family) ? prev.filter(f => f !== family) : [...prev, family]));
  }, []);

  // ---- tools ------------------------------------------------------------------------------
  const setTool = useCallback((next: ToolMode | null) => {
    setToolState(next);
    setToolPoints([]);
    setToolFinished(false);
  }, []);

  const choropleth = useMemo(
    () => (choroplethKey ? choroplethRange(analysis, choroplethKey) : null),
    [analysis, choroplethKey],
  );

  const applyChoropleth = useCallback(
    (key: string | null) => {
      if (!key) {
        setChoroplethKey(null);
        return;
      }
      const range = choroplethRange(analysis, key);
      if (!range) {
        toast.warning(`No features have a numeric "${key}" value`);
        return;
      }
      setChoroplethKey(key);
      toast.success(`Coloured ${range.count} features by ${key} (${range.min} to ${range.max})`);
    },
    [analysis],
  );

  const setTileGrid = useCallback((next: { enabled: boolean; scheme: 'xyz' | 'tms' }) => {
    setTileGridState(next);
    if (!next.enabled) setTileInfo(null);
    saveState({ tileScheme: next.scheme });
  }, []);

  const showMarker = useCallback((at: LngLat) => setMarker({ at, token: Date.now() }), []);

  // ---- view -------------------------------------------------------------------------------
  const setBasemap = useCallback((id: BasemapId) => {
    setBasemapState(id);
    saveState({ basemap: id });
  }, []);
  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);
  const setPanelWidth = useCallback((px: number) => {
    setPanelWidthState(px);
    saveState({ panelWidth: px });
  }, []);
  const requestFit = useCallback(() => setFitToken(t => t + 1), []);
  const persistView = useCallback(
    (view: { center: [number, number]; zoom: number; bearing: number; pitch: number }) => saveState({ view }),
    [],
  );

  // After edits a selection can point at a feature that no longer exists: derive it away instead of syncing state.
  const liveSelection = selection && analysis.valid[selection.idx] ? selection : null;
  const liveMatches = matches && matches.indexes.every(i => analysis.valid[i]) ? matches : null;

  const value: StudioValue = {
    text,
    textVersion,
    analysis,
    ranges,
    largeInput,
    loading,
    setTextFromEditor,
    replaceText,
    loadFiles,
    loadUrls,
    clear,
    selection: liveSelection,
    select,
    matches: liveMatches,
    highlightMatches,
    clearMatches,
    hiddenFamilies,
    toggleFamily,
    tool,
    setTool,
    toolPoints,
    setToolPoints,
    toolFinished,
    setToolFinished,
    labelProperty,
    setLabelProperty,
    choropleth,
    applyChoropleth,
    tileGrid,
    setTileGrid,
    tileInfo,
    setTileInfo,
    marker,
    showMarker,
    basemap,
    setBasemap,
    theme,
    toggleTheme,
    mapOnly,
    setMapOnly,
    panelWidth,
    setPanelWidth,
    tab,
    setTab,
    fitToken,
    requestFit,
    mapRef,
    initialView,
    persistView,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside <StudioProvider>');
  return ctx;
}
