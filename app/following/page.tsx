'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import { AppHeader } from '@/components/AppHeader';
import { CommunityTabs } from '@/components/CommunityTabs';
import { PostCard } from '@/components/PostCard';

interface Post {
  _id: string;
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: string;
  author_name: string;
  visibility_label: string;
}

export default function FollowingPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
      return;
    }

    if (!isLoading && user) {
      const fetchPosts = async () => {
        try {
          setPostsLoading(true);
          const response = await fetch('/api/posts/following');

          if (!response.ok) {
            setPosts([]);
            return;
          }

          const payload = await response.json();
          setPosts(Array.isArray(payload) ? payload : []);
        } catch (error) {
          console.error('Failed to fetch following feed:', error);
        } finally {
          setPostsLoading(false);
        }
      };

      fetchPosts();
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="brand-internal-shell flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-[#7b60b4]"></div>
          <p className="mt-4 text-[#d8cfee]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="brand-internal-shell">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <section className="brand-glass-surface mb-6 overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="brand-page-pill mb-3 inline-flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em]">
                Your social feed
              </div>
              <h1 className="brand-page-title text-3xl font-semibold tracking-tight">Following</h1>
              <p className="brand-page-copy mt-3 max-w-2xl text-sm leading-7 sm:text-base">
                Keep up with the latest reports from the people you follow.
              </p>
            </div>
          </div>
        </section>

        <CommunityTabs activeTab="following" />

        {postsLoading && (
          <div className="brand-glass-surface flex flex-col items-center justify-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#7b60b4]"></div>
            <p className="mt-3 text-[#d8cfee]">Loading following feed...</p>
          </div>
        )}

        {!postsLoading && posts.length === 0 && (
          <div className="brand-glass-surface flex flex-col items-center justify-center py-16 text-center">
            <p className="font-medium text-white">You&apos;re not following anyone yet.</p>
            <p className="mt-1 text-sm text-[#d8cfee]">Use the search bar to find people and build your following feed.</p>
          </div>
        )}

        {!postsLoading && posts.length > 0 && (
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
      </main>
    </div>
  );
}