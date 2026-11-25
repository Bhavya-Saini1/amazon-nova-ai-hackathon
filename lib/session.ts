import { auth0 } from '@/lib/auth0';
import { getDemoSessionUser, isDemoMode } from '@/lib/demo-shared';

export async function getAppSession() {
  if (isDemoMode()) {
    return { user: getDemoSessionUser() };
  }

  return auth0.getSession();
}
