'use client';

import { useState } from 'react';
import { PostCard } from '@/components/PostCard';

interface PublicPost {
  _id: string;
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: string;
  author_name: string;
  visibility_label: string;
}

interface Stats {
  posts: number;
  followers: number;
  following: number;
}

interface PublicProfileViewProps {
  username: string;
  fullName: string | null;
  isOwnProfile: boolean;
  initialIsFollowing: boolean;
  initialStats: Stats;
  posts: PublicPost[];
}

export function PublicProfileView({
  username,
  fullName,
  isOwnProfile,
  initialIsFollowing,
  initialStats,
  posts,
}: PublicProfileViewProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [stats, setStats] = useState(initialStats);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const avatarFallback = username[0]?.toUpperCase() || 'U';

  const handleFollowToggle = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const response = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
      });

      const payload = await response.json();

      if (!response.ok) {
        setErrorMessage(payload.error || 'Something went wrong.');
        return;
      }

      setIsFollowing(Boolean(payload.is_following));
      setStats(payload.stats);
    } catch (error) {
      console.error('Failed to toggle follow status:', error);
      setErrorMessage('Unable to update follow status right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="brand-glass-surface overflow-hidden rounded-[32px]">
      <div className="bg-gradient-to-r from-[#1d1432] via-[#2f1f4a] to-[#7d5ba9] px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-white/20 text-3xl font-bold text-white shadow-lg">
              {avatarFallback}
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/70">Public profile</p>
              <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">{username}</h1>
              {fullName && <p className="mt-2 text-sm text-white/80 sm:text-base">{fullName}</p>}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            {!isOwnProfile && (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isSubmitting}
                className={isFollowing ? 'brand-secondary-button min-w-[132px]' : 'brand-primary-button min-w-[132px]'}
              >
                {isSubmitting ? 'Updating...' : isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            )}
            <div className="brand-glass-panel px-5 py-4">
              <p className="text-sm font-medium text-white/70">Community presence</p>
              <p className="mt-2 text-lg font-semibold text-white">Viewing @{username}</p>
            </div>
            {errorMessage && <p className="text-sm text-white/85">{errorMessage}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-[#efe6f8] px-6 py-6 sm:grid-cols-3 sm:px-8">
        {[
          { label: 'Posts', value: stats.posts },
          { label: 'Followers', value: stats.followers },
          { label: 'Following', value: stats.following },
        ].map((stat) => (
          <div key={stat.label} className="brand-glass-panel brand-glass-card-hover px-5 py-4">
            <p className="text-sm font-medium text-[#d8cfee]">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#efe6f8] px-6 py-6 sm:px-8">
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Public posts</h2>
            <p className="mt-1 text-sm text-[#d8cfee]">
            Public profile activity for @{username}. Anonymous reports remain anonymous here.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="brand-surface-strong px-6 py-14 text-center">
            <h3 className="text-lg font-semibold text-[#241735]">No posts yet</h3>
            <p className="mt-2 text-sm text-[#7d6b95]">This user has not shared any reports yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post._id}
                id={post._id}
                username={post.author_name}
                rawText={post.raw_text}
                timestamp={post.created_at}
                category={post.category}
                severity={post.severity}
                location={post.location_text}
                visibilityLabel={post.visibility_label}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}