import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LegacyPostFields {
  latitude?: number;
  longitude?: number;
  severity?: string | number;
}

export async function GET() {
  await connectDB();

  const posts = await Post.find({
    $or: [
      { 'location.coordinates': { $exists: true } },
      { latitude: { $ne: null }, longitude: { $ne: null } },
    ],
  })
    .select('location severity_index severity latitude longitude')
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

    const legacy = post as unknown as LegacyPostFields;
    if (lng === undefined && typeof legacy.latitude === 'number' && typeof legacy.longitude === 'number') {
      lat = legacy.latitude;
      lng = legacy.longitude;
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

    const severityRaw = post.severity_index ?? legacy.severity;
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

  const defaultCenter: [number, number] = [-79.6441, 43.589];
  const defaultZoom = 12.5;

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    defaultCenter,
    defaultZoom,
  });
}
