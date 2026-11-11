import { type Node, findNodeAtLocation, parseTree } from 'jsonc-parser';

import { parseJson } from './normalize';
import type { Feature } from './types';

export interface Range {
  from: number;
  to: number;
}

function typeOf(node: Node): string | undefined {
  const t = findNodeAtLocation(node, ['type']);
  return t && typeof t.value === 'string' ? t.value : undefined;
}

function pushCollectionOrSelf(node: Node, out: Range[]): void {
  if (node.type === 'object' && typeOf(node) === 'FeatureCollection') {
    const features = findNodeAtLocation(node, ['features']);
    if (features?.type === 'array') {
      features.children?.forEach(child => out.push({ from: child.offset, to: child.offset + child.length }));
    }
    return;
  }
  out.push({ from: node.offset, to: node.offset + node.length });
}

/**
 * Text ranges of each feature, in the same order `normalize()` produces features,
 * so feature index i <-> ranges[i]. Used for editor <-> map sync.
 */
export function featureRanges(text: string): Range[] {
  const root = parseTree(text, [], { allowTrailingComma: true, disallowComments: false });
  if (!root) return [];
  const out: Range[] = [];
  if (root.type === 'array') {
    root.children?.forEach(child => pushCollectionOrSelf(child, out));
  } else {
    pushCollectionOrSelf(root, out);
  }
  return out;
}

/** Index of the innermost-start feature containing `offset`, or -1. Ranges are sorted and disjoint. */
export function featureAtOffset(ranges: Range[], offset: number): number {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (offset < r.from) hi = mid - 1;
    else if (offset > r.to) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * Append features to whatever the editor currently holds and return pretty-printed JSON.
 * Empty or invalid text becomes a new FeatureCollection; a single Feature/Geometry is wrapped.
 */
export function appendFeatures(text: string, additions: Feature[]): string {
  let features: unknown[] = [];
  let extra: Record<string, unknown> = {};
  if (text.trim()) {
    const parsed = parseJson(text);
    if (parsed.ok) {
      const v = parsed.value as Record<string, unknown> | unknown[];
      if (Array.isArray(v)) features = v;
      else if (v && typeof v === 'object' && (v as Record<string, unknown>).type === 'FeatureCollection') {
        const { features: existing, ...rest } = v as Record<string, unknown>;
        features = Array.isArray(existing) ? existing : [];
        extra = rest;
      } else if (v && typeof v === 'object' && (v as Record<string, unknown>).type === 'Feature') {
        features = [v];
      } else if (v && typeof v === 'object') {
        features = [{ type: 'Feature', properties: {}, geometry: v }];
      }
    }
  }
  return JSON.stringify({ ...extra, type: 'FeatureCollection', features: [...features, ...additions] }, null, 2);
}

/** Merge parsed JSON documents (e.g. several dropped files) into one FeatureCollection. */
export function mergeDocuments(values: unknown[]): { type: 'FeatureCollection'; features: unknown[] } {
  const features: unknown[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(add);
      return;
    }
    if (!v || typeof v !== 'object') return;
    const obj = v as Record<string, unknown>;
    if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) features.push(...obj.features);
    else if (obj.type === 'Feature') features.push(obj);
    else features.push({ type: 'Feature', properties: {}, geometry: obj });
  };
  values.forEach(add);
  return { type: 'FeatureCollection', features };
}
