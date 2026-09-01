import { useMemo, useRef } from 'react';
import Supercluster from 'supercluster';

/**
 * Generic supercluster hook for Leaflet-based maps.
 *
 * Accepts an array of items with lat/lng, the current map zoom,
 * and returns clustered features ready for rendering.
 */

export interface ClusterPoint<T> {
  /** Unique key for React */
  id: string;
  latitude: number;
  longitude: number;
  /** Number of points in this cluster (1 = individual item) */
  count: number;
  isCluster: boolean;
  /** The expansion zoom level — pass to map.flyTo when user clicks a cluster */
  expansionZoom: number | null;
  /** Original item (only set when isCluster === false) */
  item: T | null;
  /** All items in this cluster (always set) */
  items: T[];
  /** Internal supercluster cluster_id for getClusterExpansionZoom */
  _clusterId: number | null;
}

interface UseClusterOptions {
  /** Cluster radius in pixels. Default: 60 */
  radius?: number;
  /** Max zoom to cluster at. Default: 16 */
  maxZoom?: number;
  /** Min zoom for the index. Default: 0 */
  minZoom?: number;
}

export function useCluster<T extends { latitude: number; longitude: number; id?: string | number }>(
  items: T[],
  zoom: number,
  bounds: { south: number; west: number; north: number; east: number } | null,
  options?: UseClusterOptions,
): ClusterPoint<T>[] {
  const { radius = 60, maxZoom = 16, minZoom = 0 } = options ?? {};

  // Build supercluster index (recompute only when items change)
  const indexRef = useRef<Supercluster<{ index: number }, Supercluster.AnyProps> | null>(null);
  const prevItemsRef = useRef<T[]>([]);

  const index = useMemo(() => {
    // Only rebuild when items array identity changes
    const sc = new Supercluster<{ index: number }, Supercluster.AnyProps>({
      radius,
      maxZoom,
      minZoom,
    });

    const points: Supercluster.PointFeature<{ index: number }>[] = items
      .map((item, i) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          type: 'Feature' as const,
          properties: { index: i },
          geometry: {
            type: 'Point' as const,
            coordinates: [lng, lat], // GeoJSON is [lng, lat]
          },
        };
      })
      .filter((f): f is Supercluster.PointFeature<{ index: number }> => f !== null);

    sc.load(points);
    prevItemsRef.current = items;
    indexRef.current = sc;
    return sc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, radius, maxZoom, minZoom]);

  // Query clusters for current viewport
  return useMemo(() => {
    if (!bounds || items.length === 0) return [];

    const bbox: GeoJSON.BBox = [
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ];

    const clusters = index.getClusters(bbox as [number, number, number, number], Math.floor(zoom));
    const result: ClusterPoint<T>[] = [];

    for (const feature of clusters) {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties as Record<string, any>;

      if (props.cluster) {
        const clusterId = props.cluster_id;
        let expansionZoom: number | null = null;
        try {
          expansionZoom = index.getClusterExpansionZoom(clusterId);
        } catch {
          // Ignore if cluster ID is invalid
        }

        const leaves = index.getLeaves(clusterId, Infinity);
        const clusterItems = leaves.map((leaf) => items[leaf.properties.index]);

        result.push({
          id: `cluster-${clusterId}`,
          latitude: lat,
          longitude: lng,
          count: props.point_count,
          isCluster: true,
          expansionZoom,
          item: null,
          items: clusterItems,
          _clusterId: clusterId,
        });
      } else {
        const originalItem = items[props.index];
        const itemId = originalItem?.id ?? props.index;
        result.push({
          id: `point-${itemId}`,
          latitude: lat,
          longitude: lng,
          count: 1,
          isCluster: false,
          expansionZoom: null,
          item: originalItem,
          items: [originalItem],
          _clusterId: null,
        });
      }
    }

    return result;
  }, [index, bounds, zoom, items]);
}
