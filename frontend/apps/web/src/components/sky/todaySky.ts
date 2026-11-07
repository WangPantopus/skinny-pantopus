// ============================================================
// The rules of the Today sky: what the scene shows for this address right
// now. The sky's colours follow the reported weather and the time of day on
// the address's clock, and the rest follows what the page already read: the
// wind, how hard it rains, the air, the household's pickup days, the kind of
// home and how many verified homes are around (a bucket, never a count).
//
// Parity twin of SkyMoment, SkyPalette, SkyWind, SkyNote and SkyHome on iOS
// and Android; the numbers match. No DOM, no React: todaySkyPainter.ts draws
// the result, and this module loads with it, after first paint.
// ============================================================

import type { PlaceDensityBucket, PlaceHouseShape } from '@pantopus/types';
import { skyFamily, skyPhase, type SkyFamily, type SkyPhase } from './skyHint';
import { mixColor } from './skyLand';

export interface TodaySkyInput {
  /** A place section's condition code or a briefing's provider code. */
  condition: string;
  tempF: number | null;
  /** Instants, or wall clock in the address's zone ("2026-10-07T07:15"). Only the clock time is used. */
  sunrise?: string | null;
  sunset?: string | null;
  /** The address's IANA time zone; this browser's when unknown. */
  timeZone?: string | null;
  windMph?: number | null;
  /** Where the wind blows from ("SW"). */
  windFrom?: string | null;
  /** The hours ahead, for how hard it rains. */
  hourly?: ReadonlyArray<{ time: string; precip_chance: number }>;
  /** The air reading: smoke veils the sky. */
  air?: { index: number; pollutant: string | null } | null;
  /** The address calendar's upcoming dates: the bins stand at the curb for a household's own pickup. */
  pickups?: ReadonlyArray<{ kind: string; scope: string; date: string }>;
  /** The home's outline, from the Your Home section. */
  house?: PlaceHouseShape | null;
  homeType?: string | null;
  density?: PlaceDensityBucket | null;
}

export type SkyColors = readonly [top: string, mid: string, bottom: string];

// ── The sky's colours: zenith, middle and horizon, by time of day and kind of weather ──

const SKIES: Record<SkyPhase, Record<SkyFamily, SkyColors>> = {
  day: {
    clear: ['#0B5FA5', '#1D8FD8', '#7CC8F2'],
    partly: ['#22609F', '#4A8DCB', '#A3CDEB'],
    overcast: ['#46566B', '#677A8F', '#A5B3C3'],
    fog: ['#5E6C7E', '#8592A2', '#C3CCD6'],
    wet: ['#2B394D', '#44566C', '#7B8DA2'],
    snow: ['#4A5F79', '#7A90A8', '#CAD7E4'],
    storm: ['#1C2433', '#2D3849', '#4A586C'],
  },
  dawn: {
    clear: ['#1F2F6B', '#7A4E9E', '#F2A273'],
    partly: ['#26356E', '#7E5A9C', '#E9A783'],
    overcast: ['#363D52', '#685F78', '#B0948F'],
    fog: ['#454B5E', '#7A7488', '#C2AAA2'],
    wet: ['#262E40', '#4C4A5F', '#8A7A80'],
    snow: ['#3A4560', '#76708C', '#D4BDB8'],
    storm: ['#191D2B', '#2F2D40', '#55495A'],
  },
  dusk: {
    clear: ['#1B1846', '#8E3A6E', '#F0884A'],
    partly: ['#211D4C', '#86426F', '#E58F5E'],
    overcast: ['#2A2B40', '#584A60', '#A07B70'],
    fog: ['#3A3A4E', '#6A5D6E', '#B5938A'],
    wet: ['#1F2233', '#423A4E', '#7A5F62'],
    snow: ['#2F3350', '#6A5C7A', '#C9A9A8'],
    storm: ['#14151F', '#2A2433', '#4D3A44'],
  },
  night: {
    clear: ['#060A1C', '#101838', '#25305C'],
    partly: ['#080D20', '#141C3B', '#2A3459'],
    overcast: ['#0E121B', '#1A202D', '#2B3444'],
    fog: ['#12161E', '#202631', '#353D4A'],
    wet: ['#0A101C', '#152031', '#253349'],
    snow: ['#111829', '#202D47', '#3C4C68'],
    storm: ['#06080E', '#111522', '#1F2536'],
  },
};

// ── Where the day is at this address ──────────────────────

