import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth0 } from './lib/auth0';

function isDemoMode() {
  return (
    process.env.DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  );
}

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
  if (isDemoMode()) {
    const { pathname } = request.nextUrl;

    // Keep /auth/profile available for the Auth0 client SDK (useUser).
    if (pathname === '/auth/profile') {
      return NextResponse.next();
    }

    if (pathname === '/' || pathname.startsWith('/auth')) {
      const url = request.nextUrl.clone();
      url.pathname = '/home';
      url.search = '';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

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
