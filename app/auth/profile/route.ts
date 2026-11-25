import { NextResponse } from 'next/server';
import { getDemoClientUser, isDemoMode } from '@/lib/demo-shared';

export const dynamic = 'force-dynamic';

/**
 * In demo mode Auth0 middleware is skipped, but the client SDK still fetches
 * /auth/profile via useUser(). Serve a synthetic user so the UI stays signed in.
 */
export async function GET() {
  if (!isDemoMode()) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(getDemoClientUser());
}
