import { useId, useMemo, useState } from 'react';

import { ButtonIcon } from '@/components/IconButton';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLabel, FieldSet } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { IconShell } from '@/components/ui/icon-shell';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toolResult } from '@/lib/geo/draw';
import { appendFeatures } from '@/lib/geo/locate';
import { numericKeys, propertyKeys } from '@/lib/geo/properties';
import { type ToolMode, useStudio } from '@/state/studio';

import { ChoroplethLegend } from './ChoroplethLegend';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="headings-h4-semibold text-fg-primary">{title}</h2>
        <p className="paragraph-small-primary text-fg-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** select.json#SelectDemo option with check indicator. */
function Option({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <SelectItem value={value}>
      <SelectItemText>{children}</SelectItemText>
      <SelectItemIndicator>
        <IconShell size="sm" variant="primary">
          <Icon icon="done" size="sm" />
        </IconShell>
      </SelectItemIndicator>
    </SelectItem>
  );
}

function PropertySelect({
  id,
  keys,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  keys: string[];
  value: string | null;
  onChange: (key: string | null) => void;
  placeholder: string;
}) {
  const items = keys.map(k => ({ label: k, value: k }));
  return (
    <Select items={items} value={value} onValueChange={v => onChange((v as string | null) ?? null)} size="sm" disabled={!keys.length}>
      <SelectTrigger id={id} className="min-w-0 flex-1">
        <SelectValue placeholder={keys.length ? placeholder : 'No properties in the data'} />
      </SelectTrigger>
      <SelectContent>
        {keys.map(k => (
          <Option key={k} value={k}>
            {k}
          </Option>
        ))}
      </SelectContent>
    </Select>
  );
}

const TOOLS: { id: ToolMode; label: string; icon: string }[] = [
  { id: 'pick', label: 'Point', icon: 'my_location' },
  { id: 'measure', label: 'Measure', icon: 'straighten' },
  { id: 'bbox', label: 'Bounding box', icon: 'crop_free' },
];

export function ToolsPane() {
  const studio = useStudio();
  const { analysis, tool, toolPoints, toolFinished } = studio;
  const labelId = useId();
  const choroId = useId();
  const gridId = useId();

  const keys = useMemo(() => propertyKeys(analysis.features, analysis.valid), [analysis]);
  const numeric = useMemo(() => numericKeys(analysis.features, analysis.valid), [analysis]);
  const [labelPick, setLabelPick] = useState<string | null>(null);
  const [choroPick, setChoroPick] = useState<string | null>(null);

  const result = tool ? toolResult(tool, toolPoints, toolFinished) : null;

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.copyText);
      toast.success('Copied');
    } catch {
      toast.error('Clipboard is not available in this browser');
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4">
      <Section title="Coordinates" description="Read a point, measure a path, or draw a bounding box on the map.">
        <ToggleGroup
          aria-label="Coordinate tool"
          size="sm"
          value={tool ? [tool] : []}
          onValueChange={v => studio.setTool((v[0] as ToolMode | undefined) ?? null)}>
          {TOOLS.map(t => (
            <ToggleGroupItem key={t.id} value={t.id} aria-label={t.label}>
              <IconShell size="sm" type="neutral" variant="primary">
                <Icon icon={t.icon} />
              </IconShell>
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {tool && !result ? (
          <p className="paragraph-small-primary text-fg-tertiary">
            {tool === 'pick' ? 'Click the map.' : tool === 'measure' ? 'Click the map to add the first point.' : 'Click the first corner on the map.'}
          </p>
        ) : null}
        {result ? (
          <div className="bg-fill-subtle flex flex-col gap-3 p-3" aria-live="polite">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {result.rows.map(r => (
                <div key={r.label} className="contents">
                  <dt className="label-small-primary text-fg-secondary">{r.label}</dt>
                  <dd className="paragraph-code-text text-fg-primary text-right tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={copyResult}>
                <ButtonIcon icon="content_copy" />
                Copy
              </Button>
              {result.feature ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!result.feature) return;
                    studio.replaceText(appendFeatures(studio.text, [result.feature]), { fit: false });
                    studio.setTool(null);
                    toast.success('Added to data');
                  }}>
                  <ButtonIcon icon="add_location_alt" />
                  Add to data
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Labels" description="Show a property value next to every feature.">
        <FieldSet className="gap-2">
          <FieldLabel htmlFor={labelId} size="sm">
            Property
          </FieldLabel>
          <div className="flex gap-2">
            <PropertySelect id={labelId} keys={keys} value={labelPick} onChange={setLabelPick} placeholder="Choose a property" />
            <Button size="sm" disabled={!labelPick} onClick={() => studio.setLabelProperty(labelPick)}>
              Show
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!studio.labelProperty}
              onClick={() => {
                studio.setLabelProperty(null);
                setLabelPick(null);
              }}>
              Clear
            </Button>
          </div>
        </FieldSet>
      </Section>

      <Section title="Choropleth" description="Colour features by a numeric property on the QBDS sequential scale. Your data is not changed.">
        <FieldSet className="gap-2">
          <FieldLabel htmlFor={choroId} size="sm">
            Numeric property
          </FieldLabel>
          <div className="flex gap-2">
            <PropertySelect id={choroId} keys={numeric} value={choroPick} onChange={setChoroPick} placeholder="Choose a number" />
            <Button size="sm" disabled={!choroPick} onClick={() => studio.applyChoropleth(choroPick)}>
              Apply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!studio.choropleth}
              onClick={() => {
                studio.applyChoropleth(null);
                setChoroPick(null);
              }}>
              Clear
            </Button>
          </div>
        </FieldSet>
        {studio.choropleth ? <ChoroplethLegend {...studio.choropleth} /> : null}
      </Section>

      <Section title="Tile grid" description="Overlay Web Mercator tiles at the current zoom. Click a tile on the map to see its id, quadkey and bounds.">
        <div className="flex items-center gap-3">
          <Switch
            id={gridId}
            checked={studio.tileGrid.enabled}
            onCheckedChange={enabled => studio.setTileGrid({ ...studio.tileGrid, enabled })}
          />
          <Label htmlFor={gridId} className="label-regular-primary">
            Show tile grid
          </Label>
        </div>
        <FieldSet className="gap-2">
          <FieldLabel size="sm">Row numbering</FieldLabel>
          <ToggleGroup
            aria-label="Tile scheme"
            size="sm"
            value={[studio.tileGrid.scheme]}
            onValueChange={v => v[0] && studio.setTileGrid({ ...studio.tileGrid, scheme: v[0] as 'xyz' | 'tms' })}>
            <ToggleGroupItem value="xyz">XYZ (Google, OSM)</ToggleGroupItem>
            <ToggleGroupItem value="tms">TMS</ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription size="sm" className="text-fg-secondary">
            Labels show z/x/y and the Bing-style quadkey.
          </FieldDescription>
        </FieldSet>
      </Section>
    </div>
  );
}
