export function serializePost(post: {
  _id: unknown;
  raw_text: string;
  category?: string | null;
  severity?: string | null;
  location_text?: string | null;
  created_at: Date | string;
  is_anonymous?: boolean;
  user_id?: {
    _id?: unknown;
    username?: string | null;
    email?: string | null;
    auth0_id?: string | null;
  } | null;
}) {
  const isAnonymous = Boolean(post.is_anonymous);

  return {
    _id: String(post._id),
    raw_text: post.raw_text,
    category: post.category ?? null,
    severity: post.severity ?? null,
    location_text: post.location_text ?? null,
    created_at: post.created_at instanceof Date ? post.created_at.toISOString() : String(post.created_at),
    is_anonymous: isAnonymous,
    author_name: isAnonymous ? 'Anonymous' : post.user_id?.username || 'Anonymous',
    visibility_label: isAnonymous ? 'Anonymous' : 'Public',
    user_id: post.user_id
      ? {
          _id: post.user_id._id ? String(post.user_id._id) : null,
          username: post.user_id.username ?? null,
          email: post.user_id.email ?? null,
          auth0_id: post.user_id.auth0_id ?? null,
        }
      : null,
  };
}