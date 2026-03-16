export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { connectDB } from '@/lib/db/mongodb';
import { Post } from '@/lib/models/Post';

/**
 * DELETE /api/admin/nuke
 * Wipes every document in the posts collection.
 * Requires authentication + a confirmation header to prevent accidents.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const confirm = request.headers.get('x-confirm-nuke');
  if (confirm !== 'yes-delete-all-posts') {
    return NextResponse.json(
      { error: 'Missing confirmation header: x-confirm-nuke: yes-delete-all-posts' },
      { status: 400 }
    );
  }

  await connectDB();
  const result = await Post.deleteMany({});

  return NextResponse.json({
    message: 'Posts collection wiped',
    deletedCount: result.deletedCount,
  });
}
