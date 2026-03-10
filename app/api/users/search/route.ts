import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getFullName(user: {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}) {
  const composedName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  if (composedName) {
    return composedName;
  }

  return user.name?.trim() || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q')?.trim() || '';

    if (!query) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    await connectDB();

    const users = await User.find({
      username: {
        $regex: escapeRegex(query),
        $options: 'i',
      },
    })
      .select('_id username first_name last_name name')
      .sort({ username: 1 })
      .limit(8)
      .lean()
      .exec();

    return NextResponse.json(
      {
        results: users.map((user) => ({
          id: String(user._id),
          username: user.username,
          full_name: getFullName(user),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}