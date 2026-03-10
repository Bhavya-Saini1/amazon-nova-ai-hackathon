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
      <div className="brand-app-shell">
        <main className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-[#6d6282]">Loading...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="brand-app-shell">
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="brand-surface-strong p-4 text-center">
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
    <div className="brand-app-shell">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="brand-surface mb-8 p-6 sm:p-8">
          <h1 className="mb-2 text-3xl font-bold text-[#241735]">Report an Incident</h1>
          <p className="text-[#6d6282]">Share your experience to help keep the community safe</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_48px_rgba(44,26,72,0.08)]">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="raw_text" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
              What happened? *
            </label>
            <textarea
              id="raw_text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Describe the incident in detail. For example: I was walking past Club Mansion at 11pm and a man started following me."
              className="w-full resize-none rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
              rows={8}
            />
            <p className="mt-2 text-sm text-[#7d6b95]">{rawText.length} characters</p>
          </div>

          <div className="mb-6">
            <label htmlFor="location_text" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
              Location (optional)
            </label>
            <input
              id="location_text"
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Where did this happen? (e.g., Club Mansion, Main Street)"
              className="w-full rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
            />
            <p className="mt-2 text-sm text-[#7d6b95]">Will be geocoded later</p>
          </div>

          <div className="mb-6 rounded-3xl border border-[#eadff5] bg-[#fbf8fd] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#241735]">Post anonymously</p>
                <p className="mt-1 text-sm text-[#6d6282]">
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

        <div className="brand-panel mt-8">
          <h3 className="mb-2 font-semibold text-[#2f1f4a]">What happens next?</h3>
          <ul className="space-y-1 text-sm text-[#6d6282]">
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
