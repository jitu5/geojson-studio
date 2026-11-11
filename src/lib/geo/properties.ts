import type { Feature } from './types';

/** Read "a.b[0].c" style paths; also accepts plain keys containing dots when they exist verbatim. */
export function getNested(obj: unknown, path: string): unknown {
  if (obj === null || typeof obj !== 'object') return undefined;
  const record = obj as Record<string, unknown>;
  if (path in record) return record[path];
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Value used for labels and matching. "id" falls back to the Feature's top-level id like the reference tool. */
export function featureValue(feature: Feature, path: string): unknown {
  const fromProps = getNested(feature.properties ?? {}, path);
  if ((fromProps === undefined || fromProps === null) && path === 'id') return feature.id;
  return fromProps;
}

/** Top-level property keys across features, most frequent first. */
export function propertyKeys(features: Feature[], valid?: boolean[], limit = 5000): string[] {
  const freq = new Map<string, number>();
  const n = Math.min(features.length, limit);
  for (let i = 0; i < n; i++) {
    if (valid && !valid[i]) continue;
    const props = features[i]?.properties;
    if (!props || typeof props !== 'object') continue;
    for (const key of Object.keys(props)) freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

/** Keys whose values are finite numbers on at least one feature. */
export function numericKeys(features: Feature[], valid?: boolean[], limit = 5000): string[] {
  const keys = propertyKeys(features, valid, limit);
  const n = Math.min(features.length, limit);
  return keys.filter(key => {
    for (let i = 0; i < n; i++) {
      if (valid && !valid[i]) continue;
      const v = features[i]?.properties?.[key];
      if (typeof v === 'number' && Number.isFinite(v)) return true;
    }
    return false;
  });
}

const TITLE_KEYS = ['name', 'title', 'label', 'NAME', 'Name', 'id', 'ID'];

export function featureTitle(feature: Feature | undefined, index: number): string {
  if (!feature) return `Feature ${index + 1}`;
  for (const key of TITLE_KEYS) {
    const v = feature.properties?.[key];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return `${key} ${v}`;
  }
  if (feature.id !== undefined) return `Feature ${String(feature.id)}`;
  return `Feature ${index + 1}`;
}

/** Strict-equality match on a top-level property, like the reference tool's property-click highlight. */
export function matchingIndexes(features: Feature[], valid: boolean[], key: string, value: unknown): number[] {
  const out: number[] = [];
  const target = JSON.stringify(value);
  features.forEach((f, i) => {
    if (!valid[i]) return;
    const v = f.properties?.[key];
    if (v === value || (typeof v === 'object' && v !== null && JSON.stringify(v) === target)) out.push(i);
  });
  return out;
}

export function formatValue(value: unknown): { text: string; isCode: boolean } {
  if (value === null) return { text: 'null', isCode: true };
  if (value === undefined) return { text: '—', isCode: false };
  if (typeof value === 'string') return { text: value, isCode: false };
  if (typeof value === 'number' || typeof value === 'boolean') return { text: String(value), isCode: true };
  return { text: JSON.stringify(value), isCode: true };
}
