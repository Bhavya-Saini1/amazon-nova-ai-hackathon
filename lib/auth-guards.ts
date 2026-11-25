import { redirect } from 'next/navigation';
import { getOrCreateDemoMongoUser, isDemoMode } from '@/lib/demo';
import { connectDB } from '@/lib/db/mongodb';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';
import { getAppSession } from '@/lib/session';

export async function requireAuthenticatedMongoUser() {
  if (isDemoMode()) {
    if (!process.env.MONGODB_URI) {
      redirect('/');
    }

    try {
      const user = await getOrCreateDemoMongoUser();
      return {
        session: { user: { sub: user.auth0_id, email: user.email, name: user.name } },
        user,
      };
    } catch (error) {
      console.error('Demo user unavailable, redirecting to landing page:', error);
      redirect('/');
    }
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
