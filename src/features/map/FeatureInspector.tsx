import type { KeyboardEvent, ReactNode } from 'react';

import { ButtonIcon, IconButton } from '@/components/IconButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { formatCoord } from '@/lib/geo/measure';
import { featureTitle, formatValue } from '@/lib/geo/properties';
import { tileBounds, tileToQuadkey, tmsY } from '@/lib/geo/tiles';
import { cn } from '@/lib/utils';
import { useStudio } from '@/state/studio';

const ROW = 'h-auto py-1.5';

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Clipboard is not available in this browser');
  }
}

function Shell({ title, badge, onClose, children, footer }: { title: string; badge: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card
      size="sm"
      className="shadow-elevation-1 absolute top-[72px] left-4 z-10 flex max-h-[calc(100%-140px)] w-[360px] max-w-[calc(100%-6rem)] flex-col [--card-inset:--spacing(4)]"
      role="region"
      aria-label="Inspector">
      <CardHeader className="gap-2 py-3">
        <CardTitle className="headings-h4-semibold min-w-0 truncate" title={title}>
          {title}
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          <Badge size="sm" variant="alternative">
            {badge}
          </Badge>
          <IconButton icon="close" label="Close inspector" size="icon-xs" onClick={onClose} />
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-0">
        <ScrollArea className="h-full max-h-[min(420px,50vh)]">{children}</ScrollArea>
      </CardContent>
      {footer ? (
        <CardFooter className="border-stroke-divider flex-wrap items-center justify-start gap-1 border-t px-2 py-2">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

export function FeatureInspector() {
  const studio = useStudio();
  const { selection, analysis, tileInfo, matches, tileGrid } = studio;

  if (tileInfo && !selection) {
    const [w, s, e, n] = tileBounds(tileInfo);
    const rows: [string, string][] = [
      ['Zoom', String(tileInfo.z)],
      ['X', String(tileInfo.x)],
      ['Y (XYZ)', String(tileInfo.y)],
      ['Y (TMS)', String(tmsY(tileInfo))],
      ['Quadkey', tileToQuadkey(tileInfo) || '(root)'],
      ['West', formatCoord(w)],
      ['South', formatCoord(s)],
      ['East', formatCoord(e)],
      ['North', formatCoord(n)],
    ];
    const id = tileGrid.scheme === 'tms' ? `${tileInfo.z}/${tileInfo.x}/${tmsY(tileInfo)}` : `${tileInfo.z}/${tileInfo.x}/${tileInfo.y}`;
    return (
      <Shell
        title={`Tile ${id}`}
        badge={tileGrid.scheme.toUpperCase()}
        onClose={() => studio.setTileInfo(null)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => copy(id, 'Tile id')}>
              <ButtonIcon icon="content_copy" />
              Copy id
            </Button>
            <Button variant="ghost" size="sm" onClick={() => copy(`${formatCoord(w)},${formatCoord(s)},${formatCoord(e)},${formatCoord(n)}`, 'Bounds')}>
              <ButtonIcon icon="crop_free" />
              Copy bounds
            </Button>
          </>
        }>
        <Table>
          <TableBody>
            {rows.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell size="sm" className={cn(ROW, 'label-small-primary text-fg-secondary w-28')}>
                  {k}
                </TableCell>
                <TableCell size="sm" className={cn(ROW, 'paragraph-code-text')}>
                  {v}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Shell>
    );
  }

  if (!selection) return null;
  const feature = analysis.features[selection.idx];
  if (!feature || !analysis.valid[selection.idx]) return null;
  const props = Object.entries(feature.properties ?? {});
  const title = featureTitle(feature, selection.idx);

  const onRowKey = (e: KeyboardEvent, key: string, value: unknown) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      studio.highlightMatches(key, value);
    }
  };

  return (
    <Shell
      title={title}
      badge={feature.geometry?.type ?? 'No geometry'}
      onClose={() => {
        studio.select(null);
        studio.clearMatches();
      }}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => studio.select({ idx: selection.idx, origin: 'inspector' })}>
            <ButtonIcon icon="center_focus_strong" />
            Zoom to
          </Button>
          <Button variant="ghost" size="sm" onClick={() => copy(JSON.stringify(feature, null, 2), 'Feature JSON')}>
            <ButtonIcon icon="content_copy" />
            Copy JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              studio.setMapOnly(false);
              studio.setTab('editor');
              studio.select({ idx: selection.idx, origin: 'inspector' });
            }}>
            <ButtonIcon icon="data_object" />
            Show in editor
          </Button>
        </>
      }>
      {matches ? (
        <div className="border-stroke-divider flex items-center gap-2 border-b px-3 py-2">
          <span className="label-small-primary text-fg-secondary min-w-0 flex-1 truncate">
            {matches.indexes.length} matching {matches.key} = {formatValue(matches.value).text}
          </span>
          <Button variant="ghost" size="xs" onClick={studio.clearMatches}>
            Clear
          </Button>
        </div>
      ) : null}
      {props.length === 0 ? (
        <p className="paragraph-small-primary text-fg-secondary px-3 py-4">This feature has no properties.</p>
      ) : (
        <Table>
          <TableBody>
            {feature.id !== undefined ? (
              <TableRow>
                <TableCell size="sm" className={cn(ROW, 'label-small-primary text-fg-secondary w-32 align-top')}>
                  id
                </TableCell>
                <TableCell size="sm" className={cn(ROW, 'paragraph-code-text whitespace-normal break-all')}>
                  {String(feature.id)}
                </TableCell>
              </TableRow>
            ) : null}
            {props.map(([key, value]) => {
              const shown = formatValue(value);
              const active = matches?.key === key && JSON.stringify(matches.value) === JSON.stringify(value);
              return (
                <TableRow
                  key={key}
                  selected={active}
                  tabIndex={0}
                  aria-label={`Highlight features where ${key} is ${shown.text}`}
                  onClick={() => studio.highlightMatches(key, value)}
                  onKeyDown={e => onRowKey(e, key, value)}
                  className="hover:bg-stateslayer-overlay-hover focus-visible:ring-stroke-status-focus cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-inset">
                  <TableCell size="sm" className={cn(ROW, 'label-small-primary text-fg-secondary w-32 align-top whitespace-normal break-words')}>
                    {key}
                  </TableCell>
                  <TableCell
                    size="sm"
                    className={cn(ROW, 'whitespace-normal break-words', shown.isCode ? 'paragraph-code-text' : 'paragraph-small-primary')}>
                    {shown.text}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Shell>
  );
}
