import type { Diagnostic } from '@codemirror/lint';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ButtonIcon } from '@/components/IconButton';
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { toast } from '@/components/ui/sonner';
import { featureAtOffset } from '@/lib/geo/locate';
import { parseLngLat } from '@/lib/geo/measure';
import { useStudio } from '@/state/studio';

import { type EditorHandle, GeoJsonEditor } from './GeoJsonEditor';

const ISSUE_PREVIEW = 4;

function download(text: string) {
  const blob = new Blob([text], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.geojson';
  a.click();
  URL.revokeObjectURL(url);
}

export function EditorPane() {
  const studio = useStudio();
  const { analysis, ranges, selection, text, largeInput } = studio;
  const editorRef = useRef<EditorHandle>(null);
  const [showAll, setShowAll] = useState(false);
  const lastCursorIdx = useRef<number>(-1);

  const diagnostics = useMemo<Diagnostic[]>(() => {
    if (analysis.syntaxError) {
      const at = analysis.syntaxError.offset;
      return [{ from: at, to: at + 1, severity: 'error', message: analysis.syntaxError.message }];
    }
    return analysis.issues
      .filter(i => i.featureIndex !== null && ranges[i.featureIndex])
      .map(i => {
        const r = ranges[i.featureIndex as number];
        return { from: r.from, to: r.from + 1, severity: i.severity, message: i.message };
      });
  }, [analysis, ranges]);

  // Map / inspector selection -> select that feature's text.
  useEffect(() => {
    if (!selection || selection.origin === 'editor') return;
    const r = ranges[selection.idx];
    if (r) editorRef.current?.selectRange(r.from, r.to);
    lastCursorIdx.current = selection.idx;
  }, [selection, ranges]);

  const onCursor = (offset: number, selected: string) => {
    const at = selected.length < 64 ? parseLngLat(selected) : null;
    if (at) {
      studio.mapRef.current?.flyTo(at, 15);
      studio.showMarker(at);
      return;
    }
    const idx = featureAtOffset(ranges, offset);
    if (idx >= 0 && analysis.valid[idx]) {
      if (idx !== lastCursorIdx.current) {
        const r = ranges[idx];
        editorRef.current?.flash(r.from, r.to);
      }
      lastCursorIdx.current = idx;
      studio.select({ idx, origin: 'editor' });
    }
  };

  const format = () => {
    try {
      studio.replaceText(JSON.stringify(JSON.parse(text), null, 2), { fit: false });
    } catch {
      toast.error('Fix the JSON error before formatting');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('GeoJSON copied');
    } catch {
      toast.error('Clipboard is not available in this browser');
    }
  };

  const { counts, status, syntaxError, issues } = analysis;
  const featureIssues = issues.filter(i => i.featureIndex !== null);
  const docIssue = issues.find(i => i.featureIndex === null);
  const shown = showAll ? featureIssues : featureIssues.slice(0, ISSUE_PREVIEW);
  const errorCount = featureIssues.filter(i => i.severity === 'error').length;

  let statusNode;
  if (status === 'empty') {
    statusNode = (
      <>
        <StatusBadge variant="neutral" size="sm" />
        <span>Empty</span>
      </>
    );
  } else if (syntaxError) {
    statusNode = (
      <>
        <StatusBadge variant="error" size="sm" />
        <span className="text-error">JSON error, line {syntaxError.line}</span>
      </>
    );
  } else {
    statusNode = (
      <>
        <StatusBadge variant={errorCount ? 'warning' : 'success'} size="sm" />
        <span className={errorCount ? 'text-warning' : 'text-success'} title={`${counts.rendered.toLocaleString()} drawn`}>
          {errorCount ? `${errorCount} invalid` : `${counts.rendered.toLocaleString()} valid`}
        </span>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-stroke-divider flex h-12 shrink-0 items-center gap-1 border-b px-2">
        <Button variant="ghost" size="sm" onClick={format} disabled={status !== 'ok' || largeInput}>
          <ButtonIcon icon="format_align_left" />
          Format
        </Button>
        <Button variant="ghost" size="sm" onClick={copy} disabled={!text}>
          <ButtonIcon icon="content_copy" />
          Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={() => download(text)} disabled={!text}>
          <ButtonIcon icon="download" />
          Download
        </Button>
        <Button variant="ghost" size="sm" onClick={studio.clear} disabled={!text}>
          <ButtonIcon icon="delete" />
          Clear
        </Button>
        <div className="label-small-primary text-fg-secondary ml-auto flex shrink-0 items-center gap-2 pr-2 whitespace-nowrap" role="status" aria-live="polite">
          {statusNode}
        </div>
      </div>

      {docIssue || featureIssues.length ? (
        <Alert layout="long" className="border-stroke-divider max-h-56 shrink-0 overflow-y-auto rounded-none border-b shadow-none">
          <AlertIcon className={errorCount || docIssue ? 'text-status-error' : 'text-status-warning'}>
            <Icon icon={errorCount || docIssue ? 'error' : 'warning'} />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>
              {docIssue
                ? docIssue.message
                : errorCount
                  ? `${errorCount} feature${errorCount === 1 ? '' : 's'} could not be drawn`
                  : `${featureIssues.length} warning${featureIssues.length === 1 ? '' : 's'}`}
            </AlertTitle>
            {featureIssues.length ? (
              <div className="-mt-2">
                <AlertDescription className="sr-only">Select an item to jump to that feature in the editor.</AlertDescription>
                <ul className="flex flex-col gap-0.5">
                  {shown.map(issue => (
                    <li key={`${issue.featureIndex}-${issue.message}`}>
                      <button
                        type="button"
                        className="paragraph-small-primary text-fg-secondary hover:text-fg-primary focus-visible:ring-stroke-status-focus cursor-pointer text-left outline-none focus-visible:ring-1"
                        onClick={() => {
                          const r = ranges[issue.featureIndex as number];
                          if (r) {
                            editorRef.current?.selectRange(r.from, r.to);
                            editorRef.current?.focus();
                          }
                        }}>
                        Feature {(issue.featureIndex as number) + 1}: {issue.message}
                      </button>
                    </li>
                  ))}
                </ul>
                {featureIssues.length > ISSUE_PREVIEW ? (
                  <Button variant="ghost" size="xs" className="mt-1 -ml-1" onClick={() => setShowAll(v => !v)}>
                    {showAll ? 'Show fewer' : `Show all ${featureIssues.length}`}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </AlertContent>
        </Alert>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {largeInput ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <IconShell size="default" type="neutral" variant="secondary">
              <Icon icon="description" />
            </IconShell>
            <p className="headings-h4-regular text-fg-primary">Too large to edit here</p>
            <p className="paragraph-small-primary text-fg-secondary max-w-xs">
              {(text.length / 1024 / 1024).toFixed(1)} MB is above the 10 MB editor limit. The map shows every feature; use Download or Copy to get the data.
            </p>
          </div>
        ) : (
          <GeoJsonEditor
            ref={editorRef}
            value={text}
            version={studio.textVersion}
            diagnostics={diagnostics}
            onChange={studio.setTextFromEditor}
            onCursor={onCursor}
            onDropFiles={files => void studio.loadFiles(files, { merge: true })}
          />
        )}
        {status === 'empty' && !largeInput ? (
          <p className="paragraph-small-primary text-fg-tertiary pointer-events-none absolute top-3 left-14">
            Paste GeoJSON here, or drop a file
          </p>
        ) : null}
      </div>
    </div>
  );
}
