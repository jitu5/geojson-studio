import { haversine } from './geo/measure';
import type { Feature, FeatureCollection, LngLat } from './geo/types';

/**
 * Bundled sample datasets, generated in code so the app works offline and avoids
 * CORS-hostile hosts. Figures are rounded and illustrative.
 */

export interface Sample {
  id: string;
  name: string;
  description: string;
  geometry: string;
  build: () => FeatureCollection;
}

type Capital = [name: string, country: string, continent: string, lng: number, lat: number, populationM: number];

const CAPITALS: Capital[] = [
  ['London', 'United Kingdom', 'Europe', -0.1276, 51.5072, 9.6],
  ['Paris', 'France', 'Europe', 2.3522, 48.8566, 11.3],
  ['Berlin', 'Germany', 'Europe', 13.405, 52.52, 3.9],
  ['Madrid', 'Spain', 'Europe', -3.7038, 40.4168, 6.8],
  ['Rome', 'Italy', 'Europe', 12.4964, 41.9028, 4.3],
  ['Amsterdam', 'Netherlands', 'Europe', 4.9041, 52.3676, 2.5],
  ['Stockholm', 'Sweden', 'Europe', 18.0686, 59.3293, 1.7],
  ['Warsaw', 'Poland', 'Europe', 21.0122, 52.2297, 1.8],
  ['Vienna', 'Austria', 'Europe', 16.3738, 48.2082, 2.0],
  ['Athens', 'Greece', 'Europe', 23.7275, 37.9838, 3.2],
  ['Lisbon', 'Portugal', 'Europe', -9.1393, 38.7223, 2.9],
  ['Dublin', 'Ireland', 'Europe', -6.2603, 53.3498, 1.3],
  ['Ankara', 'Türkiye', 'Asia', 32.8597, 39.9334, 5.7],
  ['Cairo', 'Egypt', 'Africa', 31.2357, 30.0444, 22.6],
  ['Nairobi', 'Kenya', 'Africa', 36.8219, -1.2921, 5.3],
  ['Abuja', 'Nigeria', 'Africa', 7.3986, 9.0765, 3.8],
  ['Pretoria', 'South Africa', 'Africa', 28.1881, -25.7479, 2.8],
  ['Accra', 'Ghana', 'Africa', -0.187, 5.6037, 2.6],
  ['Addis Ababa', 'Ethiopia', 'Africa', 38.7578, 8.9806, 5.5],
  ['Dakar', 'Senegal', 'Africa', -17.4677, 14.7167, 3.3],
  ['Riyadh', 'Saudi Arabia', 'Asia', 46.6753, 24.7136, 7.7],
  ['Abu Dhabi', 'United Arab Emirates', 'Asia', 54.3773, 24.4539, 1.5],
  ['New Delhi', 'India', 'Asia', 77.209, 28.6139, 33.0],
  ['Beijing', 'China', 'Asia', 116.4074, 39.9042, 21.8],
  ['Tokyo', 'Japan', 'Asia', 139.6503, 35.6762, 37.0],
  ['Seoul', 'South Korea', 'Asia', 126.978, 37.5665, 10.0],
  ['Bangkok', 'Thailand', 'Asia', 100.5018, 13.7563, 11.2],
  ['Singapore', 'Singapore', 'Asia', 103.8198, 1.3521, 5.9],
  ['Jakarta', 'Indonesia', 'Asia', 106.8456, -6.2088, 11.2],
  ['Canberra', 'Australia', 'Oceania', 149.13, -35.2809, 0.47],
  ['Wellington', 'New Zealand', 'Oceania', 174.7762, -41.2865, 0.42],
  ['Washington', 'United States', 'North America', -77.0369, 38.9072, 6.3],
  ['Ottawa', 'Canada', 'North America', -75.6972, 45.4215, 1.1],
  ['Mexico City', 'Mexico', 'North America', -99.1332, 19.4326, 22.3],
  ['Bogotá', 'Colombia', 'South America', -74.0721, 4.711, 11.6],
  ['Lima', 'Peru', 'South America', -77.0428, -12.0464, 11.2],
  ['Brasília', 'Brazil', 'South America', -47.8825, -15.7942, 4.8],
  ['Buenos Aires', 'Argentina', 'South America', -58.3816, -34.6037, 15.6],
  ['Santiago', 'Chile', 'South America', -70.6693, -33.4489, 6.9],
];

