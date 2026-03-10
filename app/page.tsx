'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  // Redirect to /home if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/home');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="brand-dark-shell flex items-center justify-center">
        <div className="text-white text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <main className="brand-dark-shell overflow-hidden">
      <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-rose-300/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#cdb7ff] via-[#e0c7ff] to-[#f6c0c8] text-lg font-bold text-[#241735]">
              H
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-purple-200/80">Hera</p>
              <p className="text-sm text-purple-100/75">Safety, shared with care</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-purple-50 transition hover:border-white/30 hover:bg-white/10 sm:inline-flex"
            >
              Log in
            </Link>
            <a
              href="/auth/login?screen_hint=signup"
              className="inline-flex rounded-full bg-gradient-to-r from-[#f7e9ff] via-[#ebd7ff] to-[#ffd7d5] px-5 py-2.5 text-sm font-semibold text-[#241735] shadow-lg shadow-black/10 transition hover:scale-[1.01]"
            >
              Join Hera
            </a>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-fuchsia-100">
              Built for calm, trustworthy local awareness
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
              Share safety updates
              <span className="block brand-gradient-text">without adding more stress.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-purple-100/80">
              Hera helps women surface nearby incidents, follow local safety signals, and contribute clear community reports through a reassuring, modern experience.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="/auth/login?screen_hint=signup"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-slate-900 shadow-xl shadow-slate-950/20 transition hover:-translate-y-0.5"
              >
                Create your account
              </a>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
              >
                Explore the feed
              </Link>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Community-led alerts', value: 'Real-time' },
                { label: 'Designed for clarity', value: 'Calm UI' },
                { label: 'Secure sign-in', value: 'Protected' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
                >
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-sm text-purple-100/75">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-10 top-8 hidden h-36 w-36 rounded-full bg-fuchsia-500/15 blur-3xl lg:block" />
            <div className="absolute -bottom-12 right-0 h-40 w-40 rounded-full bg-purple-400/20 blur-3xl" />

            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-fuchsia-300/10" />

              <div className="relative space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-purple-100">Live safety snapshot</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Know what’s nearby before you move.</h2>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-right text-sm text-emerald-100">
                    Safe route signal
                    <p className="font-semibold">2 nearby check-ins</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/20 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-100">Trending nearby</p>
                        <p className="mt-1 text-xl font-semibold text-white">Streetlights out near East Entrance</p>
                      </div>
                      <span className="rounded-full border border-rose-200/20 bg-rose-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100">
                        Medium
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-fuchsia-300/15 bg-white/5 p-4 text-sm text-purple-50/85">
                      “Streetlights are out near the east entrance. Shared by 7 community members in the last hour.”
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <p className="text-sm font-medium text-purple-100">Trust-led sharing</p>
                      <p className="mt-2 text-sm leading-6 text-purple-100/75">
                        Post incidents or observations in seconds, with structured details others can scan quickly.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <p className="text-sm font-medium text-purple-100">Calm by design</p>
                      <p className="mt-2 text-sm leading-6 text-purple-100/75">
                        A softer interface that keeps important updates readable, even in stressful moments.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-purple-100/80">
                  🔒 Your account uses secure authentication, and your community feed stays focused on actionable local awareness.
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-purple-100/70">
              Trusted by communities that want safety information to feel supportive, not overwhelming.
            </div>
          </div>
        </section>
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </main>
  );
}
