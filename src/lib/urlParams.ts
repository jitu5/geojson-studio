/** Deep-link parameters, compatible with the reference tool's links. */

export interface StartupParams {
  urls: string[];
  /** True when URLs came from #url= (sample links) — those should not be pushed back into ?url=. */
  fromHash: boolean;
  mapOnly: boolean;
  view: { center: [number, number]; zoom: number } | null;
}

export function readStartupParams(href: string): StartupParams {
  const url = new URL(href);
  let raw = url.searchParams.get('url');
  let fromHash = false;
  const hash = url.hash;
  if (hash.includes('url=')) {
    let fromHashValue = hash.slice(hash.indexOf('url=') + 4);
    // Only strip an "&" that starts another hash parameter, not one inside the remote URL's query.
    const next = fromHashValue.search(/&(?:maponly|map)=/);
    if (next >= 0) fromHashValue = fromHashValue.slice(0, next);
    raw = fromHashValue;
    fromHash = true;
  }
  let urls: string[] = [];
  if (raw) {
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      // keep raw
    }
    urls = decoded
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);
  }

  let view: StartupParams['view'] = null;
  const map = url.searchParams.get('map');
  if (map) {
    const [lng, lat, zoom] = map.split(',').map(Number);
    if ([lng, lat, zoom].every(Number.isFinite) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      view = { center: [lng, lat], zoom };
    }
  }

  return { urls, fromHash, mapOnly: url.searchParams.get('maponly') === 'true', view };
}

export function withUrlParam(href: string, urls: string[] | null): string {
  const url = new URL(href);
  if (urls && urls.length) url.searchParams.set('url', urls.join(';'));
  else url.searchParams.delete('url');
  if (url.hash.includes('url=')) url.hash = '';
  return url.toString();
}
