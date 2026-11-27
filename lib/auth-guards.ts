import { redirect } from 'next/navigation';
import {
  DEMO_AUTH0_ID,
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_USERNAME,
  getOrCreateDemoMongoUser,
  isDemoMode,
} from '@/lib/demo';
import { connectDB } from '@/lib/db/mongodb';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';
import { getAppSession } from '@/lib/session';

function getSyntheticDemoUser() {
  return {
    _id: 'demo-user',
    auth0_id: DEMO_AUTH0_ID,
    email: DEMO_EMAIL,
    name: DEMO_NAME,
    first_name: 'Demo',
    last_name: 'User',
    username: DEMO_USERNAME,
    age: 25,
    phone_number: '5555555555',
  };
}

function sessionFallbackUser(sessionUser: {
  sub?: string;
  email?: string;
  name?: string;
  nickname?: string;
  given_name?: string;
  family_name?: string;
}) {
  const email = sessionUser.email || 'user@hera.app';
  const rawUsername =
    sessionUser.nickname ||
    email.split('@')[0] ||
    'user';
  const username = rawUsername
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 24) || 'user';

  return {
    _id: `session:${sessionUser.sub || 'unknown'}`,
    auth0_id: sessionUser.sub || 'unknown',
    email,
    name: sessionUser.name || sessionUser.nickname || email,
    first_name: sessionUser.given_name || sessionUser.name?.split(' ')[0] || 'Hera',
    last_name: sessionUser.family_name || sessionUser.name?.split(' ').slice(1).join(' ') || 'User',
    username,
    age: 25,
    phone_number: '5555555555',
  };
}

export async function requireAuthenticatedMongoUser() {
  if (isDemoMode()) {
    try {
      if (process.env.MONGODB_URI) {
        const user = await getOrCreateDemoMongoUser();
        return {
          session: {
            user: {
              sub: user.auth0_id,
              email: user.email,
              name: user.name,
            },
          },
          user,
        };
      }
    } catch (error) {
      console.error('Demo Mongo unavailable, using synthetic demo user:', error);
    }

    const user = getSyntheticDemoUser();
    return {
      session: {
        user: {
          sub: user.auth0_id,
          email: user.email,
          name: user.name,
        },
      },
      user,
    };
  }

  let session = null;
  try {
    session = await getAppSession();
  } catch (error) {
    console.error('Auth session unavailable, redirecting to landing page:', error);
    redirect('/');
  }

  if (!session?.user) {
    redirect('/');
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI missing; using Auth0 session fallback user');
    return {
      session,
      user: sessionFallbackUser(session.user),
      dbAvailable: false as const,
    };
  }

  try {
    await connectDB();
    const user = await findOrCreateUserFromSessionUser(session.user);
    return { session, user, dbAvailable: true as const };
  } catch (error) {
    // Don't bounce authenticated users back to `/` — that loops with the landing
    // page's "logged in → /home" redirect and causes a white flash.
    console.error('Database unavailable, using Auth0 session fallback user:', error);
    return {
      session,
      user: sessionFallbackUser(session.user),
      dbAvailable: false as const,
    };
  }
}

export async function requireCompletedProfile() {
  const context = await requireAuthenticatedMongoUser();

  // If Mongo is down we already synthesized a complete-enough profile so the
  // app remains usable after Auth0 login.
  if ('dbAvailable' in context && context.dbAvailable === false) {
    return context;
  }

  if (!hasCompleteProfile(context.user)) {
    if (isDemoMode()) {
      return context;
    }
    redirect('/complete-profile');
  }

  return context;
}

export async function requireIncompleteProfile() {
  const context = await requireAuthenticatedMongoUser();

  if ('dbAvailable' in context && context.dbAvailable === false) {
    // Can't complete a profile without Mongo — send them into the app instead.
    redirect('/home');
  }

  if (hasCompleteProfile(context.user)) {
    redirect('/home');
  }

  return context;
}
