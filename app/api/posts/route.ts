import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';
import { serializePost } from '@/lib/posts';

export const dynamic = 'force-dynamic';

function normalizeSeverity(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (['low', 'minor'].includes(normalized)) return 1;
  if (['medium', 'moderate', 'med'].includes(normalized)) return 5;
  if (['high', 'severe', 'critical'].includes(normalized)) return 10;

  // Try to parse as number
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 10) {
    return numeric;
  }

  return null;
}

function inferSeverityFromText(rawText: string): number {
  const text = rawText.toLowerCase();
  if (
    /(assault|attack|rape|weapon|stab|kill|threat|kidnap|grop|molest|followed me home|violence)/.test(
      text
    )
  ) {
    return 10; // High severity
  }
  if (/(harass|ogling|stalk|touch|grab|unsafe|abuse|catcall|comment)/.test(text)) {
    return 5; // Medium severity
  }
  return 1; // Low severity
}

function parseCoordinatesFromLocation(
  locationText: string | null
): { latitude: number; longitude: number } | null {
  if (!locationText) return null;
  const trimmed = locationText.trim();
  if (!trimmed) return null;

  // Supports strings like "43.5890,-79.6441" or "43.5890, -79.6441"
  const coordMatch = trimmed.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!coordMatch) return null;

  const latitude = Number(coordMatch[1]);
  const longitude = Number(coordMatch[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}

function parseNumericCoordinate(value: unknown, maxAbs: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (Math.abs(value) > maxAbs) return null;
  return value;
}

export async function GET() {
  try {
    await connectDB();

    const posts = await Post.find({})
      .populate('user_id', 'username email auth0_id')
      .sort({ created_at: -1 })
      .lean()
      .exec();

    return NextResponse.json(posts.map(serializePost), { status: 200 });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const raw_text = typeof body.raw_text === 'string' ? body.raw_text : '';
    const location_text = typeof body.location_text === 'string' ? body.location_text : null;
    const is_anonymous = Boolean(body.is_anonymous);
    const providedSeverity = normalizeSeverity(body.severity);

    const providedLatitude = parseNumericCoordinate(body.latitude, 90);
    const providedLongitude = parseNumericCoordinate(body.longitude, 180);

    const parsedLocationCoords = parseCoordinatesFromLocation(location_text);
    const latitude = providedLatitude ?? parsedLocationCoords?.latitude ?? null;
    const longitude = providedLongitude ?? parsedLocationCoords?.longitude ?? null;
    const severity = providedSeverity ?? inferSeverityFromText(raw_text);

    if (!raw_text || raw_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'raw_text is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await findOrCreateUserFromSessionUser(session.user);

    if (!hasCompleteProfile(user)) {
      return NextResponse.json(
        { error: 'Complete your profile before posting.' },
        { status: 403 }
      );
    }

    const post = await Post.create({
      user_id: user._id,
      raw_text,
      location_text: location_text || null,
      is_anonymous,
      category: null,
      severity,
      latitude,
      longitude,
    });

    await post.populate('user_id', 'username email auth0_id');

    return NextResponse.json(serializePost(post.toObject()), { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
