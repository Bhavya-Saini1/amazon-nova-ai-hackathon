import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/db/mongodb';
import { DEMO_MAP_GEOJSON } from '@/lib/demo-map-data';
import { isDemoMode } from '@/lib/demo-shared';
import { Post } from '@/lib/models/Post';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LegacyPostFields {
  latitude?: number;
  longitude?: number;
  severity?: string | number;
}

function emptyMapPayload() {
  return {
    type: 'FeatureCollection' as const,
    features: [] as Array<{
      type: 'Feature';
      properties: { severity: number };
      geometry: { type: 'Point'; coordinates: [number, number] };
    }>,
    defaultCenter: [-79.6441, 43.589] as [number, number],
    defaultZoom: 12.5,
  };
}

export async function GET() {
  try {
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
      if (
        lng === undefined &&
        typeof legacy.latitude === 'number' &&
        typeof legacy.longitude === 'number'
      ) {
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
          type: 'Feature' as const,
          properties: { severity },
          geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
        },
      ];
    });

    // Prefer live data; fall back to demo points if the DB is empty during demos.
    if (features.length === 0 && isDemoMode()) {
      return NextResponse.json(DEMO_MAP_GEOJSON);
    }

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      defaultCenter: [-79.6441, 43.589] as [number, number],
      defaultZoom: 12.5,
    });
  } catch (error) {
    console.error('Error fetching map data:', error);

    if (isDemoMode()) {
      return NextResponse.json(DEMO_MAP_GEOJSON);
    }

    return NextResponse.json(emptyMapPayload(), { status: 200 });
  }
}
