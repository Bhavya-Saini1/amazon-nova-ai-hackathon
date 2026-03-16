'use client';

import { useCallback, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { CommunityTabs } from '@/components/CommunityTabs';
import { MapContainer, type MapContainerHandle } from '@/components/MapContainer';
import { HeraBot } from '@/components/HeraBot';

export default function MapPage() {
  const mapHandle = useRef<MapContainerHandle>(null);

  const handleFocusMap = useCallback((lat: number, lng: number) => {
    mapHandle.current?.flyTo(lat, lng);
  }, []);

  const handleFilter = useCallback((category: string) => {
    mapHandle.current?.filterByCategory(category);
  }, []);

  return (
    <div className="brand-internal-shell">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <section className="brand-glass-surface mb-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 text-center sm:text-left">
            <div className="brand-page-pill inline-flex w-fit items-center self-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] sm:self-start">
              Safety visualization
            </div>
            <div>
              <h1 className="brand-page-title text-3xl font-semibold tracking-tight">
                Community Safety Map
              </h1>
              <p className="brand-page-copy mt-3 max-w-2xl text-sm leading-7 sm:text-base">
                This map will display safety reports and alerts in your area.
              </p>
            </div>
          </div>
        </section>

        <CommunityTabs activeTab="map" />

        <div className="flex justify-center">
          <MapContainer ref={mapHandle} />
        </div>
      </main>

      <HeraBot onFocusMap={handleFocusMap} onFilter={handleFilter} />
    </div>
  );
}
