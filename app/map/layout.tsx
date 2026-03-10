import type { ReactNode } from 'react';
import { requireCompletedProfile } from '@/lib/auth-guards';

export default async function MapLayout({ children }: { children: ReactNode }) {
  await requireCompletedProfile();

  return children;
}