function capitals(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: CAPITALS.map(([name, country, continent, lng, lat, populationM], i) => ({
      type: 'Feature',
      id: i + 1,
      properties: { name, country, continent, population_m: populationM },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })),
  };
}

const CITIES: Record<string, LngLat> = {
  London: [-0.4543, 51.47],
  'New York': [-73.7781, 40.6413],
  Dubai: [55.3657, 25.2532],
  Singapore: [103.9915, 1.3644],
  Sydney: [151.1772, -33.9399],
  Frankfurt: [8.5622, 50.0379],
  Tokyo: [140.3929, 35.772],
  Paris: [2.5479, 49.0097],
  Johannesburg: [28.246, -26.1367],
  Madrid: [-3.5676, 40.4983],
  'São Paulo': [-46.4731, -23.4356],
  'Los Angeles': [-118.4085, 33.9416],
  'Mexico City': [-99.0721, 19.4361],
  Toronto: [-79.6248, 43.6777],
  Delhi: [77.1031, 28.5562],
  Nairobi: [36.9278, -1.3192],
};

const ROUTES: [string, string][] = [
  ['London', 'New York'],
  ['London', 'Dubai'],
  ['Dubai', 'Singapore'],
  ['Singapore', 'Sydney'],
  ['Frankfurt', 'Tokyo'],
  ['Paris', 'Johannesburg'],
  ['Madrid', 'São Paulo'],
  ['New York', 'Los Angeles'],
  ['Los Angeles', 'Mexico City'],
  ['Toronto', 'London'],
  ['Delhi', 'London'],
  ['Nairobi', 'Dubai'],
];

/** Points along the great circle between a and b (spherical linear interpolation). */
export function greatCircle(a: LngLat, b: LngLat, segments = 64): LngLat[] {
  const toRad = Math.PI / 180;
  const [l1, p1] = [a[0] * toRad, a[1] * toRad];
  const [l2, p2] = [b[0] * toRad, b[1] * toRad];
  const d =
    2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d === 0) return [a, b];
  const out: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);
    out.push([Number((lng / toRad).toFixed(5)), Number((lat / toRad).toFixed(5))]);
  }
  return out;
}

function routes(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ROUTES.map(([from, to], i) => {
      const a = CITIES[from];
      const b = CITIES[to];
      const km = Math.round(haversine(a, b) / 1000);
      return {
        type: 'Feature',
        id: `route-${i + 1}`,
        properties: {
          name: `${from} – ${to}`,
          from,
          to,
          distance_km: km,
          haul: km > 8000 ? 'ultra long' : km > 4000 ? 'long' : 'medium',
        },
        geometry: { type: 'LineString', coordinates: greatCircle(a, b) },
      } satisfies Feature;
    }),
  };
}

