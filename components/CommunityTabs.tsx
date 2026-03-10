'use client';

import Link from 'next/link';

type CommunityTab = 'trending' | 'near-me' | 'map';

interface CommunityTabsProps {
  activeTab: CommunityTab;
  onTabChange?: (tab: Exclude<CommunityTab, 'map'>) => void;
}

export function CommunityTabs({ activeTab, onTabChange }: CommunityTabsProps) {
  return (
    <div className="mb-6 flex gap-3 rounded-full border border-[#eadff5] bg-white/60 p-2 backdrop-blur-xl">
      {onTabChange ? (
        <button
          type="button"
          onClick={() => onTabChange('trending')}
          className={activeTab === 'trending' ? 'brand-tab-active' : 'brand-tab-idle'}
        >
          Trending Now
        </button>
      ) : (
        <Link href="/home" className={activeTab === 'trending' ? 'brand-tab-active' : 'brand-tab-idle'}>
          Trending Now
        </Link>
      )}

      {onTabChange ? (
        <button
          type="button"
          onClick={() => onTabChange('near-me')}
          className={activeTab === 'near-me' ? 'brand-tab-active' : 'brand-tab-idle'}
        >
          Near Me
        </button>
      ) : (
        <Link href="/home?tab=near-me" className={activeTab === 'near-me' ? 'brand-tab-active' : 'brand-tab-idle'}>
          Near Me
        </Link>
      )}

      <Link href="/map" className={activeTab === 'map' ? 'brand-tab-active' : 'brand-tab-idle'}>
        Map
      </Link>
    </div>
  );
}