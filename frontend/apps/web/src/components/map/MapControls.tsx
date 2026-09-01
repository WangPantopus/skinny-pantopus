'use client';

import { useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import { toast } from '@/components/ui/toast-store';

/** "Locate me" control — sits inside a MapContainer */
export function LocateMeButton({ className }: { className?: string }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      toast.warning('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 0.8 });
        setLocating(false);
      },
      () => {
        toast.error('Unable to get your location. Please check your browser location settings.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map]);

  return (
    <div className={className ?? 'leaflet-bottom leaflet-right'} style={{ marginBottom: 16, marginRight: 12 }}>
      <div className="leaflet-control">
        <button
          onClick={handleLocate}
          disabled={locating}
          className="bg-app-surface shadow-lg rounded-xl w-10 h-10 flex items-center justify-center border border-app-border hover:bg-app-hover transition disabled:opacity-60"
          aria-label="Go to my location"
          title="Go to my location"
        >
          {locating ? (
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M2 12h2m16 0h2m-5.636-5.636L14.95 7.778m-5.9 8.444-1.414 1.414m0-11.272L7.05 7.778m8.486 8.444 1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
