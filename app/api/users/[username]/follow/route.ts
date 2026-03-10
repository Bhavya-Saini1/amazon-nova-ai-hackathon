import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { getFollowCounts, followUser, isFollowingUser, unfollowUser } from '@/lib/follows';
import { User } from '@/lib/models/User';
import { Post } from '@/lib/models/Post';
import { requireCompletedProfile } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    username: string;
  };
};

async function loadTargetUser(usernameParam: string) {
  const username = decodeURIComponent(usernameParam).toLowerCase();

  return User.findOne({ username })
    .select('_id username')
    .lean()
    .exec();
}

async function buildFollowResponse(viewerId: unknown, targetId: unknown) {
  const [stats, posts, isFollowing] = await Promise.all([
    getFollowCounts(String(targetId)),
    Post.countDocuments({ user_id: targetId }).exec(),
    isFollowingUser(String(viewerId), String(targetId)),
  ]);

  return {
    is_following: isFollowing,
    stats: {
      posts,
      followers: stats.followers,
      following: stats.following,
    },
  };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { user } = await requireCompletedProfile();
    await connectDB();

    const targetUser = await loadTargetUser(params.username);

    if (!targetUser?._id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(await buildFollowResponse(user._id, targetUser._id), { status: 200 });
  } catch (error) {
    console.error('Error getting follow status:', error);
    return NextResponse.json({ error: 'Failed to get follow status' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const { user } = await requireCompletedProfile();
    await connectDB();

    const targetUser = await loadTargetUser(params.username);

    if (!targetUser?._id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (String(user._id) === String(targetUser._id)) {
      return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 });
    }

    await followUser(user._id, targetUser._id);

    return NextResponse.json(await buildFollowResponse(user._id, targetUser._id), { status: 200 });
  } catch (error) {
    console.error('Error following user:', error);
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { user } = await requireCompletedProfile();
    await connectDB();

    const targetUser = await loadTargetUser(params.username);

    if (!targetUser?._id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (String(user._id) === String(targetUser._id)) {
      return NextResponse.json({ error: 'You cannot unfollow yourself' }, { status: 400 });
    }

    await unfollowUser(user._id, targetUser._id);

    return NextResponse.json(await buildFollowResponse(user._id, targetUser._id), { status: 200 });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
  }
}