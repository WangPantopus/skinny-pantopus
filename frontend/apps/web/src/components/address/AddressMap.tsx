'use client';

/**
 * AddressMap — Small Leaflet map preview with a pin at the given coordinates.
 *
 * Must be loaded with `dynamic(() => import('./AddressMap'), { ssr: false })`
 * to avoid "window is not defined" during SSR.
 */

import 'leaflet/dist/leaflet.css';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { TILE_URL, TILE_ATTRIBUTION } from '../map/constants';

type Props = {
  lat: number;
  lng: number;
  zoom?: number;
  height?: number;
};

// Custom pin icon (matches the codebase DashboardMap style)
const pinIcon = L.divIcon({
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  html: `
    <div style="
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 20px;
        height: 20px;
        border-radius: 9999px;
        background: #0ea5e9;
        border: 3px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      "></div>
    </div>
  `,
});

export default function AddressMap({ lat, lng, zoom = 16, height = 180 }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      style={{ height, width: '100%' }}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
      <Marker position={[lat, lng]} icon={pinIcon} />
    </MapContainer>
  );
}
