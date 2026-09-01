'use client';

import 'leaflet/dist/leaflet.css';

import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { TILE_URL, TILE_ATTRIBUTION } from './map/constants';

type Bounds = { south: number; west: number; north: number; east: number };

function CenterWatcher({ onCenter }: { onCenter: (c: [number, number]) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onCenter([c.lat, c.lng]);
    },
    zoomend(e) {
      const c = e.target.getCenter();
      onCenter([c.lat, c.lng]);
    }
  });
  return null;
}

function BoundsWatcher({ onBounds }: { onBounds: (b: Bounds) => void }) {
  useMapEvents({
    load(e) {
      const b = e.target.getBounds();
      onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    },
    moveend(e) {
      const b = e.target.getBounds();
      onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    },
    zoomend(e) {
      const b = e.target.getBounds();
      onBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    }
  });
  return null;
}

function makePinIcon(g: Record<string, any>) {
  const title = (g?.title ?? '').toString().trim();
  const initial = title ? title[0].toUpperCase() : '•';

  const safe = initial.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <div style="
      width:30px;
      height:30px;
      border-radius:9999px;
      background:#111827;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      border:2px solid #fff;
      box-shadow:0 6px 18px rgba(0,0,0,.22);
      transform: translate(-50%, -50%);
      ">
      ${safe}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'pantopus-pin',
    iconSize: [1, 1],
    iconAnchor: [0, 0]
  });
}

export default function DashboardMap({
  center,
  gigs,
  onCenter,
  onBounds,
  onSelectGig
}: {
  center: [number, number];
  gigs: Record<string, any>[];
  onCenter: (c: [number, number]) => void;
  onBounds: (b: Bounds) => void;
  onSelectGig: (id: string) => void;
}) {
  return (
    <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />

      <BoundsWatcher onBounds={onBounds} />
      <CenterWatcher onCenter={onCenter} />

      {gigs
        .filter((g) => {
          const loc = g.location as Record<string, any> | undefined;
          return (g.latitude != null && g.longitude != null) || (loc?.lat != null && loc?.lng != null);
        })
        .slice(0, 200)
        .map((g) => {
          const loc = g.location as Record<string, any> | undefined;
          const lat = (g.latitude ?? loc?.lat) as number | undefined;
          const lng = (g.longitude ?? loc?.lng) as number | undefined;
          if (lat == null || lng == null) return null;

          return (
            <Marker key={g.id} position={[lat, lng]} icon={makePinIcon(g)}>
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{g.title || 'Task'}</div>
                  {g.price != null ? <div className="text-sm text-app-text-strong">${g.price}</div> : null}
                  <button className="text-sm text-blue-600 hover:underline" onClick={() => onSelectGig(String(g.id))}>
                    View details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
