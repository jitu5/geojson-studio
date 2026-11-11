/** Minimal GeoJSON (RFC 7946) types — kept local so the data layer has no runtime deps. */

export type Position = number[];

export type GeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'
  | 'GeometryCollection';

export interface Point {
  type: 'Point';
  coordinates: Position;
}
export interface MultiPoint {
  type: 'MultiPoint';
  coordinates: Position[];
}
export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}
export interface MultiLineString {
  type: 'MultiLineString';
  coordinates: Position[][];
}
export interface Polygon {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}
export interface GeometryCollection {
  type: 'GeometryCollection';
  geometries: Geometry[];
}

export type Geometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon
  | GeometryCollection;

export type Properties = Record<string, unknown>;

export interface Feature {
  type: 'Feature';
  id?: string | number;
  geometry: Geometry | null;
  properties: Properties | null;
  bbox?: number[];
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

/** Rendering family used for layer split and visibility filters. */
export type GeometryFamily = 'point' | 'line' | 'polygon';

/** [west, south, east, north] */
export type BBox = [number, number, number, number];

export type LngLat = [number, number];
