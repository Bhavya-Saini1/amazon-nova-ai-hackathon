import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await findOrCreateUserFromSessionUser(session.user);

    const posts = await Post.find({ user_id: user._id })
      .populate('user_id', 'username email auth0_id')
      .sort({ created_at: -1 })
      .lean()
      .exec();

    const serializedPosts = posts.map((post) => ({
      _id: String(post._id),
      raw_text: post.raw_text,
      category: post.category ?? null,
      severity: post.severity ?? null,
      location_text: post.location_text ?? null,
      created_at: post.created_at,
      is_anonymous: Boolean(post.is_anonymous),
      author_name: post.is_anonymous ? 'Anonymous' : user.username || 'Anonymous',
      visibility_label: post.is_anonymous ? 'Anonymous' : 'Public',
      user_id: {
        _id: String(user._id),
        username: user.username ?? null,
        email: user.email,
        auth0_id: user.auth0_id,
      },
    }));

    return NextResponse.json(
      {
        profile: {
          id: String(user._id),
          auth0_id: user.auth0_id,
          name: user.name,
          email: user.email,
          first_name: user.first_name ?? '',
          last_name: user.last_name ?? '',
          username: user.username ?? '',
          age: user.age ?? null,
          phone_number: user.phone_number ?? '',
          is_complete: hasCompleteProfile(user),
        },
        stats: {
          followers: 0,
          following: 0,
          posts: serializedPosts.length,
        },
        posts: serializedPosts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user posts' },
      { status: 500 }
    );
  }
}
