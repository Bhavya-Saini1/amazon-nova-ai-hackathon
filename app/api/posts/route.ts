import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

function serializePost(post: {
  _id: unknown;
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: Date;
  is_anonymous?: boolean;
  user_id?: {
    _id?: unknown;
    username?: string | null;
    email?: string | null;
    auth0_id?: string;
  } | null;
}) {
  const isAnonymous = Boolean(post.is_anonymous);

  return {
    _id: String(post._id),
    raw_text: post.raw_text,
    category: post.category ?? null,
    severity: post.severity ?? null,
    location_text: post.location_text ?? null,
    created_at: post.created_at,
    is_anonymous: isAnonymous,
    author_name: isAnonymous ? 'Anonymous' : post.user_id?.username || 'Anonymous',
    user_id: post.user_id
      ? {
          _id: post.user_id._id ? String(post.user_id._id) : null,
          username: post.user_id.username ?? null,
          email: post.user_id.email ?? null,
          auth0_id: post.user_id.auth0_id ?? null,
        }
      : null,
  };
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

    const { raw_text, location_text, is_anonymous } = await request.json();

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
      is_anonymous: Boolean(is_anonymous),
      category: null,
      severity: null,
      latitude: null,
      longitude: null,
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
