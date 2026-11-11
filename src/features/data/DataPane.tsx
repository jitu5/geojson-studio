import { type FormEvent, useId, useState } from 'react';

import { ButtonIcon } from '@/components/IconButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { isHttpUrl } from '@/lib/geo/measure';
import { SAMPLES } from '@/lib/samples';
import { withUrlParam } from '@/lib/urlParams';
import { useStudio } from '@/state/studio';

import { FileDropTarget } from './FileDrop';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="headings-h4-semibold text-fg-primary">{title}</h2>
      {children}
    </section>
  );
}

export function DataPane() {
  const studio = useStudio();
  const urlId = useId();
  const authId = useId();
  const [url, setUrl] = useState('');
  const [auth, setAuth] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const urls = url
      .split(/[;\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const bad = urls.find(u => !isHttpUrl(u));
    if (!urls.length || bad) {
      toast.error(bad ? `Not a valid http(s) URL: ${bad}` : 'Enter a URL');
      return;
    }
    void studio.loadUrls(urls, { authorization: auth });
  };

  return (
    <div className="flex flex-col gap-8 p-4">
      <Section title="Files">
        <FileDropTarget />
      </Section>

      <Section title="From URL">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldSet className="gap-2">
            <FieldLabel htmlFor={urlId} size="sm">
              GeoJSON URL
            </FieldLabel>
            <div className="flex gap-2">
              <Input
                id={urlId}
                size="sm"
                type="text"
                inputMode="url"
                placeholder="https://example.com/data.geojson"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={studio.loading}>
                {studio.loading ? 'Loading' : 'Load'}
              </Button>
            </div>
            <FieldDescription size="sm" className="text-fg-secondary">
              Separate several URLs with ";" to merge them. The server must allow cross-origin requests.
            </FieldDescription>
          </FieldSet>
          <FieldSet className="gap-2">
            <FieldLabel htmlFor={authId} size="sm">
              Authorization header (optional)
            </FieldLabel>
            <Input
              id={authId}
              size="sm"
              type="password"
              autoComplete="off"
              placeholder="Bearer …"
              value={auth}
              onChange={e => setAuth(e.target.value)}
            />
            <FieldDescription size="sm" className="text-fg-secondary">
              Sent only with this request. Not saved.
            </FieldDescription>
          </FieldSet>
        </form>
      </Section>

      <Section title="Samples">
        <ul className="border-stroke-divider divide-stroke-divider flex flex-col divide-y border-y">
          {SAMPLES.map(sample => (
            <li key={sample.id} className="flex items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="label-regular-primary text-fg-primary">{sample.name}</span>
                  <Badge size="sm" variant="alternative">
                    {sample.geometry}
                  </Badge>
                </div>
                <span className="paragraph-small-primary text-fg-secondary">{sample.description}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Load sample: ${sample.name}`}
                onClick={() => {
                  const fc = sample.build();
                  studio.replaceText(JSON.stringify(fc, null, 2), { fit: true });
                  studio.setTab('editor');
                  window.history.replaceState(null, '', withUrlParam(window.location.href, null));
                  toast.success(`${sample.name}: ${fc.features.length} features`);
                }}>
                <ButtonIcon icon="add" />
                Load
              </Button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
