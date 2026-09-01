import L from 'leaflet';
import Supercluster from 'supercluster';

// ─── Generic supercluster-based clustering ────────────────────

export interface Cluster<T extends { latitude: number; longitude: number }> {
  center: [number, number]; // [lat, lng]
  items: T[];
  /** Supercluster cluster_id for getClusterExpansionZoom(). null for single items. */
  clusterId: number | null;
  /** Zoom level that will expand this cluster. null for single items. */
  expansionZoom: number | null;
}

/**
 * Supercluster-based clustering for map markers.
 * Drop-in replacement for the old grid-based algorithm.
 */
export function clusterMarkers<T extends { latitude: number; longitude: number }>(
  items: T[],
  zoom: number,
  clusterBelow = 14,
  radius = 60,
): Cluster<T>[] {
  if (items.length === 0) return [];

  if (zoom >= clusterBelow) {
    return items.map((item) => ({
      center: [item.latitude, item.longitude],
      items: [item],
      clusterId: null,
      expansionZoom: null,
    }));
  }

  const sc = new Supercluster<{ index: number }>({
    radius,
    maxZoom: clusterBelow,
    minZoom: 0,
  });

  const points: Supercluster.PointFeature<{ index: number }>[] = items
    .map((item, i) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        type: 'Feature' as const,
        properties: { index: i },
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      };
    })
    .filter((f): f is Supercluster.PointFeature<{ index: number }> => f !== null);

  sc.load(points);

  const clusters = sc.getClusters([-180, -90, 180, 90], Math.floor(zoom));
  const result: Cluster<T>[] = [];

  for (const feature of clusters) {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties as Record<string, any>;

    if (props.cluster) {
      const clusterId = props.cluster_id;
      let expansionZoom: number | null = null;
      try { expansionZoom = sc.getClusterExpansionZoom(clusterId); } catch { /* ignore */ }
      const leaves = sc.getLeaves(clusterId, Infinity);
      result.push({
        center: [lat, lng],
        items: leaves.map((leaf) => items[leaf.properties.index]),
        clusterId,
        expansionZoom,
      });
    } else {
      const original = items[props.index];
      result.push({
        center: [original.latitude, original.longitude],
        items: [original],
        clusterId: null,
        expansionZoom: null,
      });
    }
  }

  return result;
}

/**
 * Creates a circular cluster icon showing the item count.
 */
export function makeClusterIcon(count: number, color: string, animCls = ''): L.DivIcon {
  const size = count >= 50 ? 44 : count >= 10 ? 36 : 28;
  const html = `
    <div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${color};
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:${size > 36 ? 14 : 12}px;
      border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
      transform:translate(-50%,-50%);
    ">${count}</div>
  `;
  return L.divIcon({
    html,
    className: ['map-cluster-pin', animCls].filter(Boolean).join(' '),
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}
