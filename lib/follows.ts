import mongoose from 'mongoose';
import { Follow } from '@/lib/models/Follow';

type ObjectIdLike = mongoose.Types.ObjectId | string;

function toObjectId(value: ObjectIdLike) {
  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}

export async function isFollowingUser(followerId: ObjectIdLike, followingId: ObjectIdLike) {
  const follow = await Follow.findOne({
    follower_id: toObjectId(followerId),
    following_id: toObjectId(followingId),
  })
    .select('_id')
    .lean()
    .exec();

  return Boolean(follow);
}

export async function followUser(followerId: ObjectIdLike, followingId: ObjectIdLike) {
  const followerObjectId = toObjectId(followerId);
  const followingObjectId = toObjectId(followingId);

  if (followerObjectId.equals(followingObjectId)) {
    throw new Error('Users cannot follow themselves.');
  }

  await Follow.updateOne(
    {
      follower_id: followerObjectId,
      following_id: followingObjectId,
    },
    {
      $setOnInsert: {
        follower_id: followerObjectId,
        following_id: followingObjectId,
        created_at: new Date(),
      },
    },
    { upsert: true }
  ).exec();
}

export async function unfollowUser(followerId: ObjectIdLike, followingId: ObjectIdLike) {
  await Follow.deleteOne({
    follower_id: toObjectId(followerId),
    following_id: toObjectId(followingId),
  }).exec();
}

export async function getFollowerCount(userId: ObjectIdLike) {
  return Follow.countDocuments({ following_id: toObjectId(userId) }).exec();
}

export async function getFollowingCount(userId: ObjectIdLike) {
  return Follow.countDocuments({ follower_id: toObjectId(userId) }).exec();
}

export async function getFollowCounts(userId: ObjectIdLike) {
  const [followers, following] = await Promise.all([
    getFollowerCount(userId),
    getFollowingCount(userId),
  ]);

  return { followers, following };
}

export async function getFollowingUserIds(userId: ObjectIdLike) {
  const follows = await Follow.find({ follower_id: toObjectId(userId) })
    .select('following_id')
    .lean()
    .exec();

  return follows.map((follow) => follow.following_id);
}