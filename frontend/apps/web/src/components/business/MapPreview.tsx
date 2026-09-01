'use client';

import 'leaflet/dist/leaflet.css';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { TILE_URL, TILE_ATTRIBUTION } from '../map/constants';

const pinIcon = L.divIcon({
  html: `
    <div style="
      width:28px;height:28px;border-radius:9999px;
      background:#7c3aed;color:#fff;display:flex;
      align-items:center;justify-content:center;
      font-weight:800;border:2px solid #fff;
      box-shadow:0 4px 12px rgba(0,0,0,.25);
      transform:translate(-50%,-50%);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>
  `,
  className: 'pantopus-pin',
  iconSize: [1, 1],
  iconAnchor: [0, 0],
});

export default function MapPreview({
  lat,
  lng,
  className = '',
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  return (
    <div className={`rounded-lg overflow-hidden ${className}`} data-testid="map-preview">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        className="h-full w-full"
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
        />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
