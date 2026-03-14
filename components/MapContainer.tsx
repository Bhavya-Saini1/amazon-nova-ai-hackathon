'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MISSING_TOKEN_MSG =
  'Missing Mapbox access token. ' +
  'Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.';

export function MapContainer() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasToken = useMemo(() => Boolean(MAPBOX_TOKEN), []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!hasToken) {
      setError(MISSING_TOKEN_MSG);
      return;
    }

    if (mapRef.current) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initializeMap = (geojson: any) => {
      const defaultCenter: [number, number] =
        geojson?.defaultCenter ?? [-98.5795, 39.8283];
      const defaultZoom: number =
        typeof geojson?.defaultZoom === 'number' ? geojson.defaultZoom : 3;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: defaultCenter,
        zoom: defaultZoom,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.on('load', () => {
        if (!map.getSource('reports')) {
          map.addSource('reports', {
            type: 'geojson',
            data: geojson,
          });

          map.addLayer({
            id: 'reports-heat',
            type: 'heatmap',
            source: 'reports',
            maxzoom: 18, // Allow heatmap at higher zoom levels for city viewing
            paint: {
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'severity'],
                1,
                0,
                10,
                1,
              ],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 20, 3],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(0,0,255,0)',
                0.25,
                'green',
                0.5,
                'yellow',
                0.75,
                'orange',
                1,
                'red',
              ],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 12, 8], // Smaller radius at high zoom for city detail
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 16, 0.6], // Keep visible longer at high zoom
            },
          });
        } else {
          (map.getSource('reports') as mapboxgl.GeoJSONSource).setData(geojson);
        }
      });
    };

    const loadData = async () => {
      try {
        const res = await fetch('/api/map');
        if (!res.ok) throw new Error(`Failed to load map data: ${res.status}`);

        const geojson = await res.json();

        if (!mapContainerRef.current) return;

        initializeMap(geojson);
      } catch (err) {
        console.error(err);
        setError('Unable to load map data.');
      }
    };

    loadData();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasToken]);

  return (
    <section className="brand-glass-surface mx-auto flex min-h-[340px] w-full max-w-4xl flex-col items-center justify-center border border-dashed border-white/14 px-6 py-10 text-center sm:min-h-[420px] sm:px-10">
      <div className="brand-page-pill mb-4 inline-flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em]">
        Live safety heatmap
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Community safety visualization
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#d8cfee] sm:text-base">
        View safety reports by severity on the heatmap below. Use the map controls to zoom and pan.
      </p>

      <div className="relative mt-8 h-[520px] w-full overflow-hidden rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
        <div ref={mapContainerRef} className="h-full w-full" />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-4 text-center text-sm font-semibold text-white">
            <div>{error}</div>
            <div className="text-xs text-white/70">
              Ensure <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> is set and that the API is reachable.
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