/** Deterministic pseudo-random in [0,1) so the sample is identical on every load. */
function hash01(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hexGrid(): FeatureCollection {
  const features: Feature[] = [];
  const size = 0.9; // degrees, circumradius in longitude units
  const w = Math.sqrt(3) * size;
  const h = 1.5 * size * 0.7; // squash vertically so cells look closer to regular at ~50°N
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const cx = -8 + col * w + (row % 2 ? w / 2 : 0);
      const cy = 41 + row * h;
      const ring: number[][] = [];
      for (let k = 0; k < 6; k++) {
        const angle = (Math.PI / 180) * (60 * k - 30);
        ring.push([
          Number((cx + size * Math.cos(angle)).toFixed(5)),
          Number((cy + size * 0.7 * Math.sin(angle)).toFixed(5)),
        ]);
      }
      ring.push(ring[0]);
      const base = 50 + 30 * Math.sin(col * 0.55) * Math.cos(row * 0.45);
      const score = Math.round((base + 20 * (hash01(col, row) - 0.5)) * 10) / 10;
      features.push({
        type: 'Feature',
        id: `H-${String(row).padStart(2, '0')}-${String(col).padStart(2, '0')}`,
        properties: {
          cell: `H-${String(row).padStart(2, '0')}-${String(col).padStart(2, '0')}`,
          score,
          band: score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low',
        },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function everyType(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Dam Square', kind: 'Point', 'marker-color': '#E77EC2' },
        geometry: { type: 'Point', coordinates: [4.8932, 52.3731] },
      },
      {
        type: 'Feature',
        properties: { name: 'Museum quarter', kind: 'MultiPoint' },
        geometry: {
          type: 'MultiPoint',
          coordinates: [
            [4.8852, 52.36],
            [4.8811, 52.3584],
            [4.8791, 52.3579],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'Damrak walk', kind: 'LineString', stroke: '#05D0F0', 'stroke-width': 4 },
        geometry: {
          type: 'LineString',
          coordinates: [
            [4.9003, 52.3791],
            [4.8962, 52.3762],
            [4.8932, 52.3731],
            [4.8906, 52.3676],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'Canal ring', kind: 'MultiLineString' },
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [4.8866, 52.3784],
              [4.8826, 52.3717],
              [4.8857, 52.3649],
            ],
            [
              [4.8905, 52.3796],
              [4.8848, 52.3716],
              [4.8899, 52.3627],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'Vondelpark', kind: 'Polygon with hole', fill: '#11B883', 'fill-opacity': 0.4 },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [4.8579, 52.3585],
              [4.8792, 52.3618],
              [4.8818, 52.3593],
              [4.8605, 52.3552],
              [4.8579, 52.3585],
            ],
            [
              [4.8682, 52.3587],
              [4.8712, 52.3591],
              [4.8716, 52.3582],
              [4.8686, 52.3578],
              [4.8682, 52.3587],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'Two blocks', kind: 'MultiPolygon' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [4.9035, 52.3655],
                [4.9085, 52.3655],
                [4.9085, 52.3685],
                [4.9035, 52.3685],
                [4.9035, 52.3655],
              ],
            ],
            [
              [
                [4.9105, 52.3655],
                [4.9155, 52.3655],
                [4.9155, 52.3685],
                [4.9105, 52.3685],
                [4.9105, 52.3655],
              ],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'Station and track', kind: 'GeometryCollection' },
        geometry: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Point', coordinates: [4.9001, 52.3791] },
            {
              type: 'LineString',
              coordinates: [
                [4.9001, 52.3791],
                [4.9112, 52.3805],
                [4.9245, 52.3772],
              ],
            },
          ],
        },
      },
    ],
  };
}

function brokenData(): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Valid point' },
        geometry: { type: 'Point', coordinates: [-3.1883, 55.9533] },
      },
      {
        type: 'Feature',
        properties: { name: 'Ring not closed' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-3.2, 55.94],
              [-3.17, 55.94],
              [-3.17, 55.96],
              [-3.2, 55.96],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        // San Francisco written as [lat, lng]: latitude -122 is impossible, so validation catches it.
        properties: { name: 'Swapped coordinates' },
        geometry: { type: 'Point', coordinates: [37.7749, -122.4194] },
      },
      {
        type: 'Feature',
        properties: { name: 'Line with one position' },
        geometry: { type: 'LineString', coordinates: [[-3.19, 55.95]] },
      },
      { type: 'Feature', properties: { name: 'No geometry' }, geometry: null },
      {
        type: 'Feature',
        properties: { name: 'Valid line' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-3.2, 55.95],
            [-3.18, 55.952],
            [-3.16, 55.949],
          ],
        },
      },
    ] as unknown as Feature[],
  };
}

export const SAMPLES: Sample[] = [
  {
    id: 'capitals',
    name: 'World capitals',
    description: '39 capitals with country, continent and rounded population.',
    geometry: 'Points',
    build: capitals,
  },
  {
    id: 'routes',
    name: 'Long-haul routes',
    description: '12 great-circle routes with distance and haul class.',
    geometry: 'Lines',
    build: routes,
  },
  {
    id: 'grid',
    name: 'Scored hex grid',
    description: '196 cells over Western Europe with a numeric score for the choropleth.',
    geometry: 'Polygons',
    build: hexGrid,
  },
  {
    id: 'every-type',
    name: 'Every geometry type',
    description: 'All seven geometry types in Amsterdam, some with simplestyle colours.',
    geometry: 'Mixed',
    build: everyType,
  },
  {
    id: 'broken',
    name: 'Validation check',
    description: 'Six features with common mistakes, to see how problems are reported.',
    geometry: 'Mixed',
    build: brokenData,
  },
];