export interface SkyMoment {
  phase: SkyPhase;
  /** 0 at sunrise, 1 at sunset, clamped. */
  dayFraction: number;
  /** 11 pm to 5 am: only one window stays lit. */
  lateNight: boolean;
  /** 0 new moon, 0.5 full, back toward 1 at the next new moon. */
  moonPhase: number;
  /** Minutes past local midnight now, at sunrise and at sunset. */
  minutes: number;
  sunrise: number;
  sunset: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function clockIn(ms: number, timeZone: string | null | undefined): { year: number; month: number; day: number; minutes: number } {
  const key = timeZone ?? '';
  let format = formatters.get(key);
  if (!format) {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' };
    try {
      format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: timeZone ?? undefined });
    } catch {
      // A zone this browser doesn't know: its own clock, as the apps do without one.
      format = new Intl.DateTimeFormat('en-US', options);
    }
    formatters.set(key, format);
  }
  const part = Object.fromEntries(format.formatToParts(ms).map((p) => [p.type, Number(p.value)]));
  return { year: part.year, month: part.month, day: part.day, minutes: part.hour * 60 + part.minute + part.second / 60 };
}

/** Minutes past midnight of a sunrise or sunset: its wall clock as written, or an instant on the address's clock. */
function clockMinutes(raw: string | null | undefined, timeZone: string | null | undefined): number | null {
  if (!raw) return null;
  const wall = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::[\d.]+)?$/.exec(raw);
  if (wall) return Number(wall[1]) * 60 + Number(wall[2]);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.floor(clockIn(at, timeZone).minutes);
}

/** The moon's age as a fraction of the 29.53-day synodic month, from the new moon of 6 January 2000. */
export function moonPhase(ms: number): number {
  const cycles = (ms / 86_400_000 + 2_440_587.5 - 2_451_550.1) / 29.530588853;
  return cycles - Math.floor(cycles);
}

// ── The wind ──────────────────────────────────────────────

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** How hard (mph, as the picture draws it) and which way (`toward`: 1 right, -1 left) the wind blows. */
export class SkyWind {
  constructor(readonly mph: number, readonly toward: number) {}

  /** A forecast without a speed reads as a light breeze, and a "windy" one blows at 20 or more. */
  static of(mph: number | null | undefined, from: string | null | undefined, condition: string): SkyWind {
    const windy = /wind|breez/.test(condition.toLowerCase());
    const known = mph ?? (windy ? 20 : 10);
    // The scene looks south (the sun rises on the left), so from the west side it blows to the left.
    const toward = POINTS.indexOf((from ?? '').toUpperCase()) >= 9 ? -1 : 1;
    return new SkyWind(windy ? Math.max(known, 20) : Math.max(known, 0), toward);
  }

  /** Under 5 mph: nothing leans, drifts or slants. */
  get calm() { return this.mph < 5; }
  /** 0 when calm, 1 from 35 mph. */
  get strength() { return Math.min(1, Math.max(0, (this.mph - 5) / 30)); }
  /** How fast the clouds drift, as a share of a 10 mph breeze's pace. */
  get cloudPace() { return this.calm ? 0 : this.mph / 10; }
  /** How far rain and snow move sideways for each pixel they fall. */
  get slant() { return this.calm ? 0 : Math.min(this.mph, 40) * 0.022; }
  /** Streaks of air from 12 mph: two, then one more every 6 mph, up to five. */
  get streaks() { return this.mph < 12 ? 0 : Math.min(5, 2 + Math.floor((this.mph - 10) / 6)); }
  /** How far the two fair-weather clouds sway either side. */
  get sway() { return this.calm ? 0 : Math.min(4 + this.mph * 0.8, 20); }
  /** How quickly they sway: faster in a stronger wind. */
  get swayPace() { return 0.18 * Math.max(1, this.mph / 10); }

  /** The trees' lean in radians: a still lean, or one that gusts a little further and back. */
  lean(time: number, still: boolean): number {
    const bend = this.toward * this.strength;
    if (still) return bend * 0.2;
    const pace = 1.4 + 1.2 * this.strength;
    return bend * (0.2 + 0.045 * (0.6 * Math.sin(time * pace) + 0.4 * Math.sin(time * pace * 0.43 + 1.3)));
  }
}

// ── The home ──────────────────────────────────────────────

export type SkyHomeKind = 'house' | 'townhouse' | 'apartment' | 'mobile';
export type SkyRoof = 'gable' | 'hip' | 'flat';
export type SkyGarage = 'none' | 'attached' | 'detached' | 'carport';

/**
 * The resident's home as the scene draws it. What the record doesn't say keeps the scene's first house:
 * one storey, 40 px wide, a gable roof and a chimney.
 */
export interface SkyHome {
  kind: SkyHomeKind;
  /** 1, 1.5, 2 or 3; null draws the first house's one storey. */
  stories: number | null;
  /** The walls' width. */
  width: number;
  roof: SkyRoof;
  garage: SkyGarage;
  /** One door per car, 1 to 3. */
  garageSpaces: number;
  chimney: boolean;
  pool: boolean;
}

