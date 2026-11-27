'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { CommunityTabs } from '@/components/CommunityTabs';
import { PostCard } from '@/components/PostCard';

/** City-scale Near Me radius — roughly one Southern Ontario city, not the whole GTA. */
const NEAR_ME_RADIUS_KM = 10;

interface Post {
  _id: string;
  user_id: {
    username: string | null;
    email: string | null;
    auth0_id: string | null;
  } | null;
  raw_text: string;
  categories?: string[];
  severity_index?: number | null;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: string;
  is_anonymous: boolean;
  author_name: string;
}

interface UserCoords {
  lat: number;
  lng: number;
}

function readUserLocation(): Promise<UserCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Allow location access to see reports in your city.'));
          return;
        }
        reject(new Error('Could not determine your location. Try again.'));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 }
    );
  });
}

export default function HomePage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trending' | 'near-me'>('trending');

  const topReportedAreas = useMemo(() => {
    const areaCounts = posts.reduce<Map<string, number>>((counts, post) => {
      const location = post.location_text?.trim();

      if (!location) {
        return counts;
      }

      counts.set(location, (counts.get(location) ?? 0) + 1);
      return counts;
    }, new Map());

    return Array.from(areaCounts.entries())
      .sort((left, right) => {
        if (right[1] === left[1]) {
          return left[0].localeCompare(right[0]);
        }

        return right[1] - left[1];
      })
      .slice(0, 5)
      .map(([location, reports]) => ({ location, reports }));
  }, [posts]);

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

  // Redirect if not authenticated (skipped in demo mode)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return;
    }
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [isLoading, user, router]);

  // Fetch posts — Near Me uses a city-scale radius around the user
  useEffect(() => {
    let cancelled = false;

    const fetchPosts = async () => {
      try {
        setPostsLoading(true);
        setLocationError(null);

        let url = '/api/posts';

        if (activeTab === 'near-me') {
          const coords = await readUserLocation();
          if (cancelled) return;
          const params = new URLSearchParams({
            lat: String(coords.lat),
            lng: String(coords.lng),
            radius_km: String(NEAR_ME_RADIUS_KM),
          });
          url = `/api/posts?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to load posts');
        }

        const data = await response.json();
        if (!cancelled) {
          setPosts(data);
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error);
        if (!cancelled) {
          setPosts([]);
          if (activeTab === 'near-me') {
            setLocationError(
              error instanceof Error ? error.message : 'Failed to load nearby posts.'
            );
          }
        }
      } finally {
        if (!cancelled) {
          setPostsLoading(false);
        }
      }
    };

    if (!isLoading && user) {
      fetchPosts();
    }

    return () => {
      cancelled = true;
    };
  }, [isLoading, user, activeTab]);

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

  if (!user && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return (
      <div className="brand-app-shell flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-[#7b60b4]"></div>
          <p className="mt-4 text-[#6d6282]">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-internal-shell">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <section className="brand-glass-surface brand-glass-card-hover mb-6 overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="brand-page-pill mb-3 inline-flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em]">
                Community-powered awareness
              </div>
              <h1 className="brand-page-title text-3xl font-semibold tracking-tight">
                Welcome back, {profileUsername || user?.nickname || user?.email || 'demo'}
              </h1>
              <p className="brand-page-copy mt-3 max-w-2xl text-sm leading-7 sm:text-base">
                Follow safety reports from your community through a clearer, calmer feed designed to support quick decisions.
              </p>
            </div>

            <div className="brand-page-pill px-4 py-2 text-sm shadow-sm">
              {activeTab === 'near-me'
                ? `Reports within ~${NEAR_ME_RADIUS_KM} km of you`
                : 'Trending reports and nearby updates'}
            </div>
          </div>
        </section>

        <CommunityTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <section>
            {postsLoading && (
              <div className="brand-glass-surface flex flex-col items-center justify-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#7b60b4]"></div>
                <p className="mt-3 text-[#e2d8f3]">Loading posts...</p>
              </div>
            )}

            {!postsLoading && locationError && activeTab === 'near-me' && (
              <div className="brand-glass-surface flex flex-col items-center justify-center py-16 text-center">
                <p className="font-medium text-white">Location needed for Near Me</p>
                <p className="mt-2 max-w-sm text-sm text-[#d8cfee]">{locationError}</p>
              </div>
            )}

            {!postsLoading && !locationError && posts.length === 0 && (
              <div className="brand-glass-surface flex flex-col items-center justify-center py-16 text-center">
                <svg className="mb-4 h-16 w-16 text-[#ccbfe0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6h-6m0 0H6m6 6h-6m0 0H6" />
                </svg>
                <p className="font-medium text-white">
                  {activeTab === 'near-me' ? 'No reports in your city yet' : 'No posts yet'}
                </p>
                <p className="mt-1 text-sm text-[#d8cfee]">
                  {activeTab === 'near-me'
                    ? `Nothing within about ${NEAR_ME_RADIUS_KM} km of your location right now.`
                    : 'Be the first to share a safety report'}
                </p>
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
                    categories={post.categories}
                    severityIndex={post.severity_index}
                    severity={post.severity}
                    location={post.location_text}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-28">
            <section className="brand-glass-surface overflow-hidden p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ccbbef]">
                    Location insights
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Top Reported Areas</h2>
                </div>
                <div className="brand-page-pill px-3 py-1 text-xs font-medium">
                  {activeTab === 'near-me' ? 'In your city' : 'Top 5'}
                </div>
              </div>

              <p className="text-sm leading-6 text-[#d7caec]">
                {activeTab === 'near-me'
                  ? `Hotspots from reports within about ${NEAR_ME_RADIUS_KM} km of you.`
                  : 'A quick view of the areas appearing most often in recent community reports.'}
              </p>

              {topReportedAreas.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {topReportedAreas.map((area, index) => (
                    <div
                      key={area.location}
                      className="brand-glass-panel brand-glass-card-hover flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#cfbff0]">
                          #{index + 1}
                        </p>
                        <p className="truncate text-sm font-semibold text-white">{area.location}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-white">{area.reports}</p>
                        <p className="text-xs text-[#d2c4e8]">report{area.reports !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="brand-glass-panel mt-5 border border-dashed border-white/14 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-[#efe8fb]">
                    Location insights will appear as more reports are added.
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
