import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';

export async function requireAuthenticatedMongoUser() {
  let session = null;
  try {
    session = await auth0.getSession();
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