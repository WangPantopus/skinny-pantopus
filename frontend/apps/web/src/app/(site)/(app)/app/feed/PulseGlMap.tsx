'use client';

// The Pulse map in 3D (founder request 2026-10-22, spec §4): Mapbox GL JS with the Mapbox Standard
// style (3D buildings, trees and terrain, day light, no point-of-interest labels), opened tilted
// after a short fly-in, with rotate and tilt gestures on. Its pins and clusters are the flat map's
// (./pulseMapPins.ts) on GL markers, and its popup is the same card.
//
// FeedMap loads this module lazily, so mapbox-gl and its CSS are fetched only for the Pulse map,
// and falls back to its Leaflet map when this reports the 3D map unavailable: no WebGL 2, or a
// style that errors or hasn't loaded within 8 s.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapMarker } from '@pantopus/api';
import { MapSkeleton } from '@/components/map/MapSkeleton';
import type { PulseCamera, PulseMarker, PulseView } from './pulseMapView';

const STYLE_URL = 'mapbox://styles/mapbox/standard';
/** The tilt it opens with and keeps across the map's own moves (people can flatten it). */
const OPEN_PITCH = 50;
const STYLE_TIMEOUT_MS = 8000;
/** The opening fly-in: from higher and flatter to the tilted view. */
const FLY_IN_MS = 1200;
const FLY_IN_ZOOM_OUT = 1.5;
/** A press that moved further than this was a drag of the map, not a tap on the pin. */
const TAP_SLOP_PX = 6;

// GL zooms are on 512 px tiles, one level below Leaflet's for the same scale; FeedMap speaks Leaflet's.
const toGlZoom = (zoom: number) => zoom - 1;
const fromGlZoom = (zoom: number) => zoom + 1;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface PulseGlMapProps {
  token: string;
  /** Where it opens: [lat, lng], and the zoom (Leaflet scale). */
  center: [number, number];
  zoom: number;
  markers: PulseMarker[];
  onMarkerClick: (id: string) => void;
  /** The post whose card is open, if any. */
  popupPin: MapMarker | null;
  renderPopup: (pin: MapMarker) => ReactNode;
  onPopupClosed: (pinId: string) => void;
  /** An opened card is panned to sit at least this far below the map's top (the header). */
  popupTopPadding: number;
  onView: (view: PulseView) => void;
  /** A person's one-finger (or mouse) pan: the content moved by (dx, dy) screen px. */
  onUserPanStart?: () => void;
  onUserPan?: (dx: number, dy: number) => void;
  cameraRef: RefObject<PulseCamera | null>;
  /** The 3D map can't be shown here: FeedMap switches to the flat map. */
  onUnavailable: (reason: string) => void;
  reducedMotion: boolean;
}

interface MarkerEntry {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
  inner: HTMLDivElement;
  lat: number;
  lng: number;
  html: string;
  label: string;
  animCls: string;
}

function readView(map: mapboxgl.Map): PulseView | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  const center = map.getCenter();
  const container = map.getContainer();
  return {
    bounds: { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() },
    zoom: fromGlZoom(map.getZoom()),
    center: { lat: center.lat, lng: center.lng },
    size: { w: container.clientWidth, h: container.clientHeight },
  };
}

/** Mapbox popups don't pan into view: move the map so the card clears the header and the sides. */
function panIntoView(map: mapboxgl.Map, card: HTMLElement, topPadding: number) {
  const box = map.getContainer().getBoundingClientRect();
  const rect = card.getBoundingClientRect();
  const top = rect.top - box.top;
  const left = rect.left - box.left;
  const right = rect.right - box.left;
  const dy = top < topPadding ? top - topPadding : 0;
  const dx = left < 12 ? left - 12 : right > box.width - 12 ? right - (box.width - 12) : 0;
  if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 300 });
}

