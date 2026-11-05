'use client';

// ============================================================
// The Nearby window (Wedge v2 §4): verified households by block cell,
// around the viewer's place. Alive from the first minute — an empty
// grid is still a map of where you are — and safe by construction: the
// server sends a floored bucket per ~1 km cell and nothing else. Nobody's
// home, including yours, is a point on this map.
// ============================================================

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Rectangle } from 'react-leaflet';
import type { NeighborhoodCells } from '@pantopus/api';
import { TILE_URL, TILE_ATTRIBUTION } from '@/components/map/constants';
import { cellStyle, LEGEND_ORDER, CELLS_ZOOM } from './nearbyCells';

export default function NearbyCellsMap({ cells }: { cells: NeighborhoodCells }) {
  if (cells.state !== 'ready' || !cells.center) return null;
  return (
    <section aria-label="Verified households nearby" className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      <div className="h-[240px] w-full">
        <MapContainer
          center={[cells.center.lat, cells.center.lng]}
          zoom={CELLS_ZOOM}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          {cells.cells.map((c) => (
            <Rectangle key={c.geohash} bounds={c.bounds} pathOptions={cellStyle(c.bucket, c.is_home)} />
          ))}
        </MapContainer>
      </div>
      <div className="px-4 py-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
          {LEGEND_ORDER.map((b) => {
            const st = cellStyle(b, false);
            return (
              <li key={b} className="flex items-center gap-1.5 text-[12px] text-app-text-secondary">
                <span
                  aria-hidden="true"
                  className="inline-block w-3 h-3 rounded-[3px] border"
                  style={{ backgroundColor: st.fillColor, opacity: Math.max(0.25, st.fillOpacity + 0.2), borderColor: st.color }}
                />
                {cells.buckets[b]}
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[12px] text-app-text-muted">
          Cells, not rooftops: about a kilometre each, shaded by how many households have verified. Your cell is outlined. No home is ever a dot.
        </p>
      </div>
    </section>
  );
}
