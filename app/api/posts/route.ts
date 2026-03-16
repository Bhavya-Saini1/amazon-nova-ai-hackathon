import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';
import { serializePost } from '@/lib/posts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORY_SERVICE_URL =
  process.env.CATEGORY_SERVICE_URL ?? 'http://127.0.0.1:8000';
const ML_SEVERITY_API_URL = process.env.ML_SEVERITY_API_URL;

// ---------------------------------------------------------------------------
// Step 1 — Local category model (FastAPI at :8000/predict)
// ---------------------------------------------------------------------------
interface CategoryPrediction {
  category: string;
  score: number;
}

async function fetchCategories(text: string): Promise<string[]> {
  const res = await fetch(`${CATEGORY_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Category service responded with ${res.status}`);
  }

  const data = (await res.json()) as { predictions: CategoryPrediction[] };
  return data.predictions.map((p) => p.category);
}

// ---------------------------------------------------------------------------
// Step 2 — ML regression model for severity (external API)
// ---------------------------------------------------------------------------
const SEVERITY_TIMEOUT_MS = 3000;
const SEVERITY_FALLBACK = 5;

async function assessSeverity(text: string): Promise<number> {
  if (!ML_SEVERITY_API_URL) {
    console.warn('[severity] ML_SEVERITY_API_URL not set — using fallback');
    return SEVERITY_FALLBACK;
  }

  try {
    const res = await fetch(ML_SEVERITY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SEVERITY_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`ML severity API responded with ${res.status}`);
    }

    const data = await res.json();
    const raw = Number(data.severity ?? data.severity_index ?? data.score);

    if (!Number.isFinite(raw)) {
      throw new Error(`Non-numeric severity from ML API: ${JSON.stringify(data)}`);
    }

    return Math.max(1, Math.min(10, Math.round(raw)));
  } catch (err) {
    console.error('[severity] ML API failed, defaulting to', SEVERITY_FALLBACK, err);
    return SEVERITY_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseNumericCoordinate(
  value: unknown,
  maxAbs: number
): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > maxAbs) return null;
  return n;
}

// ---------------------------------------------------------------------------
// GET — list all posts
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST — create a new incident report (dual-model pipeline)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json(
        { error: '`text` is required' },
        { status: 400 }
      );
    }

    const latitude = parseNumericCoordinate(body.latitude, 90);
    const longitude = parseNumericCoordinate(body.longitude, 180);
    if (latitude === null || longitude === null) {
      return NextResponse.json(
        { error: '`latitude` and `longitude` are required numeric values' },
        { status: 400 }
      );
    }

    const is_anonymous = Boolean(body.is_anonymous);

    // --- Step 1: Categories from local FastAPI model -----------------------
    let categories: string[];
    try {
      categories = await fetchCategories(text);
    } catch (err) {
      console.error('Category service unreachable, falling back to empty:', err);
      categories = [];
    }

    // --- Step 2: Severity from ML regression model -------------------------
    const severity_index = await assessSeverity(text);

    // --- Step 4: Save to MongoDB -------------------------------------------
    await connectDB();

    const user = await findOrCreateUserFromSessionUser(session.user);
    if (!hasCompleteProfile(user)) {
      return NextResponse.json(
        { error: 'Complete your profile before posting.' },
        { status: 403 }
      );
    }

    const location = {
      type: 'Point' as const,
      coordinates: [longitude, latitude] as [number, number],
    };

    const post = await Post.create({
      user_id: user._id,
      raw_text: text,
      categories,
      severity_index,
      is_anonymous,
      location,
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