export default function PulseGlMap(props: PulseGlMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const entries = useRef(new Map<string, MarkerEntry>());

  // ─── The map: created once ─────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const { token, center, zoom, cameraRef } = latest.current;
    const reducedMotion = latest.current.reducedMotion
      || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let gaveUp = false;
    const giveUp = (reason: string) => {
      if (gaveUp) return;
      gaveUp = true;
      latest.current.onUnavailable(reason);
    };
    if (!token || !mapboxgl.supported()) {
      giveUp('unsupported');
      return undefined;
    }

    let instance: mapboxgl.Map;
    try {
      instance = new mapboxgl.Map({
        container,
        accessToken: token,
        style: STYLE_URL,
        config: { basemap: { lightPreset: 'day', showPointOfInterestLabels: false } },
        center: [center[1], center[0]],
        // Reduce Motion opens on the tilted view; otherwise the fly-in starts higher and flatter.
        zoom: toGlZoom(zoom) - (reducedMotion ? 0 : FLY_IN_ZOOM_OUT),
        pitch: reducedMotion ? OPEN_PITCH : 0,
        bearing: 0,
        performanceMetricsCollection: false,
      });
    } catch {
      giveUp('init');
      return undefined;
    }

    // A compass that shows the tilt and turns it back north (clear of My location and the cards).
    instance.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-left');

    let styleLoaded = false;
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!styleLoaded) giveUp('timeout');
    }, STYLE_TIMEOUT_MS);
    // Before the style is in, an error is the style's (token, network): show the flat map instead.
    instance.on('error', () => {
      if (!styleLoaded) giveUp('style');
    });

    // Views are reported once the opening move has settled, then after each move.
    let reportTimer = 0;
    const report = () => {
      const view = readView(instance);
      if (view) latest.current.onView(view);
    };
    instance.on('moveend', () => {
      if (!settled) return;
      window.clearTimeout(reportTimer);
      reportTimer = window.setTimeout(report, 250);
    });
    instance.on('resize', () => {
      if (settled) report();
    });

    // A person's pan, for the header's quick return. Drag events come from pointer pans only
    // (not the wheel, the keyboard or the map's own moves); two fingers are a pinch, not a scroll.
    let panAnchor: mapboxgl.LngLat | null = null;
    let panLast = { x: 0, y: 0 };
    const restartPan = () => {
      panAnchor = instance.getCenter();
      const point = instance.project(panAnchor);
      panLast = { x: point.x, y: point.y };
      latest.current.onUserPanStart?.();
    };
    instance.on('dragstart', (e) => {
      if (e.originalEvent) restartPan();
    });
    instance.on('drag', (e) => {
      const event = e.originalEvent;
      if (!event || !panAnchor) return;
      if ('touches' in event && event.touches.length > 1) {
        restartPan();
        return;
      }
      const point = instance.project(panAnchor);
      latest.current.onUserPan?.(point.x - panLast.x, point.y - panLast.y);
      panLast = { x: point.x, y: point.y };
    });
    instance.on('dragend', () => {
      panAnchor = null;
    });

    instance.once('style.load', () => {
      styleLoaded = true;
      window.clearTimeout(timeout);
      if (gaveUp) return;
      cameraRef.current = {
        flyTo: (lat, lng, targetZoom, durationSec, onEnd) => {
          instance.flyTo({ center: [lng, lat], zoom: toGlZoom(targetZoom), duration: durationSec * 1000 });
          if (!onEnd) return;
          // With Reduce Motion the move is a jump that has already ended.
          if (instance.isMoving()) {
            instance.once('moveend', () => {
              const view = readView(instance);
              if (view) onEnd(view);
            });
          } else {
            const view = readView(instance);
            if (view) onEnd(view);
          }
        },
        fitBounds: (b, paddingPx) => {
          instance.fitBounds([[b.west, b.south], [b.east, b.north]], {
            padding: paddingPx,
            pitch: instance.getPitch(),
            bearing: instance.getBearing(),
            duration: 800,
          });
        },
      };
      setMap(instance);
      const settle = () => {
        if (settled) return;
        settled = true;
        report();
      };
      // The area may have come in while the style loaded.
      const [lat, lng] = latest.current.center;
      if (reducedMotion) {
        instance.jumpTo({ center: [lng, lat], zoom: toGlZoom(zoom), pitch: OPEN_PITCH });
        settle();
        return;
      }
      // The fly-in is the map's own move: it raises no "Search this area" and leaves the header be.
      instance.easeTo({
        center: [lng, lat],
        zoom: toGlZoom(zoom),
        pitch: OPEN_PITCH,
        duration: FLY_IN_MS,
        easing: easeOutCubic,
      });
      // (A move that ended at once, as a reduced-motion jump does, has nothing to wait for.)
      if (instance.isMoving()) instance.once('moveend', settle);
      else settle();
    });

    const markerEntries = entries.current;
    return () => {
      // Events from a map being taken down (an aborted style request) say nothing about the next one.
      gaveUp = true;
      window.clearTimeout(timeout);
      window.clearTimeout(reportTimer);
      if (cameraRef.current) cameraRef.current = null;
      markerEntries.clear();
      setMap(null);
      instance.remove();
    };
  }, []);

  // ─── Pins and clusters ─────────────────────────────────────
  const { markers } = props;
  useEffect(() => {
    if (!map) return;
    const shown = new Set<string>();
    for (const m of markers) {
      shown.add(m.id);
      let entry = entries.current.get(m.id);
      if (!entry) {
        const el = document.createElement('div');
        el.className = 'pulse-gl-marker';
        // Set before the Marker exists, which would otherwise name it "Map marker" (an img).
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', m.label);
        el.tabIndex = 0;
        const inner = document.createElement('div');
        el.appendChild(inner);
        const id = m.id;
        let pressedAt: { x: number; y: number } | null = null;
        el.addEventListener('pointerdown', (e) => {
          pressedAt = { x: e.clientX, y: e.clientY };
        });
        el.addEventListener('click', (e) => {
          // Not a map click (that closes the open card).
          e.stopPropagation();
          if (pressedAt && Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) > TAP_SLOP_PX) return;
          latest.current.onMarkerClick(id);
        });
        el.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          latest.current.onMarkerClick(id);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map);
        entry = { marker, el, inner, lat: m.lat, lng: m.lng, html: '', label: '', animCls: '' };
        entries.current.set(m.id, entry);
      } else if (entry.lat !== m.lat || entry.lng !== m.lng) {
        entry.marker.setLngLat([m.lng, m.lat]);
        entry.lat = m.lat;
        entry.lng = m.lng;
      }
      // The pin itself is redrawn only when its look changes, so halos and pops don't restart.
      if (entry.animCls !== m.animCls) {
        entry.inner.className = m.animCls;
        entry.animCls = m.animCls;
      }
      if (entry.html !== m.html) {
        entry.inner.innerHTML = m.html;
        entry.html = m.html;
      }
      if (entry.label !== m.label) {
        entry.el.setAttribute('aria-label', m.label);
        entry.label = m.label;
      }
      entry.el.style.zIndex = m.selected ? '2' : '';
      entry.el.classList.toggle('pulse-gl-marker--exiting', m.exiting);
    }
    for (const [id, entry] of entries.current) {
      if (shown.has(id)) continue;
      entry.marker.remove();
      entries.current.delete(id);
    }
  }, [map, markers]);

  // ─── The open post's card ─────────────────────────────────
  const [popupNode, setPopupNode] = useState<HTMLDivElement | null>(null);
  const popupPinId = props.popupPin?.id ?? null;
  useEffect(() => {
    const pin = latest.current.popupPin;
    if (!map || !pin) return undefined;
    const node = document.createElement('div');
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: true,
      anchor: 'bottom',
      offset: 20,
      maxWidth: 'none',
      className: 'pulse-gl-popup',
      focusAfterOpen: false,
    })
      .setLngLat([pin.longitude, pin.latitude])
      .setDOMContent(node)
      .addTo(map);
    let removing = false;
    popup.on('close', () => {
      if (!removing) latest.current.onPopupClosed(pin.id);
    });
    setPopupNode(node);
    return () => {
      removing = true;
      popup.remove();
      setPopupNode(null);
    };
  }, [map, popupPinId]);

  // Once the card has rendered into the popup, bring it clear of the header.
  useEffect(() => {
    if (!map || !popupNode) return undefined;
    const frame = requestAnimationFrame(() => panIntoView(map, popupNode, latest.current.popupTopPadding));
    return () => cancelAnimationFrame(frame);
  }, [map, popupNode]);

  return (
    <div className="absolute inset-0">
      {/* mapbox-gl.css makes the map element position: relative, so it fills this box instead. */}
      <div ref={containerRef} className="h-full w-full" />
      {!map && (
        <div className="absolute inset-0 z-[1]">
          <MapSkeleton />
        </div>
      )}
      {popupNode && props.popupPin && createPortal(props.renderPopup(props.popupPin), popupNode)}
    </div>
  );
}
