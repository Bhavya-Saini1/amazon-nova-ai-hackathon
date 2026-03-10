'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

interface SearchResult {
  id: string;
  username: string;
  full_name: string | null;
}

const SEARCH_DEBOUNCE_MS = 220;

export function UserSearch() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const showEmptyState = hasQuery && !isLoading && results.length === 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setResults([]);
          return;
        }

        const payload = await response.json();
        setResults(Array.isArray(payload.results) ? payload.results : []);
        setIsOpen(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to search users:', error);
        }
      } finally {
        setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [hasQuery, trimmedQuery]);

  const helperLabel = useMemo(() => {
    if (isLoading) {
      return 'Searching…';
    }

    if (showEmptyState) {
      return 'No matching users';
    }

    return 'Search by username';
  }, [isLoading, showEmptyState]);

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="brand-glass-panel group flex items-center gap-3 rounded-full px-4 py-3 transition-all duration-300 focus-within:border-white/18 focus-within:shadow-[0_22px_48px_rgba(8,6,22,0.26)] hover:border-white/16 hover:shadow-[0_18px_44px_rgba(8,6,22,0.22)]">
        <svg className="h-4 w-4 shrink-0 text-[#d1c0ee]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.5 3a5.5 5.5 0 014.376 8.83l3.647 3.647a.75.75 0 11-1.06 1.06l-3.647-3.646A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" />
        </svg>

        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (hasQuery || results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="Search users..."
          aria-label="Search users"
          className="w-full bg-transparent text-sm text-white placeholder:text-[#c7b9de] focus:outline-none"
        />

        <span className="hidden text-xs font-medium text-[#d7c8ed] sm:inline">{helperLabel}</span>
      </div>

      {isOpen && hasQuery && (
        <div className="brand-glass-surface absolute left-0 right-0 top-[calc(100%+0.75rem)] z-50 overflow-hidden rounded-[28px] animate-[fadeIn_160ms_ease-out]">
          <div className="max-h-80 overflow-y-auto p-2">
            {results.map((result) => {
              const avatarFallback = result.username[0]?.toUpperCase() || 'U';

              return (
                <Link
                  key={result.id}
                  href={`/user/${result.username}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-white/8"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2f1f4a] via-[#7b60b4] to-[#e795a7] text-sm font-bold text-white shadow-sm">
                    {avatarFallback}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{result.username}</p>
                    {result.full_name && (
                      <p className="truncate text-xs text-[#d8cfee]">{result.full_name}</p>
                    )}
                  </div>
                </Link>
              );
            })}

            {showEmptyState && (
              <div className="rounded-2xl px-4 py-6 text-center text-sm text-[#d8cfee]">
                No users found for “{trimmedQuery}”.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}