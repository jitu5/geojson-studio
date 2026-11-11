import { type ParseError, parse as parseLoose, printParseErrorCode } from 'jsonc-parser';

import { featuresBBox } from './bbox';
import type { BBox, Feature, Geometry, GeometryFamily, Position } from './types';

export interface Issue {
  /** Index in the source order, or null when the issue is about the document. */
  featureIndex: number | null;
  severity: 'error' | 'warning';
  message: string;
}

export interface SyntaxIssue {
  message: string;
  offset: number;
  line: number;
  column: number;
}

export interface Counts {
  point: number;
  line: number;
  polygon: number;
  total: number;
  rendered: number;
  failed: number;
}

export interface Analysis {
  status: 'empty' | 'syntax-error' | 'ok';
  syntaxError: SyntaxIssue | null;
  /** Features in source order. Invalid ones are kept so indexes line up with the editor. */
  features: Feature[];
  /** valid[i] === true when features[i] can be rendered. */
  valid: boolean[];
  issues: Issue[];
  counts: Counts;
  bbox: BBox | null;
}

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
]);

const EMPTY_COUNTS: Counts = { point: 0, line: 0, polygon: 0, total: 0, rendered: 0, failed: 0 };

export function emptyAnalysis(status: Analysis['status'] = 'empty'): Analysis {
  return {
    status,
    syntaxError: null,
    features: [],
    valid: [],
    issues: [],
    counts: { ...EMPTY_COUNTS },
    bbox: null,
  };
}

function lineAndColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastBreak = -1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: offset - lastBreak };
}

const ERROR_LABELS: Record<string, string> = {
  InvalidSymbol: 'Unexpected character',
  InvalidNumberFormat: 'Invalid number',
  PropertyNameExpected: 'Property name expected',
  ValueExpected: 'Value expected',
  ColonExpected: 'Colon expected',
  CommaExpected: 'Comma expected',
  CloseBraceExpected: 'Closing brace expected',
  CloseBracketExpected: 'Closing bracket expected',
  EndOfFileExpected: 'Unexpected content after the JSON value',
  InvalidCommentToken: 'Comments are not allowed in JSON',
  UnexpectedEndOfComment: 'Unexpected end of comment',
  UnexpectedEndOfString: 'Unterminated string',
  UnexpectedEndOfNumber: 'Unexpected end of number',
  InvalidUnicode: 'Invalid unicode escape',
  InvalidEscapeCharacter: 'Invalid escape character',
  InvalidCharacter: 'Invalid character',
};

/** Parse strict JSON. Returns the value, or the first syntax error with its position. */
export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: SyntaxIssue } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (nativeError) {
    const errors: ParseError[] = [];
    parseLoose(text, errors, { allowTrailingComma: false, disallowComments: true });
    const first = errors[0];
    const offset = first ? first.offset : 0;
    const { line, column } = lineAndColumn(text, offset);
    const label = first
      ? (ERROR_LABELS[printParseErrorCode(first.error)] ?? printParseErrorCode(first.error))
      : nativeError instanceof Error
        ? nativeError.message
        : 'Invalid JSON';
    return { ok: false, error: { message: label, offset, line, column } };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positionProblem(value: unknown): { severity: Issue['severity']; message: string } | null {
  if (!Array.isArray(value) || value.length < 2) {
    return { severity: 'error', message: 'Position must be an array of at least two numbers' };
  }
  for (const n of value) {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      return { severity: 'error', message: 'Position values must be finite numbers' };
    }
  }
  const [lng, lat] = value as number[];
  if (lat < -90 || lat > 90) {
    return { severity: 'error', message: `Latitude ${lat} is outside -90..90 (are longitude and latitude swapped?)` };
  }
  if (lng < -540 || lng > 540) {
    return { severity: 'error', message: `Longitude ${lng} is outside the valid range` };
  }
  if (lng < -180 || lng > 180) {
    return { severity: 'warning', message: `Longitude ${lng} is outside -180..180` };
  }
  return null;
}

type Problem = { severity: Issue['severity']; message: string };

function checkPositions(list: unknown, min: number, what: string, out: Problem[]): void {
  if (!Array.isArray(list)) {
    out.push({ severity: 'error', message: `${what} coordinates must be an array` });
    return;
  }
  if (list.length < min) {
    out.push({ severity: 'error', message: `${what} must have at least ${min} positions` });
  }
  for (const p of list) {
    const problem = positionProblem(p);
    if (problem) {
      out.push(problem);
      if (problem.severity === 'error') return;
    }
  }
}

function checkRing(ring: unknown, out: Problem[]): void {
  checkPositions(ring, 4, 'Polygon ring', out);
  if (Array.isArray(ring) && ring.length >= 4) {
    const first = ring[0] as Position;
    const last = ring[ring.length - 1] as Position;
    if (Array.isArray(first) && Array.isArray(last) && (first[0] !== last[0] || first[1] !== last[1])) {
      out.push({ severity: 'error', message: 'Polygon ring is not closed (first and last positions differ)' });
    }
  }
}

