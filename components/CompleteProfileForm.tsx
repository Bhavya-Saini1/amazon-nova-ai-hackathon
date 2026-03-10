'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileInput } from '@/lib/profile';

interface CompleteProfileFormProps {
  initialValues: {
    first_name: string;
    last_name: string;
    username: string;
    age: number | null;
    phone_number: string;
    email: string;
  };
}

type FieldErrors = Partial<Record<keyof ProfileInput, string>>;

export function CompleteProfileForm({ initialValues }: CompleteProfileFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    first_name: initialValues.first_name,
    last_name: initialValues.last_name,
    username: initialValues.username,
    age: initialValues.age?.toString() ?? '',
    phone_number: initialValues.phone_number,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          username: formData.username,
          age: Number(formData.age),
          phone_number: formData.phone_number,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? 'Please fix the highlighted fields.');
        return;
      }

      router.push('/home');
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="brand-dark-shell overflow-hidden">
      <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="flex flex-col justify-center text-white">
            <div className="mb-4 inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-fuchsia-100">
              One last step before your feed opens
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Complete your profile inside Hera.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-purple-100/80 sm:text-lg">
              Auth0 signs you in securely. Hera collects your public community details here so your account, username, and posting preferences stay managed inside the app.
            </p>

            <div className="mt-8 space-y-3 text-sm text-purple-100/75">
              <p>• Your username becomes your public identity on non-anonymous posts.</p>
              <p>• Your phone number is kept on your profile for future safety features.</p>
              <p>• You only need to complete this once.</p>
            </div>
          </section>

          <section className="brand-surface p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.28em] text-[#8d72b8]">Profile completion</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#241735]">Create your in-app identity</h2>
              <p className="mt-2 text-sm text-[#6d6282]">Signed in as {initialValues.email}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
                    First name
                  </label>
                  <input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(event) => updateField('first_name', event.target.value)}
                    className="w-full rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 text-sm text-[#241735] outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
                  />
                  {fieldErrors.first_name && <p className="mt-2 text-sm text-rose-600">{fieldErrors.first_name}</p>}
                </div>

                <div>
                  <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
                    Last name
                  </label>
                  <input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(event) => updateField('last_name', event.target.value)}
                    className="w-full rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 text-sm text-[#241735] outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
                  />
                  {fieldErrors.last_name && <p className="mt-2 text-sm text-rose-600">{fieldErrors.last_name}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
                  Username
                </label>
                <input
                  id="username"
                  value={formData.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  className="w-full rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 text-sm text-[#241735] outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
                  placeholder="Choose a unique public username"
                />
                <p className="mt-2 text-xs text-[#7d6b95]">Used publicly unless you choose anonymous posting.</p>
                {fieldErrors.username && <p className="mt-2 text-sm text-rose-600">{fieldErrors.username}</p>}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="age" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
                    Age
                  </label>
                  <input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    value={formData.age}
                    onChange={(event) => updateField('age', event.target.value)}
                    className="w-full rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 text-sm text-[#241735] outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
                    placeholder="18"
                  />
                  {fieldErrors.age && <p className="mt-2 text-sm text-rose-600">{fieldErrors.age}</p>}
                </div>

                <div>
                  <label htmlFor="phone_number" className="mb-2 block text-sm font-medium text-[#3b2d4f]">
                    Phone number
                  </label>
                  <input
                    id="phone_number"
                    type="tel"
                    value={formData.phone_number}
                    onChange={(event) => updateField('phone_number', event.target.value)}
                    className="w-full rounded-2xl border border-[#e3d7f1] bg-[#fffdfd] px-4 py-3 text-sm text-[#241735] outline-none transition focus:border-[#8d72b8] focus:ring-4 focus:ring-[#ede3f8]"
                    placeholder="+1 555 123 4567"
                  />
                  {fieldErrors.phone_number && <p className="mt-2 text-sm text-rose-600">{fieldErrors.phone_number}</p>}
                </div>
              </div>

              <button type="submit" disabled={submitting} className="brand-primary-button w-full disabled:cursor-not-allowed disabled:opacity-70">
                {submitting ? 'Saving profile...' : 'Complete profile'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}