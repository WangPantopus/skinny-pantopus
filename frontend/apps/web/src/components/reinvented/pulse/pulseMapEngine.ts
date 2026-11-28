'use client';

// The map under the Pulse board (PulseMap.tsx): Mapbox GL on today's basemap with the globe, as today's Moments, Pulse
// and Plans maps have it, so zoomed all the way out the Earth is a globe; or, where WebGL, the map key or the basemap
// isn't there, the flat Leaflet map the board was first built on. Both speak Leaflet's zoom scale (GL's is one lower,
// on 512-pixel tiles) and keep north up, so the shadows worked out from the sun stay true.
// Leaflet touches `window` at import: like PulseMap, this file is loaded only through next/dynamic with `ssr: false`.

import L from 'leaflet';
import type { GeoJSONSource, Map as GlMap, Marker as GlMarker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/map/leaflet-setup';
import { MAP_PUBLIC_TOKEN, MAPBOX_STANDARD, MAP_STYLE_TIMEOUT_MS, RETINA_TILE_URL, TILE_ATTRIBUTION } from '@/components/map/constants';
import { createCachedTileLayer } from '@/components/map/CachedTileLayer';
import type { Box, Point } from './listApi';
import type { MapLight } from './mapLight';

export interface Spot {
  x: number;
  y: number;
}

/** One thing drawn at a point: a pin, a ticket or a place sound's mark. */
export interface Mark {
  point: Point;
  el: HTMLElement;
  /** Drawn centred on the point at this size; with none, its own top left sits on the point (a ticket centres itself). */
  size: [number, number] | null;
  /** Where the point sits from the mark's top left, in pixels, when not its centre (a sound's badge sits above right). */
  anchor?: [number, number];
  className: string;
  /** Higher draws over lower. */
  z: number;
  title: string;
  onClick(): void;
}

export interface BeamLines {
  from: Point[];
  target: Point;
}

export interface Pad {
  top: number;
  bottom: number;
  side: number;
  left?: number;
}

export interface MapEngine {
  readonly kind: 'globe' | 'flat';
  center(): Point;
  /** Leaflet's scale. */
  zoom(): number;
  /** The box in view as the server takes it: inside ±90 and ±180, west before east. */
  box(): Box;
  /**
   * The box of the part of the map left open by what covers it (pixels from each edge), as the server takes it: what the
   * list follows (PHASE-6 B). The whole box when that part is too small or the globe is seen whole.
   */
  openBox(cover: { top: number; bottom: number; left: number; right: number }): Box;
  /** A point's pixel in the map, or null when it's on the far side of the globe. */
  spot(p: Point): Spot | null;
  /** `left`: more room on the left (the floating list panel on a wide screen), beside `side` on both sides. */
  fit(points: Point[], pad: Pad, maxZoom: number): void;
  show(p: Point, zoom: number): void;
  panBy(dx: number, dy: number): void;
  /** To the point, `dy` pixels above the middle and `dx` right of it; `glide` keeps the zoom. */
  flyTo(p: Point, zoom: number, dy: number, glide: boolean, dx?: number): void;
  /** Each move's end; `settle()` runs these at once (after a move made without animation). */
  onSettled(fn: () => void): void;
  /** Each move's start (a drag, a pinch, a wheel, a flight): the rail fades while the map moves (PHASE-6 A2). */
  onMoveStart(fn: () => void): void;
  settle(): void;
  onPointer(move: (s: Spot) => void, leave: () => void, click: (s: Spot) => void): () => void;
  /** Replaces what's drawn in that group. */
  draw(group: 'pins' | 'sounds', marks: Mark[]): void;
  beams(lines: BeamLines[], color: string): void;
  /** The basemap's own light on the globe; the flat map has none (its tiles are dimmed by `--rp-night` instead). */
  light(l: MapLight): void;
  resize(): void;
  remove(): void;
}

/** A box the server takes (CONTRACT 6b: inside ±90 and ±180 with west before east), from what a map shows. */
export function serverBox(south: number, west: number, north: number, east: number): Box {
  const s = Math.max(-90, south),
    n = Math.min(90, north);
  if (!(east - west < 360)) return { south: s, west: -180, north: n, east: 180 };
  // The middle brought back into ±180 (a map can be panned round the world), then the box kept inside it.
  const shift = Math.round((west + east) / 2 / 360) * 360;
  return { south: s, west: Math.max(-180, west - shift), north: n, east: Math.min(180, east - shift) };
}

/** Whether the globe can be tried here at all (a key and WebGL 2); it can still fail while loading. */
export function globePossible() {
  return !!MAP_PUBLIC_TOKEN && typeof window !== 'undefined' && typeof window.WebGL2RenderingContext !== 'undefined';
}

/** The flat map, exactly as the board first drew it. */
export function openFlat(el: HTMLElement, tiles: (missing: boolean) => void): MapEngine {
  const map = L.map(el, { zoomControl: false, minZoom: 2, maxZoom: 19, worldCopyJump: true }).setView([39.5, -98.35], 4);
  if (MAP_PUBLIC_TOKEN)
    createCachedTileLayer(RETINA_TILE_URL, TILE_ATTRIBUTION)
      .on('tileerror', () => tiles(true))
      .on('tileload', () => tiles(false))
      .addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const beamLayer = L.layerGroup().addTo(map);
  const groups = { sounds: L.layerGroup().addTo(map), pins: L.layerGroup().addTo(map) };
  return {
    kind: 'flat',
    center: () => {
      const c = map.getCenter();
      return { latitude: c.lat, longitude: c.lng };
    },
    zoom: () => map.getZoom(),
    box: () => {
      const b = map.getBounds();
      return serverBox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
    },
    openBox: (c) => {
      const size = map.getSize();
      if (size.x - c.left - c.right < 40 || size.y - c.top - c.bottom < 40) {
        const b = map.getBounds();
        return serverBox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
      }
      const a = map.containerPointToLatLng([c.left, c.top]),
        z = map.containerPointToLatLng([size.x - c.right, size.y - c.bottom]);
      return serverBox(Math.min(a.lat, z.lat), Math.min(a.lng, z.lng), Math.max(a.lat, z.lat), Math.max(a.lng, z.lng));
    },
    spot: (p) => map.latLngToContainerPoint([p.latitude, p.longitude]),
    fit: (points, pad, maxZoom) =>
      map.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)), {
        maxZoom,
        paddingTopLeft: [pad.side + (pad.left ?? 0), pad.top],
        paddingBottomRight: [pad.side, pad.bottom],
        animate: false,
      }),
    show: (p, zoom) => map.setView([p.latitude, p.longitude], zoom, { animate: false }),
    panBy: (dx, dy) => map.panBy([dx, dy], { animate: false }),
    flyTo: (p, zoom, dy, glide, dx = 0) => {
      const z = glide ? map.getZoom() : zoom;
      const at = map.unproject(map.project([p.latitude, p.longitude], z).add([-dx, dy]), z);
      if (glide) map.panTo(at, { duration: 0.45 });
      else map.flyTo(at, z, { duration: 0.6 });
    },
    onSettled: (fn) => map.on('moveend', fn),
    onMoveStart: (fn) => map.on('movestart', fn),
    settle: () => map.fire('moveend'),
    onPointer: (move, leave, click) => {
      const m = (e: L.LeafletMouseEvent) => move(e.containerPoint);
      const c = (e: L.LeafletMouseEvent) => click(e.containerPoint);
      map.on('mousemove', m).on('mouseout', leave).on('click', c);
      return () => map.off('mousemove', m).off('mouseout', leave).off('click', c);
    },
    draw: (group, marks) => {
      const layer = groups[group];
      layer.clearLayers();
      for (const mark of marks)
        L.marker([mark.point.latitude, mark.point.longitude], {
          icon: L.divIcon({
            html: mark.el,
            className: mark.className,
            iconSize: mark.size ?? undefined,
            iconAnchor: mark.anchor ?? (mark.size ? [mark.size[0] / 2, mark.size[1] / 2] : undefined),
          }),
          zIndexOffset: mark.z,
          keyboard: true,
          title: mark.title,
        })
          .on('click', () => mark.onClick())
          .addTo(layer);
    },
    beams: (lines, color) => {
      beamLayer.clearLayers();
      for (const beam of lines) {
        const to: L.LatLngTuple = [beam.target.latitude, beam.target.longitude];
        for (const f of beam.from)
          L.polyline([[f.latitude, f.longitude], to], { color, weight: 3, opacity: 0.45, interactive: false, className: 'rp-beam' }).addTo(beamLayer);
        L.circleMarker(to, { radius: 9, color, weight: 0, fillColor: color, fillOpacity: 0.35, interactive: false, className: 'rp-beam-target' }).addTo(
          beamLayer,
        );
      }
    },
    light: () => {},
    resize: () => map.invalidateSize(),
    remove: () => map.remove(),
  };
}

