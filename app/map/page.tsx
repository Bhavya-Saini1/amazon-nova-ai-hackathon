import { AppHeader } from '@/components/AppHeader';
import { CommunityTabs } from '@/components/CommunityTabs';
import { MapContainer } from '@/components/MapContainer';

export default function MapPage() {
  return (
    <div className="brand-app-shell">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <section className="brand-surface mb-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 text-center sm:text-left">
            <div className="inline-flex w-fit items-center self-center rounded-full border border-[#e6d9f2] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#8c72b4] sm:self-start">
              Safety visualization
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#241735]">
                Community Safety Map
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6d6282] sm:text-base">
                This map will display safety reports and alerts in your area.
              </p>
            </div>
          </div>
        </section>

        <CommunityTabs activeTab="map" />

        <div className="flex justify-center">
          <MapContainer />
        </div>
      </main>
    </div>
  );
}