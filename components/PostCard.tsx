'use client';

interface PostCardProps {
  id: string;
  username: string;
  rawText: string;
  timestamp: string;
  category?: string | null;
  severity?: string | null;
  location?: string | null;
  visibilityLabel?: string | null;
}

export function PostCard({
  username,
  rawText,
  timestamp,
  category,
  severity,
  location,
  visibilityLabel,
}: PostCardProps) {
  const preview = rawText.length > 300 ? rawText.substring(0, 300) + '...' : rawText;
  
  const formattedTime = formatTimeAgo(new Date(timestamp));

  const severityBadgeColor: Record<string, string> = {
    low: 'border border-yellow-200 bg-yellow-50 text-yellow-800',
    medium: 'border border-orange-200 bg-orange-50 text-orange-800',
    high: 'border border-red-200 bg-red-50 text-red-700',
  };

  return (
    <article className="brand-glass-card brand-glass-card-hover group relative overflow-hidden rounded-[28px] p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2f1f4a] via-[#b79bff] to-[#ef9d8f] opacity-80" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2f1f4a] via-[#7b60b4] to-[#e795a7] text-sm font-bold text-white transition-all duration-300 group-hover:shadow-[0_0_22px_rgba(196,163,255,0.34)]">
            {username[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{username}</h3>
            <p className="text-xs text-[#d8cfee]">{formattedTime}</p>
          </div>
        </div>
        {severity && (
          <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${severityBadgeColor[severity.toLowerCase()] || 'border border-gray-200 bg-gray-100 text-gray-800'}`}>
            {severity}
          </div>
        )}
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[#f0ebf7]">{preview}</p>

      <div className="flex flex-wrap gap-2 items-center">
        {visibilityLabel && (
          <span className="inline-block rounded-full border border-white/14 bg-white/8 px-2.5 py-1 text-xs font-medium text-[#e8dcfb] backdrop-blur-sm">
            {visibilityLabel}
          </span>
        )}
        {category && (
          <span className="inline-block rounded-full border border-white/14 bg-white/8 px-2.5 py-1 text-xs font-medium text-[#e8dcfb] backdrop-blur-sm">
            {category}
          </span>
        )}
        {location && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/8 px-2.5 py-1 text-xs text-[#eedffc] backdrop-blur-sm">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {location}
          </span>
        )}
      </div>
    </article>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
