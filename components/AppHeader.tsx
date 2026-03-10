'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';

export function AppHeader() {
  const { user } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');

        if (!response.ok) {
          return;
        }

        const payload = await response.json();

        if (isMounted) {
          setProfileUsername(payload.profile?.username || null);
        }
      } catch (error) {
        console.error('Failed to fetch profile username:', error);
      }
    };

    if (user) {
      fetchProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  const displayName = profileUsername || user?.name || user?.nickname || user?.email || 'User';
  const avatarFallback = displayName[0]?.toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-40 border-b border-[#dacff0]/70 bg-white/75 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/home" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2f1f4a] via-[#7b60b4] to-[#e795a7]">
            <span className="text-white font-bold text-lg">H</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#8d72b8]">Hera</p>
            <span className="text-lg font-semibold text-[#241735]">Safety Feed</span>
          </div>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <Link
            href="/create-post"
            className="brand-primary-button hidden sm:inline-flex"
          >
            Create Post
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((previous) => !previous)}
              className="flex items-center gap-3 rounded-full border border-[#e3d7f1] bg-white/90 p-1 pr-3 shadow-[0_10px_30px_rgba(44,26,72,0.08)] transition-all hover:border-[#cdbbe6] hover:shadow-[0_16px_38px_rgba(44,26,72,0.12)] focus:outline-none focus:ring-2 focus:ring-[#d9c7f3]"
            >
              {user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2f1f4a] to-[#c587ab] text-white font-bold">
                  {avatarFallback}
                </div>
              )}
              <span className="hidden sm:block max-w-32 truncate text-sm font-medium text-gray-700">
                {displayName}
              </span>
              <svg
                className={`h-4 w-4 text-[#8d7ba4] transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-3xl border border-[#e3d7f1] bg-white/95 shadow-[0_24px_55px_rgba(44,26,72,0.16)] backdrop-blur-xl">
                <div className="border-b border-[#efe6f8] bg-gradient-to-r from-[#f8f2fd] via-[#fdf8fd] to-[#fff4f6] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[#241735]">{displayName}</p>
                  {user?.email && <p className="truncate text-xs text-[#7d6b95]">{user.email}</p>}
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[#4f4065] transition-colors hover:bg-[#f6f0fb] hover:text-[#2f1f4a]"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zM3 16a7 7 0 1114 0H3z" />
                    </svg>
                    View Profile
                  </Link>

                  <a
                    href="/auth/logout"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M3 4.75A1.75 1.75 0 014.75 3h6.5A1.75 1.75 0 0113 4.75v1a.75.75 0 01-1.5 0v-1a.25.25 0 00-.25-.25h-6.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25v-1a.75.75 0 011.5 0v1A1.75 1.75 0 0111.25 17h-6.5A1.75 1.75 0 013 15.25V4.75z"
                        clipRule="evenodd"
                      />
                      <path
                        fillRule="evenodd"
                        d="M12.22 6.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 11-1.06-1.06l1.97-1.97H7.75a.75.75 0 010-1.5h6.44l-1.97-1.97a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Logout
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
