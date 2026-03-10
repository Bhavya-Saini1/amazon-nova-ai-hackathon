import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { getFollowingUserIds } from '@/lib/follows';
import { Post } from '@/lib/models/Post';
import { serializePost } from '@/lib/posts';
import { requireCompletedProfile } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { user } = await requireCompletedProfile();
    await connectDB();

    const followingUserIds = await getFollowingUserIds(user._id);

    if (followingUserIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const posts = await Post.find({
      user_id: { $in: followingUserIds },
    })
      .populate('user_id', 'username email auth0_id')
      .sort({ created_at: -1 })
      .lean()
      .exec();

    return NextResponse.json(posts.map(serializePost), { status: 200 });
  } catch (error) {
    console.error('Error fetching following feed:', error);
    return NextResponse.json({ error: 'Failed to fetch following feed' }, { status: 500 });
  }
}