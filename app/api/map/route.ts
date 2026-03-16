import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();

  // Query posts that have a valid GeoJSON location (new schema)
  // OR legacy latitude/longitude fields (old schema) for backward-compat
  const posts = await Post.find({
    $or: [
      { 'location.coordinates': { $exists: true } },
      { latitude: { $ne: null }, longitude: { $ne: null } },
    ],
  })
    .select('location severity_index severity')
    .lean();

  const features = (posts ?? []).flatMap((post) => {
    let lng: number | undefined;
    let lat: number | undefined;

    if (
      post.location?.type === 'Point' &&
      Array.isArray(post.location.coordinates) &&
      post.location.coordinates.length === 2
    ) {
      [lng, lat] = post.location.coordinates;
    }

    if (
      lng === undefined &&
      typeof (post as any).latitude === 'number' &&
      typeof (post as any).longitude === 'number'
    ) {
      lat = (post as any).latitude;
      lng = (post as any).longitude;
    }

    if (
      lng === undefined ||
      lat === undefined ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return [];
    }

    // Prefer the new numeric severity_index (1-10); fall back to legacy string label
    const severityRaw = post.severity_index ?? (post as any).severity;
    const severity =
      typeof severityRaw === 'number' && Number.isFinite(severityRaw)
        ? Math.min(10, Math.max(0, severityRaw))
        : 5;

    return [
      {
        type: 'Feature',
        properties: { severity },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      },
    ];
  });

  // Default map view: Mississauga, Ontario
  const defaultCenter: [number, number] = [-79.6441, 43.589];
  const defaultZoom = 12.5;

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    defaultCenter,
    defaultZoom,
  });
}
