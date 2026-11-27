'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const MISSING_TOKEN_MSG =
  'Missing Mapbox access token. ' +
  'Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.';

const HEAT_LAYER_ID = 'reports-heat';

export interface MapContainerHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  filterByCategory: (category: string) => void;
}

export const MapContainer = forwardRef<MapContainerHandle>(
  function MapContainer(_props, ref) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const pendingFlyToRef = useRef<{ lat: number; lng: number; zoom: number } | null>(
      null
    );
    const [error, setError] = useState<string | null>(null);

    const hasToken = useMemo(() => Boolean(MAPBOX_TOKEN), []);

    const runFlyTo = (lat: number, lng: number, zoom = 14) => {
      const safeZoom = Number.isFinite(zoom) ? Math.min(Math.max(zoom, 10), 17) : 14;
      const map = mapRef.current;
      if (!map) {
        pendingFlyToRef.current = { lat, lng, zoom: safeZoom };
        return;
      }

      const fly = () => {
        map.flyTo({
          center: [lng, lat],
          zoom: safeZoom,
          pitch: safeZoom >= 14.5 ? 50 : 40,
          essential: true,
          speed: 1.15,
        });
      };

      if (map.isStyleLoaded()) {
        fly();
      } else {
        pendingFlyToRef.current = { lat, lng, zoom: safeZoom };
        map.once('load', () => {
          const pending = pendingFlyToRef.current;
          if (!pending || !mapRef.current) return;
          pendingFlyToRef.current = null;
          mapRef.current.flyTo({
            center: [pending.lng, pending.lat],
            zoom: pending.zoom,
            pitch: pending.zoom >= 14.5 ? 50 : 40,
            essential: true,
            speed: 1.15,
          });
        });
      }
    };

    useImperativeHandle(ref, () => ({
      flyTo(lat: number, lng: number, zoom = 14) {
        runFlyTo(lat, lng, zoom);
      },
      filterByCategory(category: string) {
        if (!mapRef.current) return;
        if (category === 'All') {
          mapRef.current.setFilter(HEAT_LAYER_ID, null);
        } else {
          mapRef.current.setFilter(HEAT_LAYER_ID, [
            'in',
            category,
            ['get', 'categories'],
          ]);
        }
      },
    }));

    useEffect(() => {
      if (!mapContainerRef.current) return;

      if (!hasToken) {
        setError(MISSING_TOKEN_MSG);
        return;
      }

      if (mapRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const initializeMap = (
        geojson: GeoJSON.FeatureCollection & {
          defaultCenter?: [number, number];
          defaultZoom?: number;
        }
      ) => {
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

            map.addLayer(
              {
                id: HEAT_LAYER_ID,
                type: 'heatmap',
                source: 'reports',
                maxzoom: 22,
                paint: {
                  'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'severity'],
                    0, 0,
                    10, 1,
                  ],
                  'heatmap-intensity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 0.8,
                    10, 2,
                    18, 3,
                  ],
                  'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(0,0,255,0)',
                    0.1, 'royalblue',
                    0.3, 'cyan',
                    0.5, 'lime',
                    0.7, 'yellow',
                    1, 'red',
                  ],
                  'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 2,
                    8, 12,
                    13, 20,
                    18, 30,
                  ],
                  'heatmap-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 0,
                    3, 0.8,
                    14, 0.75,
                    18, 0.6,
                  ],
                },
              },
              'waterway-label' // render below labels & future marker layers
            );
          } else {
            (map.getSource('reports') as mapboxgl.GeoJSONSource).setData(
              geojson
            );
          }

          const pending = pendingFlyToRef.current;
          if (pending) {
            pendingFlyToRef.current = null;
            map.flyTo({
              center: [pending.lng, pending.lat],
              zoom: pending.zoom,
              pitch: pending.zoom >= 14.5 ? 50 : 40,
              essential: true,
              speed: 1.15,
            });
          }
        });
      };

      const loadData = async () => {
        try {
          const res = await fetch('/api/map');
          if (!res.ok)
            throw new Error(`Failed to load map data: ${res.status}`);

          const geojson = await res.json();

          if (!mapContainerRef.current) return;

          initializeMap(geojson);
        } catch (err) {
          console.error(err);
          // Still show the base Mapbox map even if /api/map is unreachable.
          if (!mapContainerRef.current) {
            setError('Unable to load map data. Check /api/map and Mapbox token.');
            return;
          }
          initializeMap({
            type: 'FeatureCollection',
            features: [],
            defaultCenter: [-79.6441, 43.589],
            defaultZoom: 12.5,
          });
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
          View safety reports by severity on the heatmap below. Use the map
          controls to zoom and pan.
        </p>

        <div className="relative mt-8 h-[520px] w-full overflow-hidden rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
          <div ref={mapContainerRef} className="h-full w-full" />
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-4 text-center text-sm font-semibold text-white">
              <div>{error}</div>
              <div className="text-xs text-white/70">
                Ensure <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> is set and
                that the API is reachable.
              </div>
            </div>
          ) : null}
        </div>
      </section>
    );
  }
);
