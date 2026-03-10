'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';

export function Navigation() {
  const { user, isLoading } = useUser();

  return (
    <nav className="sticky top-0 z-40 border-b border-[#dacff0]/70 bg-white/75 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2f1f4a] via-[#7b60b4] to-[#e795a7] text-base font-bold text-white">
            H
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#8d72b8]">Hera</p>
            <p className="text-sm font-medium text-[#241735]">Women’s safety platform</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {!isLoading && !user && (
            <a
              href="/auth/login"
              className="brand-primary-button"
            >
              Login
            </a>
          )}

          {!isLoading && user && (
            <>
              <Link
                href="/create-post"
                className="brand-primary-button"
              >
                Create Post
              </Link>
              <Link
                href="/profile"
                className="brand-secondary-button"
              >
                Profile
              </Link>
              <a
                href="/auth/logout"
                className="text-sm font-medium text-[#4f4065] transition-colors hover:text-red-600"
              >
                Logout
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
