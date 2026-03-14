import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

function toHeatSeverity(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(10, Math.max(1, value)); // Clamp to 1-10 range
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['low', 'minor'].includes(normalized)) return 1;
    if (['medium', 'moderate', 'med'].includes(normalized)) return 5;
    if (['high', 'severe', 'critical'].includes(normalized)) return 10;

    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      return Math.min(10, Math.max(1, numeric));
    }
  }

  return 1; // Default to lowest severity
}

export async function GET() {
  await connectDB();

  const posts = await Post.find({
    latitude: { $ne: null },
    longitude: { $ne: null },
  })
    .select('latitude longitude severity')
    .sort({ created_at: -1 })
    .limit(10)
    .lean();

  const features = (posts ?? [])
    .filter((post) => {
      return (
        typeof post.latitude === 'number' &&
        typeof post.longitude === 'number' &&
        Number.isFinite(post.latitude) &&
        Number.isFinite(post.longitude) &&
        Math.abs(post.latitude) <= 90 &&
        Math.abs(post.longitude) <= 180
      );
    })
    .map((post) => {
      const clampedSeverity = toHeatSeverity(post.severity);

      return {
        type: 'Feature',
        properties: {
          severity: clampedSeverity,
        },
        geometry: {
          type: 'Point',
          coordinates: [post.longitude, post.latitude],
        },
      };
    });

  // Default map view: Mississauga, Ontario (approx.)
  // Mapbox zoom levels are exponential; zoom ~12.5 shows roughly a 10km span.
  const defaultCenter: [number, number] = [-79.6441, 43.5890];
  const defaultZoom = 12.5;

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    defaultCenter,
    defaultZoom,
  });
}
