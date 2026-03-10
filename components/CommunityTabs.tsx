'use client';

import Link from 'next/link';

type CommunityTab = 'trending' | 'near-me' | 'following' | 'map';

interface CommunityTabsProps {
  activeTab: CommunityTab;
  onTabChange?: (tab: Extract<CommunityTab, 'trending' | 'near-me'>) => void;
}

export function CommunityTabs({ activeTab, onTabChange }: CommunityTabsProps) {
  return (
    <div className="brand-tabs-shell mb-6 flex gap-3">
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

      <Link href="/following" className={activeTab === 'following' ? 'brand-tab-active' : 'brand-tab-idle'}>
        Following
      </Link>

      <Link href="/map" className={activeTab === 'map' ? 'brand-tab-active' : 'brand-tab-idle'}>
        Map
      </Link>
    </div>
  );
}