import { User, type IUser } from '@/lib/models/User';

export const MINIMUM_AGE = 13;
export const MAXIMUM_AGE = 120;

export interface ProfileInput {
  first_name: string;
  last_name: string;
  username: string;
  age: number;
  phone_number: string;
}

type ProfileCompletenessShape = Pick<IUser, 'first_name' | 'last_name' | 'username' | 'age' | 'phone_number'>;

type Auth0SessionUser = {
  sub?: string;
  email?: string;
  name?: string;
  nickname?: string;
};

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.trim();
}

export function isValidPhoneNumber(phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber);
  const digitsOnly = normalized.replace(/\D/g, '');

  return digitsOnly.length >= 7 && digitsOnly.length <= 15 && /^[+]?[(]?[0-9\s\-().]+$/.test(normalized);
}

export function validateProfileInput(input: Partial<ProfileInput>) {
  const errors: Partial<Record<keyof ProfileInput, string>> = {};

  const firstName = input.first_name?.trim() ?? '';
  const lastName = input.last_name?.trim() ?? '';
  const username = normalizeUsername(input.username ?? '');
  const age = Number(input.age);
  const phoneNumber = normalizePhoneNumber(input.phone_number ?? '');

  if (!firstName) {
    errors.first_name = 'First name is required.';
  }

  if (!lastName) {
    errors.last_name = 'Last name is required.';
  }

  if (!username) {
    errors.username = 'Username is required.';
  } else if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
    errors.username = 'Use 3-24 letters, numbers, dots, dashes, or underscores.';
  }

  if (!Number.isInteger(age)) {
    errors.age = 'Age must be a whole number.';
  } else if (age < MINIMUM_AGE || age > MAXIMUM_AGE) {
    errors.age = `Age must be between ${MINIMUM_AGE} and ${MAXIMUM_AGE}.`;
  }

  if (!phoneNumber) {
    errors.phone_number = 'Phone number is required.';
  } else if (!isValidPhoneNumber(phoneNumber)) {
    errors.phone_number = 'Enter a valid phone number.';
  }

  return {
    errors,
    sanitized: {
      first_name: firstName,
      last_name: lastName,
      username,
      age,
      phone_number: phoneNumber,
    },
  };
}

export function hasCompleteProfile(user: Partial<ProfileCompletenessShape> | null | undefined) {
  if (!user) {
    return false;
  }

  return Boolean(
    user.first_name?.trim() &&
      user.last_name?.trim() &&
      user.username?.trim() &&
      typeof user.age === 'number' &&
      Number.isInteger(user.age) &&
      user.age >= MINIMUM_AGE &&
      user.age <= MAXIMUM_AGE &&
      user.phone_number?.trim() &&
      isValidPhoneNumber(user.phone_number)
  );
}

export async function findOrCreateUserFromSessionUser(sessionUser: Auth0SessionUser) {
  if (!sessionUser.sub || !sessionUser.email) {
    throw new Error('Session is missing required Auth0 identity fields.');
  }

  let user = await User.findOne({ auth0_id: sessionUser.sub });

  if (!user) {
    user = new User({
      auth0_id: sessionUser.sub,
      email: sessionUser.email,
      name: sessionUser.nickname || sessionUser.name || sessionUser.email,
    });
    await user.save({ validateBeforeSave: false });
  } else {
    const nextName = sessionUser.nickname || sessionUser.name || sessionUser.email;
    const shouldUpdate = user.email !== sessionUser.email || user.name !== nextName;

    if (shouldUpdate) {
      user.email = sessionUser.email;
      user.name = nextName;
      await user.save({ validateBeforeSave: hasCompleteProfile(user) });
    }
  }

  return user;
}