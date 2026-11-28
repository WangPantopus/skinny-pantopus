// The living map's light (Pulse, reinvented, phase 4, board B4): where the sun is over the map now, how dark it is
// there, how high a Moment floats, and the live beams (coord/CONTRACT.md §9h). The sun's place is NOAA's general solar
// position formula, the same as the server's (services/moments/sunPosition.js), so the web's shadows agree with the
// phones'. Nothing here is sent anywhere but the beams' read of the map's own box.

import { get } from '@pantopus/api/client';
import type { Box, Point } from './listApi';

export interface Sun {
  /** Clockwise from true north, 0 to 360. */
  azimuth_deg: number;
  /** Above the horizon; negative once the sun has set. */
  elevation_deg: number;
}

export function sunPosition(latitude: number, longitude: number, when = new Date()): Sun {
  const start = Date.UTC(when.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((when.getTime() - start) / 86400000) + 1;
  const hour = when.getUTCHours() + when.getUTCMinutes() / 60 + when.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const minutesFast =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const solarMinutes = hour * 60 + minutesFast + 4 * longitude;
  const hourAngle = ((solarMinutes / 4 - 180) * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const cosZenith = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const elevation = 90 - (zenith * 180) / Math.PI;
  const azimuth =
    (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)) * 180) / Math.PI + 180;
  return { azimuth_deg: ((azimuth % 360) + 360) % 360, elevation_deg: elevation };
}

/** 0 by day and 1 at night, the evening and the morning in between (the sun from 6° above the horizon to 12° below). */
export function nightOf(sun: Sun): number {
  return Math.max(0, Math.min(1, (6 - sun.elevation_deg) / 18));
}

/** The basemap's light, as Mapbox's Standard map names it. */
export type MapLight = 'day' | 'dawn' | 'dusk' | 'night';

/**
 * The map's light (PHASE-5 D): night when the browser is set to dark or the sun is more than 6° below the horizon where
 * the map is looking; dawn or dusk while it is within 6° of the horizon (morning or evening by which side of the sky
 * it is on); day otherwise.
 */
export function lightOf(sun: Sun, browserDark: boolean): MapLight {
  if (browserDark || sun.elevation_deg < -6) return 'night';
  if (sun.elevation_deg < 6) return sun.azimuth_deg < 180 ? 'dawn' : 'dusk';
  return 'day';
}

/** How far a Moment's height lifts its ring: 0 on the ground to 1 at 15,000 ft or in flight (today's Moments map's scale). */
export function liftOf(altitudeFt: number, flying: boolean): number {
  return flying ? 1 : Math.min(1, Math.sqrt(Math.max(altitudeFt, 0) / 15000));
}

/** Where a floating ring's shadow falls, in pixels from under it: away from the sun, longer as the sun is lower. */
export function shadowOf(sun: Sun, lift: number): { x: number; y: number } {
  const length = (4 + 30 * lift) * Math.max(0.55, Math.min(1.9, Math.tan(Math.PI / 6) / Math.tan((Math.max(sun.elevation_deg, 4) * Math.PI) / 180)));
  const a = (sun.azimuth_deg * Math.PI) / 180;
  return { x: -Math.sin(a) * length, y: Math.cos(a) * length };
}

/** One live beam (CONTRACT 9h): where several people's captures were all looking, and from where. */
export interface Beam {
  at: string;
  count: number;
  people: number;
  target: Point;
  from: { moment_id: string; latitude: number; longitude: number }[];
}

export function readBeams(box: Box, signal?: AbortSignal): Promise<{ beams: Beam[] }> {
  return get<{ beams: Beam[] }>('/api/reinvented/beams', { ...box }, { signal });
}

/** One place sound on the map (CONTRACT 9g): only what its author kept as place sound for people nearby. */
export interface PlaceSound {
  moment_id: string;
  latitude: number;
  longitude: number;
  url: string;
  duration_ms: number;
  at: string;
}

export function readSounds(box: Box, time: string, signal?: AbortSignal): Promise<{ sounds: PlaceSound[] }> {
  return get<{ sounds: PlaceSound[] }>('/api/reinvented/sounds', { ...box, time }, { signal });
}
