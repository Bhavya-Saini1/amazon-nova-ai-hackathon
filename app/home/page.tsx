'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { CommunityTabs } from '@/components/CommunityTabs';
import { PostCard } from '@/components/PostCard';

interface Post {
  _id: string;
  user_id: {
    username: string | null;
    email: string | null;
    auth0_id: string | null;
  } | null;
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: string;
  is_anonymous: boolean;
  author_name: string;
}

export default function HomePage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'near-me'>('trending');

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'near-me' ? 'near-me' : 'trending');
  }, [searchParams]);

  const handleTabChange = (tab: 'trending' | 'near-me') => {
    setActiveTab(tab);

    if (tab === 'near-me') {
      router.replace('/home?tab=near-me', { scroll: false });
      return;
    }

    router.replace('/home', { scroll: false });
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [isLoading, user, router]);

  // Fetch posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setPostsLoading(true);
        const response = await fetch('/api/posts');
        if (response.ok) {
          const data = await response.json();
          setPosts(data);
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error);
      } finally {
        setPostsLoading(false);
      }
    };

    if (!isLoading && user) {
      fetchPosts();
    }
  }, [isLoading, user]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        setProfileUsername(payload.profile?.username || null);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    };

    if (!isLoading && user) {
      fetchProfile();
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <div className="brand-app-shell flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-[#7b60b4]"></div>
          <p className="mt-4 text-[#6d6282]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="brand-app-shell">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <section className="brand-surface mb-6 overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center rounded-full border border-[#e6d9f2] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#8c72b4]">
                Community-powered awareness
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#241735]">
                Welcome back, {profileUsername || user.nickname || user.email}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6d6282] sm:text-base">
                Follow safety reports from your community through a clearer, calmer feed designed to support quick decisions.
              </p>
            </div>

            <div className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm text-[#6d6282] shadow-sm">
              Trending reports and nearby updates
            </div>
          </div>
        </section>

        <CommunityTabs activeTab={activeTab} onTabChange={handleTabChange} />

        {postsLoading && (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/70 bg-white/75 py-12 shadow-[0_18px_48px_rgba(44,26,72,0.08)]">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#7b60b4]"></div>
            <p className="mt-3 text-[#7d6b95]">Loading posts...</p>
          </div>
        )}

        {!postsLoading && posts.length === 0 && (
          <div className="brand-surface-strong flex flex-col items-center justify-center py-16 text-center">
            <svg className="mb-4 h-16 w-16 text-[#ccbfe0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6h-6m0 0H6m6 6h-6m0 0H6" />
            </svg>
            <p className="font-medium text-[#3b2d4f]">No posts yet</p>
            <p className="mt-1 text-sm text-[#7d6b95]">Be the first to share a safety report</p>
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
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
