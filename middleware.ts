import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth0 } from './lib/auth0';

function hasAuth0Env() {
  const baseUrl = process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL;
  return Boolean(
    process.env.AUTH0_SECRET &&
      baseUrl &&
      process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET
  );
}

export async function middleware(request: NextRequest) {
  if (!hasAuth0Env()) {
    return NextResponse.next();
  }

  // Let auth0.middleware handle /auth/* routes completely — including setting
  // the state cookie for /auth/login. Never intercept before it runs, because
  // bypassing it loses the transaction cookie that /auth/callback needs to
  // verify the state parameter.
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ]
};
