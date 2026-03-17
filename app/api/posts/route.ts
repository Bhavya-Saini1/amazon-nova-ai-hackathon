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
  try {
    const res = await fetch(`${CATEGORY_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      throw new Error(`Category service responded with ${res.status}`);
    }

    const data = (await res.json()) as { predictions: CategoryPrediction[] };
    const cats = data.predictions.map((p) => p.category);
    if (cats.length > 0) return cats;
  } catch (err) {
    console.error('[categories] ML service failed, using keyword fallback:', err);
  }

  return keywordCategoryFallback(text);
}

const KEYWORD_CATEGORIES: [RegExp, string][] = [
  [/\b(follow|stalk|trail|track|watch(?:ing)?\s+me)\b/i, 'Stalking'],
  [/\b(grop|touch|grab|hand|felt\s+up)\b/i, 'Groping'],
  [/\b(star|ogl|look(?:ing)?\s+(?:me|at)|eye)\b/i, 'Ogling'],
  [/\b(yell|shout|catcall|whistle|honk|kiss(?:ing)?\s+noise|crude|vulgar)\b/i, 'Catcalling'],
  [/\b(threaten|slur|swear|insult|scream|aggressive|block|harass)\b/i, 'Verbal Harassment'],
];

function keywordCategoryFallback(text: string): string[] {
  const matched = KEYWORD_CATEGORIES
    .filter(([re]) => re.test(text))
    .map(([, cat]) => cat);
  return matched.length > 0 ? Array.from(new Set(matched)) : ['Verbal Harassment'];
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

    const text = typeof body.text === 'string'
      ? body.text.trim()
      : typeof body.raw_text === 'string'
        ? body.raw_text.trim()
        : '';
    if (!text) {
      return NextResponse.json(
        { error: '`text` is required' },
        { status: 400 }
      );
    }

    const DEFAULT_LAT = 43.6532;  // Downtown Toronto fallback
    const DEFAULT_LNG = -79.3832;

    const latitude = parseNumericCoordinate(body.latitude, 90) ?? DEFAULT_LAT;
    const longitude = parseNumericCoordinate(body.longitude, 180) ?? DEFAULT_LNG;

    const is_anonymous = Boolean(body.is_anonymous);
    const location_text = typeof body.location_text === 'string' ? body.location_text.trim() : null;

    // --- Step 1: Categories from ML model (with keyword fallback) ----------
    const categories = await fetchCategories(text);

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
      location_text,
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
