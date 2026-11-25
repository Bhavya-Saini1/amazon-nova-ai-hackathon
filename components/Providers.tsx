'use client';

import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import type { ReactNode } from 'react';
import { getDemoClientUser } from '@/lib/demo-shared';

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function Providers({ children }: { children: ReactNode }) {
  if (demoMode) {
    return <Auth0Provider user={getDemoClientUser()}>{children}</Auth0Provider>;
  }

  return <Auth0Provider>{children}</Auth0Provider>;
}
