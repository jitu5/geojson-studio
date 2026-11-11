import { mergeDocuments } from './geo/locate';

/** Above this size the editor is read-only and only the map renders the data. */
export const EDITOR_LIMIT_BYTES = 10 * 1024 * 1024;

export interface LoadResult {
  text: string;
  sources: string[];
  failures: { source: string; reason: string }[];
}

export class LoadError extends Error {}

function toText(values: unknown[], rawSingle: string | null): string {
  if (values.length === 1) {
    // Keep huge single inputs as-is: pretty-printing would double their size.
    if (rawSingle !== null && rawSingle.length > EDITOR_LIMIT_BYTES) return rawSingle;
    return JSON.stringify(values[0], null, 2);
  }
  return JSON.stringify(mergeDocuments(values), null, 2);
}

function finish(values: unknown[], raws: string[], sources: string[], failures: LoadResult['failures']): LoadResult {
  if (values.length === 0) {
    const reason = failures[0]?.reason ?? 'Nothing to load';
    throw new LoadError(failures.length > 1 ? `${failures.length} inputs failed. ${reason}` : reason);
  }
  return { text: toText(values, raws.length === 1 ? raws[0] : null), sources, failures };
}

export async function readFiles(files: File[]): Promise<LoadResult> {
  const values: unknown[] = [];
  const raws: string[] = [];
  const sources: string[] = [];
  const failures: LoadResult['failures'] = [];
  for (const file of files) {
    try {
      const raw = await file.text();
      values.push(JSON.parse(raw));
      raws.push(raw);
      sources.push(file.name);
    } catch {
      failures.push({ source: file.name, reason: `${file.name} is not valid JSON` });
    }
  }
  return finish(values, raws, sources, failures);
}

export async function fetchUrls(urls: string[], authorization?: string): Promise<LoadResult> {
  const values: unknown[] = [];
  const raws: string[] = [];
  const sources: string[] = [];
  const failures: LoadResult['failures'] = [];
  const headers: Record<string, string> = { Accept: 'application/geo+json, application/json;q=0.9, */*;q=0.1' };
  if (authorization?.trim()) headers.Authorization = authorization.trim();

  const results = await Promise.allSettled(
    urls.map(async url => {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new LoadError(`HTTP ${response.status} for ${url}`);
      const raw = await response.text();
      try {
        return { url, raw, value: JSON.parse(raw) as unknown };
      } catch {
        throw new LoadError(`${url} did not return valid JSON`);
      }
    }),
  );
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      values.push(r.value.value);
      raws.push(r.value.raw);
      sources.push(r.value.url);
    } else {
      const reason =
        r.reason instanceof LoadError
          ? r.reason.message
          : `Could not reach ${urls[i]} (network error or the server does not allow cross-origin requests)`;
      failures.push({ source: urls[i], reason });
    }
  });
  return finish(values, raws, sources, failures);
}