/** The app's own types, then a county record's words ("CONDOMINIUM"). */
function homeKind(value: string | null | undefined): SkyHomeKind | null {
  if (!value) return null;
  if (value === 'house') return 'house';
  if (value === 'townhouse') return 'townhouse';
  if (['apartment', 'condo', 'studio', 'multi_unit'].includes(value)) return 'apartment';
  if (['mobile', 'mobile_home', 'trailer', 'rv'].includes(value)) return 'mobile';
  const words = value.toUpperCase();
  if (/MOBILE|MANUFACTURED/.test(words)) return 'mobile';
  if (/CONDO|APARTMENT|MULTI|TRIPLEX|QUADRUPLEX|FOURPLEX/.test(words)) return 'apartment';
  if (!words.includes('SINGLE FAMILY') && /TOWNHOUSE|ROWHOUSE|DUPLEX/.test(words)) return 'townhouse';
  return null;
}

export function skyHome(house: PlaceHouseShape | null | undefined, homeType: string | null | undefined): SkyHome {
  const kind = homeKind(house?.kind) ?? homeKind(homeType) ?? 'house';
  const stories = house?.stories == null ? null : Math.min(3, Math.max(1, house.stories));
  const footprint = house?.footprint === 'small' ? 34 : house?.footprint === 'large' ? 50 : 40;
  return {
    kind,
    stories,
    // Two storeys stand a little wider, so they read as a house, not a tower.
    width: footprint + ((stories ?? 1) >= 2 ? 6 : 0),
    roof: house?.roof === 'hip' || house?.roof === 'flat' ? house.roof : 'gable',
    garage: house?.garage === 'attached' || house?.garage === 'detached' || house?.garage === 'carport' ? house.garage : 'none',
    garageSpaces: Math.min(3, Math.max(1, house?.garage_spaces ?? 2)),
    chimney: (kind === 'house' || kind === 'townhouse') && house?.fireplace !== false,
    pool: kind === 'house' && house?.pool === true,
  };
}

/** The walls' height: the first house's 26 px for one storey. */
export function homeWallHeight(home: SkyHome): number {
  const stories = home.stories;
  if (stories == null) return 26;
  return stories >= 2.5 ? 52 : stories >= 2 ? 40 : stories > 1 ? 30 : 26;
}

function homeHalfWidth(home: SkyHome): number {
  return home.kind === 'townhouse' ? 38 : home.kind === 'apartment' ? 26 : home.kind === 'mobile' ? 29 : home.width / 2 + 5;
}

/** How far the home reaches left of its door, roof included: the bins stand just past it. */
export function homeLeftReach(home: SkyHome): number {
  return homeHalfWidth(home);
}

/** How far it reaches right of its door, roof and garage included: the trees stand just past it. */
export function homeRightReach(home: SkyHome): number {
  if (home.kind !== 'house') return homeHalfWidth(home);
  const garageWidth = 8 + 8 * home.garageSpaces;
  if (home.garage === 'attached') return home.width / 2 + garageWidth + 5;
  if (home.garage === 'detached') return home.width / 2 + 5 + garageWidth + 5;
  if (home.garage === 'carport') return home.width / 2 + 21;
  return home.width / 2 + 5;
}

// ── The scene ─────────────────────────────────────────────

export type SkySeason = 'spring' | 'summer' | 'autumn' | 'winter';

function season(month: number, day: number): SkySeason {
  const at = month * 100 + day;
  if (at >= 315 && at < 516) return 'spring';
  if (at >= 516 && at < 915) return 'summer';
  if (at >= 915 && at < 1201) return 'autumn';
  return 'winter';
}

const PICKUP_KINDS = ['garbage', 'recycling', 'yard_waste'];

