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
  { searchRadiusKm: number; bandwidthKm: number; zoom: number; snap: boolean }
> = {
  // Keep the search inside the asked city so we don't jump to a hotter neighbor city
  city: { searchRadiusKm: 10, bandwidthKm: 2.0, zoom: 12.8, snap: true },
  // Neighborhood ask → tighter blob inside that district
  neighborhood: { searchRadiusKm: 5, bandwidthKm: 1.0, zoom: 14, snap: true },
  // Intersection / campus building / exact pin → honor the coordinates
  specific: { searchRadiusKm: 0, bandwidthKm: 0, zoom: 15.6, snap: false },
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type HotspotPoint = {
  lat: number;
  lng: number;
  weight: number;
  label: string | null;
};

/**
 * Find the densest activity blob near a requested center.
 * Uses a kernel-density score (heatmap-like) so broad hot zones beat tiny tight clusters.
 */
export async function findActivityHotspot(
  latitude: number,
  longitude: number,
  radiusKm: number,
  bandwidthKm = 2.4
): Promise<{ latitude: number; longitude: number; count: number; label: string | null } | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || radiusKm <= 0) {
    return null;
  }

  const safeBandwidth = Math.max(0.6, bandwidthKm);

  await connectDB();

  const posts = await Post.find({
    location: {
      $geoWithin: {
        $centerSphere: [[longitude, latitude], radiusKm / 6378.1],
      },
    },
  })
    .select('location location_text severity_index')
    .limit(1500)
    .lean()
    .exec();

  if (posts.length === 0) return null;

  const points: HotspotPoint[] = [];
  for (const post of posts) {
    const coords = post.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const severity =
      typeof post.severity_index === 'number' && Number.isFinite(post.severity_index)
        ? post.severity_index
        : 5;

    points.push({
      lat,
      lng,
      weight: 1 + severity / 10,
      label: post.location_text?.trim() || null,
    });
  }

  if (points.length === 0) return null;

  // Score every point by nearby weighted density (Epanechnikov kernel),
  // biased toward the requested center so we stay in the asked area.
  const candidateStep = points.length > 500 ? Math.ceil(points.length / 400) : 1;
  let bestScore = -1;
  let bestIndex = 0;

  for (let i = 0; i < points.length; i += candidateStep) {
    const center = points[i];
    let localDensity = 0;

    for (const other of points) {
      const distance = haversineKm(center.lat, center.lng, other.lat, other.lng);
      if (distance > safeBandwidth) continue;
      const u = distance / safeBandwidth;
      localDensity += other.weight * (1 - u * u);
    }

    const distFromQuery = haversineKm(latitude, longitude, center.lat, center.lng);
    const centerBias = Math.max(0.2, 1 - (distFromQuery / Math.max(radiusKm, 1)) ** 1.35);
    const score = localDensity * centerBias;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const seed = points[bestIndex];
  let sumLat = 0;
  let sumLng = 0;
  let sumWeight = 0;
  let count = 0;
  const labels = new Map<string, number>();

  for (const point of points) {
    const distance = haversineKm(seed.lat, seed.lng, point.lat, point.lng);
    if (distance > safeBandwidth) continue;

    const falloff = 1 - (distance / safeBandwidth) ** 2;
    const w = point.weight * falloff;
    sumLat += point.lat * w;
    sumLng += point.lng * w;
    sumWeight += w;
    count += 1;

    if (point.label) {
      labels.set(point.label, (labels.get(point.label) ?? 0) + 1);
    }
  }

  if (sumWeight <= 0 || count === 0) {
    return {
      latitude: seed.lat,
      longitude: seed.lng,
      count: 1,
      label: seed.label,
    };
  }

  let topLabel: string | null = null;
  let topLabelCount = 0;
  for (const [label, labelCount] of labels.entries()) {
    if (labelCount > topLabelCount) {
      topLabel = label;
      topLabelCount = labelCount;
    }
  }

  return {
    latitude: sumLat / sumWeight,
    longitude: sumLng / sumWeight,
    count,
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
    defaults.bandwidthKm
  );

  if (!hotspot) {
    return {
      latitude,
      longitude,
      zoom: placeType === 'city' ? 11.2 : 13,
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
