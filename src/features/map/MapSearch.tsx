import { type FormEvent, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { toast } from '@/components/ui/sonner';
import { isHttpUrl, parseLngLat } from '@/lib/geo/measure';
import { useStudio } from '@/state/studio';

/** input-group.json#InputGroupLeadingIcon + #InputGroupTrailing. Accepts "lng, lat" or an http(s) GeoJSON URL. */
export function MapSearch() {
  const { mapRef, showMarker, loadUrls } = useStudio();
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = value.trim();
    if (!input) return;
    const at = parseLngLat(input);
    if (at) {
      mapRef.current?.flyTo(at, 14);
      showMarker(at);
      return;
    }
    if (isHttpUrl(input)) {
      void loadUrls([input]);
      return;
    }
    toast.error('Enter "lng, lat" (e.g. 4.9, 52.37) or a GeoJSON URL');
  };

  return (
    <form onSubmit={submit} className="bg-surface-primary shadow-elevation-1 absolute top-4 left-4 z-10 w-[360px] max-w-[calc(100%-6rem)]" role="search">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <IconShell size="sm" type="neutral" variant="secondary" aria-hidden>
            <Icon icon="search" />
          </IconShell>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Go to coordinates or load a GeoJSON URL"
          placeholder="lng, lat or GeoJSON URL"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" size="icon-xs" variant="ghost" aria-label="Go">
            <IconShell size="sm" type="neutral" hoverable aria-hidden>
              <Icon icon="arrow_forward" />
            </IconShell>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
