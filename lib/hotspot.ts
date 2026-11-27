import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

export type PlaceType = 'city' | 'neighborhood' | 'specific';

export interface HotspotFocus {
  latitude: number;
  longitude: number;
  zoom: number;
  snapped: boolean;
  reportCount: number;
  label?: string | null;
}

const PLACE_DEFAULTS: Record<
  PlaceType,
  { searchRadiusKm: number; cellDeg: number; zoom: number; snap: boolean }
> = {
  // Broad city ask → find densest pocket inside the city and zoom there
  city: { searchRadiusKm: 14, cellDeg: 0.01, zoom: 13, snap: true },
  // Neighborhood ask → tighter pocket inside that district
  neighborhood: { searchRadiusKm: 5, cellDeg: 0.006, zoom: 14.2, snap: true },
  // Intersection / campus building / exact pin → honor the coordinates
  specific: { searchRadiusKm: 0, cellDeg: 0, zoom: 15.6, snap: false },
};

export function normalizePlaceType(value: unknown): PlaceType {
  const raw = String(value ?? 'city').toLowerCase().trim();
  if (raw === 'neighborhood' || raw === 'district' || raw === 'area') {
    return 'neighborhood';
  }
  if (
    raw === 'specific' ||
    raw === 'intersection' ||
    raw === 'address' ||
    raw === 'poi' ||
    raw === 'exact'
  ) {
    return 'specific';
  }
  return 'city';
}

/**
 * Find the densest activity cell near a requested center.
 * Weights each report by severity so high-severity clusters win ties.
 */
export async function findActivityHotspot(
  latitude: number,
  longitude: number,
  radiusKm: number,
  cellDeg = 0.01
): Promise<{ latitude: number; longitude: number; count: number; label: string | null } | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || radiusKm <= 0) {
    return null;
  }

  await connectDB();

  const posts = await Post.find({
    location: {
      $geoWithin: {
        $centerSphere: [[longitude, latitude], radiusKm / 6378.1],
      },
    },
  })
    .select('location location_text severity_index')
    .limit(800)
    .lean()
    .exec();

  if (posts.length === 0) return null;

  type Bucket = {
    sumLat: number;
    sumLng: number;
    weight: number;
    count: number;
    labels: Map<string, number>;
  };

  const buckets = new Map<string, Bucket>();

  for (const post of posts) {
    const coords = post.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = `${Math.round(lat / cellDeg)}:${Math.round(lng / cellDeg)}`;
    const severity =
      typeof post.severity_index === 'number' && Number.isFinite(post.severity_index)
        ? post.severity_index
        : 5;
    const weight = 1 + severity / 10;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { sumLat: 0, sumLng: 0, weight: 0, count: 0, labels: new Map() };
      buckets.set(key, bucket);
    }

    bucket.sumLat += lat * weight;
    bucket.sumLng += lng * weight;
    bucket.weight += weight;
    bucket.count += 1;

    const label = post.location_text?.trim();
    if (label) {
      bucket.labels.set(label, (bucket.labels.get(label) ?? 0) + 1);
    }
  }

  let best: Bucket | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) {
      best = bucket;
    }
  }

  if (!best || best.weight <= 0) return null;

  let topLabel: string | null = null;
  let topLabelCount = 0;
  for (const [label, count] of best.labels.entries()) {
    if (count > topLabelCount) {
      topLabel = label;
      topLabelCount = count;
    }
  }

  return {
    latitude: best.sumLat / best.weight,
    longitude: best.sumLng / best.weight,
    count: best.count,
    label: topLabel,
  };
}

/** Resolve where the map should fly for a place query. */
export async function resolveMapFocus(
  latitude: number,
  longitude: number,
  placeTypeInput?: unknown
): Promise<HotspotFocus> {
  const placeType = normalizePlaceType(placeTypeInput);
  const defaults = PLACE_DEFAULTS[placeType];

  if (!defaults.snap) {
    return {
      latitude,
      longitude,
      zoom: defaults.zoom,
      snapped: false,
      reportCount: 0,
      label: null,
    };
  }

  const hotspot = await findActivityHotspot(
    latitude,
    longitude,
    defaults.searchRadiusKm,
    defaults.cellDeg
  );

  if (!hotspot) {
    return {
      latitude,
      longitude,
      zoom: placeType === 'city' ? 11.5 : 13,
      snapped: false,
      reportCount: 0,
      label: null,
    };
  }

  return {
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    zoom: defaults.zoom,
    snapped: true,
    reportCount: hotspot.count,
    label: hotspot.label,
  };
}
