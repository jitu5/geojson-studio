import { SEQUENTIAL } from '@/lib/palette';

const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/** 9-step QBDS sequential scale (DESIGN.md § Chart colours). Chart hex is the documented exception to token-only colour. */
export function ChoroplethLegend({ property, min, max, count }: { property: string; min: number; max: number; count: number }) {
  return (
    <div className="flex flex-col gap-1" role="img" aria-label={`Colour scale for ${property} from ${fmt(min)} to ${fmt(max)}`}>
      <div className="flex h-2">
        {SEQUENTIAL.map(c => (
          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="label-small-primary text-fg-secondary flex justify-between tabular-nums">
        <span>{fmt(min)}</span>
        <span>
          {property} · {count} features
        </span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
