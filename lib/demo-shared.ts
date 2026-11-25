export const DEMO_AUTH0_ID = 'demo|hera-demo-user';
export const DEMO_EMAIL = 'demo@hera.app';
export const DEMO_NAME = 'Demo User';
export const DEMO_USERNAME = 'demo';

export function isDemoMode() {
  return (
    process.env.DEMO_MODE === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  );
}

export function getDemoSessionUser() {
  return {
    sub: DEMO_AUTH0_ID,
    email: DEMO_EMAIL,
    name: DEMO_NAME,
    nickname: DEMO_USERNAME,
  };
}

export function getDemoClientUser() {
  return getDemoSessionUser();
}
