import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { User } from '@/lib/models/User';
import {
  findOrCreateUserFromSessionUser,
  hasCompleteProfile,
  validateProfileInput,
} from '@/lib/profile';

export const dynamic = 'force-dynamic';

function buildProfileResponse(user: {
  _id: unknown;
  auth0_id: string;
  email: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  age?: number | null;
  phone_number?: string | null;
}) {
  return {
    profile: {
      id: String(user._id),
      auth0_id: user.auth0_id,
      email: user.email,
      name: user.name ?? null,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      username: user.username ?? '',
      age: user.age ?? null,
      phone_number: user.phone_number ?? '',
    },
    is_complete: hasCompleteProfile(user),
  };
}

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const user = await findOrCreateUserFromSessionUser(session.user);

    return NextResponse.json(buildProfileResponse(user), { status: 200 });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const { errors, sanitized } = validateProfileInput(payload);

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          error: 'Please fix the highlighted fields.',
          fieldErrors: errors,
        },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await findOrCreateUserFromSessionUser(session.user);

    const existingUsername = await User.findOne({
      username: sanitized.username,
      _id: { $ne: user._id },
    })
      .select('_id')
      .lean()
      .exec();

    if (existingUsername) {
      return NextResponse.json(
        {
          error: 'That username is already taken.',
          fieldErrors: {
            username: 'That username is already taken.',
          },
        },
        { status: 409 }
      );
    }

    user.first_name = sanitized.first_name;
    user.last_name = sanitized.last_name;
    user.username = sanitized.username;
    user.age = sanitized.age;
    user.phone_number = sanitized.phone_number;
    user.name = `${sanitized.first_name} ${sanitized.last_name}`;

    await user.save();

    return NextResponse.json(buildProfileResponse(user), { status: 200 });
  } catch (error) {
    console.error('Error completing profile:', error);

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        {
          error: 'That username is already taken.',
          fieldErrors: {
            username: 'That username is already taken.',
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Failed to save profile.' }, { status: 500 });
  }
}