const BEAMS = 'rp-beams';

/**
 * The globe, on today's basemap, as today's Moments map opens it, in the light it is given (PHASE-5 D: Mapbox's own
 * dawn, day, dusk and night). Null where Mapbox GL can't run here; `failed` is called (once) when the basemap errors or
 * hasn't loaded in 8 s, and the board then draws the flat map.
 */
export async function openGlobe(el: HTMLElement, failed: () => void, firstLight: MapLight): Promise<MapEngine | null> {
  const { default: gl } = await import('mapbox-gl');
  if (!gl.supported()) return null;
  // mapbox-gl.css makes the map's own element `position: relative`, so it gets an element of its own filling the board's.
  const host = document.createElement('div');
  host.className = 'rp-globe';
  el.appendChild(host);
  let map: GlMap;
  try {
    map = new gl.Map({
      container: host,
      accessToken: MAP_PUBLIC_TOKEN,
      ...MAPBOX_STANDARD,
      // Opened in its light already, so a night map never shows a flash of day first.
      config: { basemap: { ...MAPBOX_STANDARD.config.basemap, lightPreset: firstLight } },
      center: [-98.35, 39.5],
      zoom: 3,
      projection: 'globe',
      pitch: 0,
      bearing: 0,
      minZoom: 1,
      maxZoom: 18,
      // North stays up, as on the flat map: the shadows are drawn away from the sun in screen directions.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      performanceMetricsCollection: false,
      attributionControl: true,
    });
  } catch {
    host.remove();
    return null;
  }
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');

  let loaded = false,
    gone = false,
    lit: MapLight = firstLight,
    shown: MapLight = firstLight;
  // The basemap takes a new light only once its style has loaded; asked earlier, it is set at the load.
  const applyLight = () => {
    if (!loaded || gone || lit === shown) return;
    try {
      map.setConfigProperty('basemap', 'lightPreset', lit);
      shown = lit;
    } catch {
      /* the basemap without this setting: it stays in its light */
    }
  };
  const markers: Record<'pins' | 'sounds', GlMarker[]> = { pins: [], sounds: [] };
  const settled: Array<() => void> = [];
  let beamData: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const remove = () => {
    if (gone) return;
    gone = true;
    window.clearTimeout(timer);
    for (const group of Object.values(markers)) for (const m of group) m.remove();
    map.remove();
    host.remove();
  };
  const fail = () => {
    if (loaded || gone) return;
    remove();
    failed();
  };
  const timer = window.setTimeout(fail, MAP_STYLE_TIMEOUT_MS);
  map.on('error', fail);
  const drawBeams = () => {
    if (!loaded || gone) return;
    const source = map.getSource(BEAMS) as GeoJSONSource | undefined;
    if (source) return void source.setData(beamData);
    map.addSource(BEAMS, { type: 'geojson', data: beamData });
    map.addLayer({
      id: `${BEAMS}-lines`,
      type: 'line',
      source: BEAMS,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.45, 'line-emissive-strength': 1 },
    });
    map.addLayer({
      id: `${BEAMS}-targets`,
      type: 'circle',
      source: BEAMS,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 9, 'circle-color': ['get', 'color'], 'circle-opacity': 0.35, 'circle-emissive-strength': 1 },
    });
  };
  map.once('style.load', () => {
    loaded = true;
    window.clearTimeout(timer);
    applyLight();
    drawBeams();
  });
  map.on('moveend', () => settled.forEach((fn) => fn()));

  const lngLat = (p: Point): [number, number] => [p.longitude, p.latitude];
  const room = (pad: Pad) => {
    // Mapbox refuses a fit whose padding leaves no room; the board's covers can be most of a phone's height.
    const c = map.getContainer();
    const h = Math.max(0, c.clientHeight - 40),
      w = Math.max(0, c.clientWidth - 40);
    const k = pad.top + pad.bottom > h && pad.top + pad.bottom > 0 ? h / (pad.top + pad.bottom) : 1;
    const want = pad.side * 2 + (pad.left ?? 0);
    const j = want > w && want > 0 ? w / want : 1;
    return { top: pad.top * k, bottom: pad.bottom * k, left: (pad.side + (pad.left ?? 0)) * j, right: pad.side * j };
  };
  return {
    kind: 'globe',
    center: () => {
      const c = map.getCenter().wrap();
      return { latitude: c.lat, longitude: c.lng };
    },
    zoom: () => map.getZoom() + 1,
    box: () => {
      const b = map.getBounds();
      return b ? serverBox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()) : serverBox(-90, -180, 90, 180);
    },
    openBox: (c) => {
      const el = map.getContainer();
      const w = el.clientWidth,
        h = el.clientHeight;
      const b = map.getBounds();
      const whole = b ? serverBox(b.getSouth(), b.getWest(), b.getNorth(), b.getEast()) : serverBox(-90, -180, 90, 180);
      // Zoomed out to the globe, the corners can fall off the world: the whole view then.
      if (map.getZoom() < 3 || w - c.left - c.right < 40 || h - c.top - c.bottom < 40) return whole;
      const a = map.unproject([c.left, c.top]),
        z = map.unproject([w - c.right, h - c.bottom]);
      return serverBox(Math.min(a.lat, z.lat), Math.min(a.lng, z.lng), Math.max(a.lat, z.lat), Math.max(a.lng, z.lng));
    },
    spot: (p) => {
      const at = new gl.LngLat(p.longitude, p.latitude);
      const px = map.project(at);
      // Mapbox projects the far side of the globe onto pixels on the near side too (as on today's Moments map).
      if (map.getZoom() < 5 && map.unproject(px).distanceTo(at) > 1000) return null;
      return { x: px.x, y: px.y };
    },
    fit: (points, pad, maxZoom) => {
      let s = 90,
        w = 180,
        n = -90,
        e = -180;
      for (const p of points) {
        s = Math.min(s, p.latitude);
        n = Math.max(n, p.latitude);
        w = Math.min(w, p.longitude);
        e = Math.max(e, p.longitude);
      }
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { maxZoom: maxZoom - 1, padding: room(pad), animate: false },
      );
    },
    show: (p, zoom) => map.jumpTo({ center: lngLat(p), zoom: zoom - 1 }),
    panBy: (dx, dy) => map.panBy([dx, dy], { duration: 0 }),
    flyTo: (p, zoom, dy, glide, dx = 0) => {
      if (glide) map.easeTo({ center: lngLat(p), offset: [dx, -dy], duration: 450 });
      else map.flyTo({ center: lngLat(p), zoom: zoom - 1, offset: [dx, -dy], duration: 600 });
    },
    onSettled: (fn) => void settled.push(fn),
    onMoveStart: (fn) => void map.on('movestart', fn),
    settle: () => settled.forEach((fn) => fn()),
    onPointer: (move, leave, click) => {
      const m = (e: { point: Spot }) => move(e.point);
      const c = (e: { point: Spot }) => click(e.point);
      map.on('mousemove', m);
      map.on('mouseout', leave);
      map.on('click', c);
      return () => {
        map.off('mousemove', m);
        map.off('mouseout', leave);
        map.off('click', c);
      };
    },
    draw: (group, marks) => {
      for (const m of markers[group]) m.remove();
      markers[group] = marks.map((mark) => {
        const box = document.createElement('div');
        box.className = mark.className;
        if (mark.size) {
          box.style.width = `${mark.size[0]}px`;
          box.style.height = `${mark.size[1]}px`;
        }
        box.style.zIndex = String(mark.z);
        box.title = mark.title;
        box.setAttribute('aria-label', mark.title);
        box.setAttribute('role', 'button');
        box.tabIndex = 0;
        box.appendChild(mark.el);
        // The map's own click (a place sound's nearest) is for taps beside the marks, as on the flat map.
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          mark.onClick();
        });
        box.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          mark.onClick();
        });
        const anchor = mark.anchor;
        return new gl.Marker({
          element: box,
          anchor: anchor || !mark.size ? 'top-left' : 'center',
          offset: anchor ? [-anchor[0], -anchor[1]] : [0, 0],
        })
          .setLngLat(lngLat(mark.point))
          .addTo(map);
      });
    },
    beams: (lines, color) => {
      const features: GeoJSON.Feature[] = [];
      for (const beam of lines) {
        const to = lngLat(beam.target);
        for (const f of beam.from)
          features.push({ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: [lngLat(f), to] } });
        features.push({ type: 'Feature', properties: { color }, geometry: { type: 'Point', coordinates: to } });
      }
      beamData = { type: 'FeatureCollection', features };
      drawBeams();
    },
    light: (l) => {
      lit = l;
      applyLight();
    },
    resize: () => map.resize(),
    remove,
  };
}
