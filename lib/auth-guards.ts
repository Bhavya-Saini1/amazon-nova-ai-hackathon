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
    redirect('/');
  }

  try {
    await connectDB();
  } catch (error) {
    console.error('Database unavailable, redirecting to landing page:', error);
    redirect('/');
  }

  const user = await findOrCreateUserFromSessionUser(session.user);

  return { session, user };
}

export async function requireCompletedProfile() {
  const context = await requireAuthenticatedMongoUser();

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

  if (hasCompleteProfile(context.user)) {
    redirect('/home');
  }

  return context;
}
