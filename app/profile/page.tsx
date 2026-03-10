'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { PostCard } from '@/components/PostCard';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';

interface Post {
  _id: string;
  user_id: {
    username: string | null;
    email: string;
    auth0_id: string;
  };
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: string;
  is_anonymous: boolean;
  author_name: string;
  visibility_label: string;
}

interface ProfileResponse {
  profile: {
    id: string;
    auth0_id: string;
    name?: string | null;
    email: string;
    first_name: string;
    last_name: string;
    username: string;
    age: number | null;
    phone_number: string;
    is_complete: boolean;
  };
  stats: {
    followers: number;
    following: number;
    posts: number;
  };
  posts: Post[];
}

export default function Profile() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<ProfileResponse['profile'] | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
      return;
    }

    if (!isLoading && user) {
      const fetchUserPosts = async () => {
        try {
          setPostsLoading(true);
          const response = await fetch('/api/posts/user');
          if (response.ok) {
            const data: ProfileResponse = await response.json();
            setProfile(data.profile);
            setPosts(data.posts);
            setStats(data.stats);
          }
        } catch (error) {
          console.error('Failed to fetch user posts:', error);
        } finally {
          setPostsLoading(false);
        }
      };

      fetchUserPosts();
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="brand-app-shell">
        <main className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-[#6d6282]">Loading...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = profile?.username || user.name || user.nickname || user.email || 'User';
  const avatarFallback = displayName[0]?.toUpperCase() || 'U';

  return (
    <div className="brand-app-shell">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/88 shadow-[0_18px_48px_rgba(44,26,72,0.08)]">
          <div className="bg-gradient-to-r from-[#1d1432] via-[#2f1f4a] to-[#7d5ba9] px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {user.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.picture}
                    alt={displayName}
                    className="h-20 w-20 rounded-full border-4 border-white/40 object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-white/20 text-3xl font-bold text-white shadow-lg">
                    {avatarFallback}
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/70">Your profile</p>
                  <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">{displayName}</h1>
                  {profile && (
                    <div className="mt-2 space-y-1 text-sm text-white/80 sm:text-base">
                      <p>{profile.first_name} {profile.last_name}</p>
                      <p>{profile.email}</p>
                    </div>
                  )}
                </div>
              </div>

              <Link
                href="/create-post"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#2f1f4a] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#faf5ff]"
              >
                Create a new post
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-[#efe6f8] px-6 py-6 sm:grid-cols-3 sm:px-8">
            {[
              { label: 'Followers', value: stats.followers },
              { label: 'Following', value: stats.following },
              { label: 'Posts', value: stats.posts },
            ].map((stat) => (
              <div key={stat.label} className="rounded-3xl border border-[#eee4f8] bg-[#fbf8fd] px-5 py-4">
                <p className="text-sm font-medium text-[#7d6b95]">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-[#241735]">{stat.value}</p>
              </div>
            ))}
          </div>

          {profile && (
            <div className="grid gap-4 border-t border-[#efe6f8] px-6 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
              {[
                { label: 'Username', value: profile.username },
                { label: 'Age', value: profile.age ?? '—' },
                { label: 'Phone number', value: profile.phone_number },
                { label: 'Full name', value: `${profile.first_name} ${profile.last_name}` },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-[#eee4f8] bg-[#fbf8fd] px-5 py-4">
                  <p className="text-sm font-medium text-[#7d6b95]">{item.label}</p>
                  <p className="mt-2 text-base font-semibold text-[#241735]">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[#efe6f8] px-6 py-6 sm:px-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#241735]">Your posts</h2>
                <p className="mt-1 text-sm text-[#7d6b95]">
                  {stats.posts === 0
                    ? 'No reports yet — share your first incident report.'
                    : `${stats.posts} post${stats.posts !== 1 ? 's' : ''} from your account`}
                </p>
              </div>
            </div>

            {postsLoading && (
              <div className="flex items-center justify-center rounded-3xl bg-[#fbf8fd] py-16">
                <p className="text-[#7d6b95]">Loading your posts...</p>
              </div>
            )}

            {!postsLoading && posts.length === 0 && (
              <div className="brand-surface-strong px-6 py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2f1f4a] to-[#c587ab] text-white shadow-lg">
                  <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 4a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 0110 4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#241735]">No posts yet</h3>
                <p className="mt-2 text-sm text-[#7d6b95]">Create your first report to start building your profile activity.</p>
                <Link
                  href="/create-post"
                  className="brand-primary-button mt-5"
                >
                  Create your first post
                </Link>
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
          </div>
        </section>
      </main>
    </div>
  );
}
