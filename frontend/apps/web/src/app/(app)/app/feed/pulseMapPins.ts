// Pulse map pins and cluster bubbles (founder request 2026-10-22, spec §5), as HTML for the
// map's marker elements. Styles: ./pulse.css. Colours come from the post-type palette.

import { getPostTypeConfig } from '@pantopus/ui-utils';
import type { MapMarker } from '@pantopus/api';

// SVG icon strings for the marker HTML (not React components).
// Keys use canonical PostType values only — no legacy aliases.
const POST_TYPE_SVG_ICONS: Record<string, string> = {
  ask_local: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  recommendation: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  event: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
  lost_found: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  alert: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  deal: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  local_update: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
  neighborhood_win: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  visitor_guide: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  general: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  personal_update: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  announcement: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  service_offer: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></svg>',
  resources_howto: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  progress_wins: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
};

/** A post pin's disc, in px. */
export const PIN_SIZE = 30;

/** "Live": posts created in the last 24 hours get a soft expanding ring… */
const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** …the newest of them, at most this many animated at once. */
const MAX_LIVE_HALOS = 20;

/** The ids of the posts that get the live halo: created in the last 24 h, newest first, capped. */
export function liveMarkerIds(pins: MapMarker[], now = Date.now()): Set<string> {
  const recent: { id: string; at: number }[] = [];
  for (const pin of pins) {
    const at = pin.created_at ? Date.parse(pin.created_at) : NaN;
    if (Number.isFinite(at) && at <= now + 60_000 && now - at < LIVE_WINDOW_MS) recent.push({ id: pin.id, at });
  }
  recent.sort((a, b) => b.at - a.at);
  return new Set(recent.slice(0, MAX_LIVE_HALOS).map((r) => r.id));
}

/** A post pin: its intent's colour and glyph on a disc with a white ring. */
export function pulsePinHtml(post: MapMarker, { selected = false, live = false } = {}): string {
  const postType = post.post_type || 'general';
  const { color, label } = getPostTypeConfig(postType);
  const icon = POST_TYPE_SVG_ICONS[postType] || POST_TYPE_SVG_ICONS.general;
  const classes = ['pulse-pin', selected && 'pulse-pin--selected', live && 'pulse-pin--live'].filter(Boolean).join(' ');
  // Leaflet makes the marker a keyboard button; the hidden text is its name.
  return `<div class="${classes}" style="--pin-color:${color}">${icon}<span class="sr-only">${label} post</span></div>`;
}

/** A cluster bubble's diameter: 40 px for two posts, growing on a log scale to 56 px at 100. */
export function clusterSize(count: number): number {
  const t = Math.min(1, Math.log10(Math.max(count, 1)) / 2);
  return Math.round(40 + 16 * t);
}

/** The donut ring: one segment per intent inside the cluster, in its colour, largest first. */
function clusterRing(items: (MapMarker | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const color = getPostTypeConfig(item?.post_type || 'general').color;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  const total = Math.max(items.length, 1);
  let start = 0;
  const stops: string[] = [];
  for (const [color, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const end = start + (n / total) * 360;
    stops.push(`${color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`);
    start = end;
  }
  return stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'none';
}

/** A cluster: the white count on the brand colour inside a ring of its intents. */
export function pulseClusterHtml(count: number, items: (MapMarker | null | undefined)[], { live = false } = {}): string {
  const size = clusterSize(count);
  const classes = ['pulse-cluster', live && 'pulse-cluster--live'].filter(Boolean).join(' ');
  return `<div class="${classes}" style="--cluster-size:${size}px;--cluster-ring:${clusterRing(items)}">`
    + `<span class="pulse-cluster__count" aria-hidden="true">${count}</span>`
    + `<span class="sr-only">Cluster of ${count} posts</span></div>`;
}
