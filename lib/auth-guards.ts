import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { findOrCreateUserFromSessionUser, hasCompleteProfile } from '@/lib/profile';

export async function requireAuthenticatedMongoUser() {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect('/');
  }

  await connectDB();

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