function dateKey(year: number, month: number, day: number): string {
  // Through UTC, so day 31 + 1 rolls over the month and year.
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/**
 * The bins at the curb: the evening before a pickup (from 4 pm) and the pickup morning (until noon). Only
 * days the household set itself: city defaults are unconfirmed, the same rule the pickup reminders follow.
 */
function binsOut(input: TodaySkyInput, clock: ReturnType<typeof clockIn>): string[] {
  const evening = clock.minutes >= 16 * 60;
  if (!evening && clock.minutes >= 12 * 60) return [];
  const key = dateKey(clock.year, clock.month, clock.day + (evening ? 1 : 0));
  const pickups = input.pickups ?? [];
  return PICKUP_KINDS.filter((kind) => pickups.some((p) => p.kind === kind && p.scope === 'home' && p.date.startsWith(key)));
}

/** How hard it rains, 0 to 1: the chance of rain in the forecast hour nearest now. */
function rainAt(hourly: TodaySkyInput['hourly'], now: number): number {
  let nearest: number | null = null;
  let best = Infinity;
  for (const hour of hourly ?? []) {
    const away = Math.abs(Date.parse(hour.time) - now);
    if (away < best) {
      best = away;
      nearest = hour.precip_chance;
    }
  }
  return (nearest ?? 50) / 100;
}

export interface TodayScene {
  family: SkyFamily;
  /** Sleet draws fewer raindrops, with snow among them. */
  sleet: boolean;
  moment: SkyMoment;
  wind: SkyWind;
  season: SkySeason;
  colors: SkyColors;
  /** The day's first and last golden hour warm the horizon (up to 0.5). */
  goldenWarmth: number;
  /** How dark the land is: 0 by day, 1 at night. */
  dark: number;
  /** How hard it rains, 0 to 1. */
  rain: number;
  /** Wildfire smoke, 0 (none) to 0.85. */
  smoke: number;
  /** Below 50°F the chimney smokes. */
  cold: boolean;
  /** At or below 32°F frost creeps in from the corners. */
  frost: boolean;
  bins: string[];
  home: SkyHome;
  /** The share of the far hill's lights on after dusk, from the block's density bucket. */
  lights: number;
}

const SUN_LOW = '#FFC27A';

function lights(bucket: TodaySkyInput['density']): number {
  return bucket === 'growing' ? 0.5 : bucket === 'few' ? 0.25 : bucket === 'forming' ? 0.13 : 0;
}

const DARK: Record<SkyPhase, number> = { day: 0, dawn: 0.35, dusk: 0.35, night: 1 };

/** A little way either side of a change of phase the colours blend, so the sky never jumps while the page is open. */
function lightAt(moment: SkyMoment, family: SkyFamily): { colors: SkyColors; dark: number } {
  const { minutes: m, sunrise, sunset, phase } = moment;
  for (const edge of [sunrise - 30, sunrise + 40, sunset - 40, sunset + 30]) {
    const into = (m - (edge - 5)) / 10;
    if (into > 0 && into < 1) {
      const from = skyPhase(edge - 6, sunrise, sunset);
      const to = skyPhase(edge + 6, sunrise, sunset);
      const [a, b] = [SKIES[from][family], SKIES[to][family]];
      return {
        colors: [mixColor(a[0], b[0], into), mixColor(a[1], b[1], into), mixColor(a[2], b[2], into)],
        dark: DARK[from] + (DARK[to] - DARK[from]) * into,
      };
    }
  }
  return { colors: SKIES[phase][family], dark: DARK[phase] };
}

export function todaySkyScene(input: TodaySkyInput, now: number): TodayScene {
  const clock = clockIn(now, input.timeZone);
  let sunrise = clockMinutes(input.sunrise, input.timeZone) ?? 390;
  let sunset = clockMinutes(input.sunset, input.timeZone) ?? 1110;
  if (sunset <= sunrise) {
    sunrise = 390;
    sunset = 1110;
  }
  const minutes = clock.minutes;
  const moment: SkyMoment = {
    phase: skyPhase(minutes, sunrise, sunset),
    dayFraction: Math.min(1, Math.max(0, (minutes - sunrise) / (sunset - sunrise))),
    lateNight: minutes >= 23 * 60 || minutes < 5 * 60,
    moonPhase: moonPhase(now),
    minutes,
    sunrise,
    sunset,
  };
  const family = skyFamily(input.condition);
  const goldenWarmth = moment.phase === 'day'
    ? Math.min(1, Math.max(0, (minutes - (sunset - 60)) / 20, (sunrise + 60 - minutes) / 20)) * 0.5
    : 0;
  const { colors: base, dark } = lightAt(moment, family);
  const colors: SkyColors = goldenWarmth > 0
    ? [base[0], mixColor(base[1], SUN_LOW, goldenWarmth * 0.25), mixColor(base[2], SUN_LOW, goldenWarmth * 0.6)]
    : base;
  const smoky = input.air?.pollutant === 'pm25' && input.air.index >= 101;
  const temp = input.tempF;
  return {
    family,
    sleet: /sleet|hail|wintry/.test(input.condition.toLowerCase()),
    moment,
    wind: SkyWind.of(input.windMph, input.windFrom, input.condition),
    season: season(clock.month, clock.day),
    colors,
    goldenWarmth,
    dark,
    rain: rainAt(input.hourly, now),
    smoke: smoky ? Math.min(0.85, 0.35 + ((input.air?.index ?? 0) - 101) / 400) : 0,
    cold: temp != null && temp < 50,
    frost: temp != null && temp <= 32,
    // Unhealthy air leads the card on the apps, and the bins give way to it.
    bins: (input.air?.index ?? 0) >= 151 ? [] : binsOut(input, clock),
    home: skyHome(input.house, input.homeType),
    lights: lights(input.density),
  };
}