/** Validate a geometry object. Returns every problem found (errors and warnings). */
export function geometryProblems(geometry: unknown, depth = 0): Problem[] {
  const out: Problem[] = [];
  if (!isRecord(geometry)) {
    out.push({ severity: 'error', message: 'Geometry must be an object' });
    return out;
  }
  const type = geometry.type;
  if (typeof type !== 'string' || !GEOMETRY_TYPES.has(type)) {
    out.push({ severity: 'error', message: `Unknown geometry type "${String(type)}"` });
    return out;
  }
  const c = geometry.coordinates;
  switch (type) {
    case 'Point': {
      const problem = positionProblem(c);
      if (problem) out.push(problem);
      break;
    }
    case 'MultiPoint':
      checkPositions(c, 1, 'MultiPoint', out);
      break;
    case 'LineString':
      checkPositions(c, 2, 'LineString', out);
      break;
    case 'MultiLineString':
      if (!Array.isArray(c)) out.push({ severity: 'error', message: 'MultiLineString coordinates must be an array' });
      else c.forEach(line => checkPositions(line, 2, 'MultiLineString part', out));
      break;
    case 'Polygon':
      if (!Array.isArray(c) || c.length === 0) out.push({ severity: 'error', message: 'Polygon must have at least one ring' });
      else c.forEach(ring => checkRing(ring, out));
      break;
    case 'MultiPolygon':
      if (!Array.isArray(c) || c.length === 0) {
        out.push({ severity: 'error', message: 'MultiPolygon must have at least one polygon' });
      } else {
        c.forEach(poly => {
          if (!Array.isArray(poly) || poly.length === 0) {
            out.push({ severity: 'error', message: 'MultiPolygon part must have at least one ring' });
          } else {
            poly.forEach(ring => checkRing(ring, out));
          }
        });
      }
      break;
    case 'GeometryCollection': {
      const geometries = geometry.geometries;
      if (!Array.isArray(geometries)) {
        out.push({ severity: 'error', message: 'GeometryCollection must have a "geometries" array' });
      } else if (depth > 4) {
        out.push({ severity: 'error', message: 'GeometryCollection nesting is too deep' });
      } else {
        geometries.forEach(g => out.push(...geometryProblems(g, depth + 1)));
      }
      break;
    }
  }
  return out;
}

/** Families present in a geometry (GeometryCollections can mix). */
export function geometryFamilies(geometry: Geometry | null, into = new Set<GeometryFamily>()): Set<GeometryFamily> {
  if (!geometry) return into;
  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      into.add('point');
      break;
    case 'LineString':
    case 'MultiLineString':
      into.add('line');
      break;
    case 'Polygon':
    case 'MultiPolygon':
      into.add('polygon');
      break;
    case 'GeometryCollection':
      geometry.geometries.forEach(g => geometryFamilies(g, into));
      break;
  }
  return into;
}

interface Collected {
  features: Feature[];
  issues: Issue[];
}

function collect(value: unknown, acc: Collected, depth = 0): void {
  if (Array.isArray(value)) {
    if (depth > 0) {
      acc.issues.push({ featureIndex: null, severity: 'error', message: 'Nested arrays are not GeoJSON' });
      return;
    }
    value.forEach(v => collect(v, acc, depth + 1));
    return;
  }
  if (!isRecord(value)) {
    acc.issues.push({ featureIndex: null, severity: 'error', message: 'Expected a GeoJSON object' });
    return;
  }
  if (value.type === 'FeatureCollection') {
    if (!Array.isArray(value.features)) {
      acc.issues.push({ featureIndex: null, severity: 'error', message: 'FeatureCollection must have a "features" array' });
      return;
    }
    value.features.forEach(f => acc.features.push(f as Feature));
    return;
  }
  if (value.type === 'Feature') {
    acc.features.push(value as unknown as Feature);
    return;
  }
  if (typeof value.type === 'string' && GEOMETRY_TYPES.has(value.type)) {
    acc.features.push({ type: 'Feature', properties: {}, geometry: value as unknown as Geometry });
    return;
  }
  // Unknown object: keep its slot so editor indexes stay aligned, but it cannot render.
  acc.features.push(value as unknown as Feature);
}

/** Turn any parsed JSON value into validated features. Pure; safe to unit test. */
export function normalize(value: unknown): Omit<Analysis, 'status' | 'syntaxError'> {
  const acc: Collected = { features: [], issues: [] };
  collect(value, acc);
  const valid: boolean[] = [];
  const counts: Counts = { ...EMPTY_COUNTS, total: acc.features.length };

  acc.features.forEach((feature, index) => {
    const problems: Problem[] = [];
    if (!isRecord(feature) || feature.type !== 'Feature') {
      problems.push({ severity: 'error', message: 'Not a GeoJSON Feature' });
    } else {
      if (feature.properties !== null && feature.properties !== undefined && !isRecord(feature.properties)) {
        problems.push({ severity: 'error', message: '"properties" must be an object or null' });
      }
      if (feature.geometry === null || feature.geometry === undefined) {
        problems.push({ severity: 'warning', message: 'Feature has no geometry and is not drawn' });
      } else {
        problems.push(...geometryProblems(feature.geometry));
      }
    }
    const hasError = problems.some(p => p.severity === 'error');
    const drawable = !hasError && isRecord(feature) && isRecord(feature.geometry);
    valid.push(drawable);
    if (drawable) {
      counts.rendered++;
      const families = geometryFamilies(feature.geometry);
      if (families.has('point')) counts.point++;
      if (families.has('line')) counts.line++;
      if (families.has('polygon')) counts.polygon++;
    } else if (hasError) {
      counts.failed++;
    }
    // One message per feature keeps the alert readable; first error wins over warnings.
    const headline = problems.find(p => p.severity === 'error') ?? problems[0];
    if (headline) acc.issues.push({ featureIndex: index, ...headline });
  });

  const bbox = featuresBBox(acc.features.filter((_, i) => valid[i]));
  return { features: acc.features, valid, issues: acc.issues, counts, bbox };
}

/** Full pipeline: text -> syntax check -> normalize + validate. */
export function analyse(text: string): Analysis {
  if (text.trim() === '') return emptyAnalysis('empty');
  const parsed = parseJson(text);
  if (!parsed.ok) {
    const result = emptyAnalysis('syntax-error');
    result.syntaxError = parsed.error;
    return result;
  }
  return { status: 'ok', syntaxError: null, ...normalize(parsed.value) };
}
