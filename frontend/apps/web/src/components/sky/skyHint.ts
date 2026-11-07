// ============================================================
// The Today sky before its picture arrives.
//
// The Weather box goes out with the page; the picture (TodaySkyCanvas)
// loads after first paint. Until then, and if it never loads, the box is
// a plain gradient close to the scene's own colours, so the white reading
// is legible from the first frame. The same inputs give the same gradient
// on the server and in the browser. Small on purpose: this is the only
// part of the sky in Today's startup scripts.
// ============================================================

/** The kinds of sky the scene draws. Parity twin of `SkyPalette.Weather` on iOS and Android. */
export type SkyFamily = 'clear' | 'partly' | 'overcast' | 'fog' | 'wet' | 'snow' | 'storm';

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * A place section's condition code or a briefing's provider code ("heavy_rain", "mostly_clear") as a
 * kind of sky. What nobody recognises draws grey rather than a sunny sky, as on the apps.
 */
export function skyFamily(condition: string): SkyFamily {
  const code = condition.toLowerCase();
  if (/thunder|storm|hurricane/.test(code)) return 'storm';
  if (/snow|flurr|blizzard/.test(code)) return 'snow';
  if (/rain|drizzle|shower|sleet|hail|wintry/.test(code)) return 'wet';
  if (/fog|mist|haze|smok|dust/.test(code)) return 'fog';
  if (/partly|mostly_?(clear|sunny)/.test(code)) return 'partly';
  if (/cloud|overcast|unknown/.test(code) || !code) return 'overcast';
  return 'clear';
}

/** The 40 minutes either side of sunrise and sunset get warm skies (the apps' `SkyMoment`). */
export function skyPhase(minutes: number, sunrise: number, sunset: number): SkyPhase {
  if (minutes >= sunrise - 30 && minutes < sunrise + 40) return 'dawn';
  if (minutes >= sunrise + 40 && minutes < sunset - 40) return 'day';
  if (minutes >= sunset - 40 && minutes < sunset + 30) return 'dusk';
  return 'night';
}

// Top and horizon colours, from the scene's own palette (todaySky.ts): clear, grey and wet skies.
const HINTS: Record<SkyPhase, readonly string[]> = {
  dawn: ['#1F2F6B', '#F2A273', '#363D52', '#B0948F', '#262E40', '#8A7A80'],
  day: ['#0B5FA5', '#7CC8F2', '#46566B', '#A5B3C3', '#2B394D', '#7B8DA2'],
  dusk: ['#1B1846', '#F0884A', '#2A2B40', '#A07B70', '#1F2233', '#7A5F62'],
  night: ['#060A1C', '#25305C', '#0E121B', '#2B3444', '#0A101C', '#253349'],
};

const MS_PER_MINUTE = 60_000;

/**
 * The CSS gradient for a condition at [at] (ms, a time from the data itself, so server and browser agree).
 * [sunrise] and [sunset] are instants or the viewer's wall clock; without them the sky is a daytime one until
 * the picture, which knows the address's clock, takes over.
 */
export function skyHint(condition: string, at: number, sunrise?: string | null, sunset?: string | null): string {
  const family = skyFamily(condition);
  const rise = Date.parse(sunrise ?? '');
  const set = Date.parse(sunset ?? '');
  const phase = rise < set ? skyPhase(at / MS_PER_MINUTE, rise / MS_PER_MINUTE, set / MS_PER_MINUTE) : 'day';
  const row = family === 'wet' || family === 'storm' ? 4 : family === 'clear' || family === 'partly' ? 0 : 2;
  return `linear-gradient(${HINTS[phase][row]},${HINTS[phase][row + 1]})`;
}
