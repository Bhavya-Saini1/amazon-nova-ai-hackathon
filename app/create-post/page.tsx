'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import { AppHeader } from '@/components/AppHeader';

export default function CreatePost() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [rawText, setRawText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) {
    return (
      <div className="brand-internal-shell">
        <main className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-[#d8cfee]">Loading...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="brand-internal-shell">
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="brand-glass-surface p-4 text-center">
            <p className="mb-4 text-yellow-800">Please log in to create a post</p>
            <a href="/auth/login" className="brand-primary-button">
              Login
            </a>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!rawText.trim()) {
      setError('Please describe what happened');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_text: rawText,
          location_text: locationText || null,
          is_anonymous: isAnonymous,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to create post');
      }

      // Redirect to home page
      router.push('/home');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="brand-internal-shell">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="brand-glass-surface mb-8 p-6 sm:p-8">
          <h1 className="brand-page-title mb-2 text-3xl font-bold">Report an Incident</h1>
          <p className="brand-page-copy">Share your experience to help keep the community safe</p>
        </div>

        <form onSubmit={handleSubmit} className="brand-glass-surface p-6">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="raw_text" className="mb-2 block text-sm font-medium text-[#efe8fb]">
              What happened? *
            </label>
            <textarea
              id="raw_text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Describe the incident in detail. For example: I was walking past Club Mansion at 11pm and a man started following me."
              className="w-full resize-none rounded-2xl border border-white/14 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-[#c3b8d9] focus:border-[#b799ff] focus:ring-4 focus:ring-[#a98be91f]"
              rows={8}
            />
            <p className="mt-2 text-sm text-[#d8cfee]">{rawText.length} characters</p>
          </div>

          <div className="mb-6">
            <label htmlFor="location_text" className="mb-2 block text-sm font-medium text-[#efe8fb]">
              Location (optional)
            </label>
            <input
              id="location_text"
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Where did this happen? (e.g., Club Mansion, Main Street)"
              className="w-full rounded-2xl border border-white/14 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-[#c3b8d9] focus:border-[#b799ff] focus:ring-4 focus:ring-[#a98be91f]"
            />
            <p className="mt-2 text-sm text-[#d8cfee]">Will be geocoded later</p>
          </div>

          <div className="brand-glass-panel mb-6 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Post anonymously</p>
                <p className="mt-1 text-sm text-[#d8cfee]">
                  If enabled, your post will appear as Anonymous to other users.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isAnonymous}
                onClick={() => setIsAnonymous((current) => !current)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${isAnonymous ? 'bg-[#7b60b4]' : 'bg-[#d9cceb]'}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${isAnonymous ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="brand-primary-button disabled:opacity-50"
            >
              {isSubmitting ? 'Posting...' : 'Post Report'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/home')}
              className="brand-secondary-button"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="brand-glass-panel mt-8 p-5">
          <h3 className="mb-2 font-semibold text-white">What happens next?</h3>
          <ul className="space-y-1 text-sm text-[#d8cfee]">
            <li>✓ Your report is stored securely</li>
            <li>✓ Category and severity will be analyzed later</li>
            <li>✓ Your location will be geocoded for the heatmap</li>
            <li>✓ Community insights help everyone stay safer</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
