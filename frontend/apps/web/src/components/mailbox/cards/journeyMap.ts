// The travelling card's journey map (docs/product/travelling-card-2026-11-21, Part 5), drawn as sample/page.html's
// map() draws it: the states' outlines (usStates.json), the states it reached filled in gold, a dotted curve from each
// stop to the stop it came from, a dot at every town, a ring round each town holding the card now, and the first town
// and the newest named. One SVG string, for the journey page and its link preview picture alike. Towns and dates only.

import type { CardJourney, CardJourneyStop } from '@pantopus/api';
import { albersUsa } from './albersUsa';
import STATES from './usStates.json';

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Tampa, FL" ("Abroad" has no state). */
export const stopLabel = (stop: Pick<CardJourneyStop, 'town' | 'state'>) => (stop.state ? `${stop.town}, ${stop.state}` : stop.town);

/** Straight-line miles between two town centres, as the server counts them. */
export function legMiles(a: CardJourneyStop | undefined, b: CardJourneyStop): number {
  if (!a || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return 0;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return Math.round(2 * 3958.8 * Math.asin(Math.sqrt(h)));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Dec 1" from 2026-12-01. */
export function stopDay(on: string): string {
  const [, m, d] = String(on || '').split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : '';
}

type Point = { x: number; y: number };
const pointOf = (stop: CardJourneyStop): Point | null => {
  if (stop.lat == null || stop.lon == null) return null;
  const [x, y] = albersUsa(stop.lon, stop.lat, stop.state);
  return { x: Math.round(x), y: Math.round(y) };
};

/** The map as an SVG string, 975 x 610 (`size` sets its drawn width, for the picture). */
export function journeyMapSvg(journey: Pick<CardJourney, 'stops' | 'state_codes'>, { labels = true, width }: { labels?: boolean; width?: number } = {}): string {
  const on = new Set(journey.state_codes);
  const points = journey.stops.map(pointOf);
  let route = '';
  journey.stops.forEach((stop, i) => {
    if (stop.from == null) return;
    const a = points[stop.from];
    const b = points[i];
    if (!a || !b) return;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    route += `M${a.x},${a.y}Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 - d * 0.2} ${b.x},${b.y}`;
  });
  const newest = journey.stops.length - 1;
  const dots = points.map((p, i) => (p ? `<circle class="dot" cx="${p.x}" cy="${p.y}" r="${i === newest ? 12 : 9}"/>` : '')).join('');
  const rings = points.map((p, i) => (p && journey.stops[i].holding ? `<circle class="ring" cx="${p.x}" cy="${p.y}" r="25"/>` : '')).join('');
  const label = (i: number) => {
    const p = points[i];
    if (!p) return '';
    const right = p.x > 760;
    return `<text class="lbl" x="${p.x + (right ? -20 : 20)}" y="${p.y + (p.y > 520 ? -22 : 40)}" text-anchor="${right ? 'end' : 'start'}">${esc(journey.stops[i].town)}</text>`;
  };
  const named = labels ? `${label(0)}${newest > 0 ? label(newest) : ''}` : '';
  const states = Object.entries(STATES as Record<string, string>)
    .map(([code, d]) => `<path d="${d}"${on.has(code) ? ' class="on"' : ''}/>`).join('');
  const towns = journey.stops.map(stopLabel).join(', ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 975 610"${width ? ` width="${width}" height="${Math.round((width * 610) / 975)}"` : ''} role="img" aria-label="${esc(`Map of the United States with the card’s route through ${towns}`)}">`
    + '<style>.st path{fill:rgba(244,233,214,.06);stroke:rgba(244,233,214,.26);stroke-width:1.4;stroke-linejoin:round}'
    + '.st path.on{fill:rgba(220,185,108,.34);stroke:rgba(220,185,108,.7)}'
    + '.route{fill:none;stroke:#dcb96c;stroke-width:5;stroke-linecap:round;stroke-dasharray:1 12}'
    + '.dot{fill:#dcb96c;stroke:#17110c;stroke-width:3}.ring{fill:none;stroke:#dcb96c;stroke-width:3;opacity:.55}'
    + '.lbl{font:600 30px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#f4ecdd;paint-order:stroke;stroke:#17110c;stroke-width:7px;stroke-linejoin:round}</style>'
    + `<g class="st">${states}</g><path class="route" d="${route}"/>${dots}${rings}${named}</svg>`;
}

/** "10 days on the road." (a journey's first day reads as one). */
export function daysLine(days: number): string {
  const n = Math.max(1, days);
  return `${n} ${n === 1 ? 'day' : 'days'} on the road. Towns and dates only: no names, no addresses, no notes.`;
}
