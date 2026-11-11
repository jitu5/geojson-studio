import { useEffect, useRef, useState } from 'react';

import { ButtonIcon } from '@/components/IconButton';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { useStudio } from '@/state/studio';

const ACCEPT = '.geojson,.json,application/geo+json,application/json';

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/** Window-level drag & drop. The editor handles its own drop (merge), so drops inside it are ignored here. */
export function DropOverlay() {
  const { loadFiles } = useStudio();
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const leave = () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      depth.current = 0;
      setActive(false);
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      void loadFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [loadFiles]);

  if (!active) return null;
  return (
    <div
      aria-hidden
      className="bg-surface-base/90 border-stroke-active pointer-events-none fixed inset-2 z-50 flex flex-col items-center justify-center gap-3 border-2 border-dashed">
      <IconShell size="lg" type="neutral" variant="primary">
        <Icon icon="upload_file" />
      </IconShell>
      <p className="headings-h3-regular text-fg-primary">Drop GeoJSON files to load</p>
      <p className="paragraph-small-primary text-fg-secondary">Several files are merged into one FeatureCollection. Drop on the editor to add to the current data.</p>
    </div>
  );
}

export function FileDropTarget() {
  const { loadFiles, loading } = useStudio();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="border-stroke-secondary bg-fill-subtle flex flex-col items-center gap-2 border border-dashed p-6 text-center">
      <IconShell size="default" type="neutral" variant="secondary">
        <Icon icon="upload_file" />
      </IconShell>
      <p className="paragraph-regular-primary text-fg-primary">Drop .geojson or .json files anywhere</p>
      <p className="paragraph-small-primary text-fg-secondary">Several files are merged into one collection.</p>
      <Button variant="secondary" size="sm" className="mt-1" disabled={loading} onClick={() => input.current?.click()}>
        <ButtonIcon icon="folder_open" />
        Browse files
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="file-input"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void loadFiles(files);
        }}
      />
    </div>
  );
}
