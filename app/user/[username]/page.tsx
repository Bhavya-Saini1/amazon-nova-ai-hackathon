import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { PublicProfileView } from '@/components/PublicProfileView';
import { connectDB } from '@/lib/db/mongodb';
import { getFollowCounts, isFollowingUser } from '@/lib/follows';
import { User } from '@/lib/models/User';
import { Post } from '@/lib/models/Post';
import { serializePost } from '@/lib/posts';
import { requireCompletedProfile } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

type PublicUserPageProps = {
  params: {
    username: string;
  };
};

function getFullName(user: {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  if (fullName) {
    return fullName;
  }

  return user.name?.trim() || null;
}

export default async function PublicUserPage({ params }: PublicUserPageProps) {
  const { user: viewer } = await requireCompletedProfile();
  await connectDB();

  const username = decodeURIComponent(params.username).toLowerCase();

  const user = await User.findOne({ username })
    .select('_id username first_name last_name name')
    .lean()
    .exec();

  if (!user?.username) {
    notFound();
  }

  const posts = await Post.find({ user_id: user._id })
    .populate('user_id', 'username email auth0_id')
    .sort({ created_at: -1 })
    .lean()
    .exec();

  const displayName = user.username;
  const fullName = getFullName(user);
  const isOwnProfile = String(viewer._id) === String(user._id);

  const [followCounts, initialIsFollowing] = await Promise.all([
    getFollowCounts(user._id),
    isOwnProfile ? Promise.resolve(false) : isFollowingUser(viewer._id, user._id),
  ]);

  const serializedPosts = posts.map(serializePost);

  return (
    <div className="brand-internal-shell">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <PublicProfileView
          username={displayName}
          fullName={fullName}
          isOwnProfile={isOwnProfile}
          initialIsFollowing={initialIsFollowing}
          initialStats={{
            posts: serializedPosts.length,
            followers: followCounts.followers,
            following: followCounts.following,
          }}
          posts={serializedPosts}
        />
      </main>
    </div>
  );
}