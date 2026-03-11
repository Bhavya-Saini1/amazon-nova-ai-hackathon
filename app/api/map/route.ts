import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

export async function GET() {
  await connectDB();

  const posts = await Post.find({
    latitude: { $ne: null },
    longitude: { $ne: null },
  })
    .select('latitude longitude severity')
    .lean();

  const features = (posts ?? []).map((post) => {
    const severityNum = Number(post.severity ?? 0);
    const clampedSeverity = Math.min(10, Math.max(0, isNaN(severityNum) ? 0 : severityNum));

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
