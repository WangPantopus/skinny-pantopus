// ============================================================
// GOOD DAY TO… — the verdict engine
//
// Turns the weather/AQI payload the Today group already fetches into
// answers to the five questions people actually ask each morning. The
// distinction that matters: "AQI 38, 64°F" is a reading, and every phone
// already ships one. "Open the windows — yes, until 3pm" is a verdict,
// and it is only possible because we know the rooftop and the building.
//
// Three rules hold for every tile:
//
//   1. NO NEW PROVIDER CALLS. Every input here is already fetched and
//      cached for `weather` and `air_quality`. A tile that would need a
//      new vendor does not ship until that vendor is real.
//
//   2. ALWAYS SHOW THE WORK. `because` carries the actual numbers. An
//      opinionated tile that won't show its inputs is worse than no
//      tile, because one visibly wrong verdict discredits every other
//      card on the dashboard.
//
//   3. NEVER GUESS. A tile whose inputs are missing is omitted, not
//      rendered with a shrug. Fewer honest tiles beat five padded ones.
//
// Deliberately five at most. A row of five is a glance; a row of twelve
// is noise.
// ============================================================

// Comfortable open-window band, °F.
const WINDOW_MIN_F = 55;
const WINDOW_MAX_F = 80;
// AirNow category breakpoints.
const AQI_MODERATE = 50;
const AQI_SENSITIVE = 100;
// A run is pleasant between these, °F (apparent temperature where known).
const RUN_MIN_F = 35;
const RUN_MAX_F = 78;
// Precip probability at which we call it "likely", %.
const PRECIP_LIKELY = 50;
const PRECIP_POSSIBLE = 30;
// Wind that ends an outdoor fire, mph.
const GRILL_MAX_WIND_MPH = 20;

// Home types that have ground to water. A condo tile about lawn watering
// is the kind of small wrongness that makes the whole row feel generic.
const LAWN_HOME_TYPES = new Set([
  'single_family', 'townhouse', 'duplex', 'manufactured', 'multi_family',
]);

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Hours strictly ahead of `now`, in order. */
function upcomingHours(hourly, now) {
  if (!Array.isArray(hourly)) return [];
  const nowMs = now.getTime();
  return hourly
    .filter((h) => h && h.time && isNum(h.temp_f) && new Date(h.time).getTime() >= nowMs)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

/** "3pm" / "midnight" in the place's timezone. */
function hourLabel(iso, timezone) {
  try {
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      hour12: true,
    }).format(new Date(iso));
    return label.replace(/\s?(AM|PM)/, (_, p) => p.toLowerCase());
  } catch {
    return '';
  }
}

/** Day name for a YYYY-MM-DD, e.g. "Thursday"; "today"/"tomorrow" near in. */
function dayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'today';
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const today = new Date(`${todayStr}T12:00:00Z`);
    const diffDays = Math.round((d - today) / 86400000);
    if (diffDays === 1) return 'tomorrow';
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * The longest run of consecutive hours satisfying `ok`.
 * Carries the whole slice, not just its endpoints — a window that starts
 * and ends at 62°F but peaks at 68°F must not be described as "62–62°F".
 */
function longestWindow(hours, ok) {
  let best = null;
  let start = null;
  for (let i = 0; i <= hours.length; i += 1) {
    const good = i < hours.length && ok(hours[i]);
    if (good && start === null) start = i;
    if (!good && start !== null) {
      const slice = hours.slice(start, i);
      const span = { from: slice[0], to: slice[slice.length - 1], length: slice.length, hours: slice };
      if (!best || span.length > best.length) best = span;
      start = null;
    }
  }
  return best;
}

/** Rounded min/max of a numeric field across a window's hours. */
function rangeOf(windowHours, pick) {
  const values = windowHours.map(pick).filter(isNum);
  if (values.length === 0) return null;
  return { lo: Math.round(Math.min(...values)), hi: Math.round(Math.max(...values)) };
}

// ── Tiles ───────────────────────────────────────────────────

function openWindowsTile({ aqi, hours, timezone }) {
  if (!aqi || !isNum(aqi.index)) return null;
  const index = aqi.index;

  if (index > AQI_SENSITIVE) {
    return {
      id: 'open_windows',
      label: 'Open windows',
      glyph: '🪟',
      verdict: 'no',
      answer: 'Keep them closed',
      because: `Air quality is ${aqi.category_label || 'unhealthy'} (AQI ${index}). Outdoor air is worse than indoor right now.`,
    };
  }

  const window = longestWindow(hours, (h) => h.temp_f >= WINDOW_MIN_F && h.temp_f <= WINDOW_MAX_F);
  if (!window) {
    const next = hours[0];
    if (!next) return null;
    const tooCold = next.temp_f < WINDOW_MIN_F;
    return {
      id: 'open_windows',
      label: 'Open windows',
      glyph: '🪟',
      verdict: 'no',
      answer: tooCold ? 'Too cold' : 'Too warm',
      because: `It stays ${tooCold ? 'below' : 'above'} ${tooCold ? WINDOW_MIN_F : WINDOW_MAX_F}°F all day (${Math.round(next.temp_f)}°F now). AQI ${index}.`,
    };
  }

  const until = hourLabel(window.to.time, timezone);
  const temps = rangeOf(window.hours, (h) => h.temp_f);
  const moderate = index > AQI_MODERATE;
  const tempPhrase = temps
    ? (temps.lo === temps.hi ? `${temps.lo}°F` : `${temps.lo}–${temps.hi}°F`)
    : null;

  return {
    id: 'open_windows',
    label: 'Open windows',
    glyph: '🪟',
    verdict: moderate ? 'caution' : 'yes',
    answer: until ? `Yes — until ${until}` : 'Yes',
    because: `AQI ${index}${aqi.category_label ? ` (${aqi.category_label.toLowerCase()})` : ''}${tempPhrase ? ` and ${tempPhrase}` : ''}${until ? ` through ${until}` : ''}.`,
  };
}

function runTile({ hours, timezone }) {
  if (hours.length === 0) return null;

  const comfortable = (h) => {
    const feels = isNum(h.feels_like_f) ? h.feels_like_f : h.temp_f;
    return feels >= RUN_MIN_F && feels <= RUN_MAX_F && (h.precip_chance ?? 0) < PRECIP_LIKELY;
  };

  const window = longestWindow(hours, comfortable);
  if (!window) {
    const wettest = Math.max(...hours.map((h) => h.precip_chance ?? 0));
    return {
      id: 'run',
      label: 'Run',
      glyph: '🏃',
      verdict: 'no',
      answer: 'Not today',
      because: wettest >= PRECIP_LIKELY
        ? `Rain is likely most of the day (${wettest}% chance) and it stays outside ${RUN_MIN_F}–${RUN_MAX_F}°F.`
        : `It stays outside ${RUN_MIN_F}–${RUN_MAX_F}°F all day.`,
    };
  }

  const from = hourLabel(window.from.time, timezone);
  const to = hourLabel(window.to.time, timezone);
  const temp = Math.round(window.from.feels_like_f ?? window.from.temp_f);

  return {
    id: 'run',
    label: 'Run',
    glyph: '🏃',
    verdict: 'yes',
    answer: from && to && from !== to ? `${from}–${to}` : `Around ${from || to}`,
    because: `${temp}°F and under ${PRECIP_LIKELY}% rain in that window.`,
  };
}

function washCarTile({ days, todayStr }) {
  if (!Array.isArray(days) || days.length === 0) return null;
  const horizon = days.slice(0, 3);
  const wet = horizon.find((d) => (d.precip_chance ?? 0) >= PRECIP_LIKELY);

  if (wet) {
    return {
      id: 'wash_car',
      label: 'Wash the car',
      glyph: '🚗',
      verdict: 'no',
      answer: `Wait — rain ${dayLabel(wet.date, todayStr)}`,
      because: `${wet.precip_chance}% chance of rain ${dayLabel(wet.date, todayStr)}. It would be wasted.`,
    };
  }

  const driest = Math.max(...horizon.map((d) => d.precip_chance ?? 0));
  return {
    id: 'wash_car',
    label: 'Wash the car',
    glyph: '🚗',
    verdict: driest >= PRECIP_POSSIBLE ? 'caution' : 'yes',
    answer: 'Good day for it',
    because: `No rain over ${horizon.length} days — highest chance is ${driest}%.`,
  };
}

function waterLawnTile({ days, todayStr, homeType }) {
  if (!Array.isArray(days) || days.length === 0) return null;
  // Only for homes that have ground to water.
  if (homeType && !LAWN_HOME_TYPES.has(String(homeType).toLowerCase())) return null;

  const horizon = days.slice(0, 2);
  const wet = horizon.find((d) => (d.precip_chance ?? 0) >= PRECIP_LIKELY);

  if (wet) {
    return {
      id: 'water_lawn',
      label: 'Water the lawn',
      glyph: '🌱',
      verdict: 'no',
      answer: 'Skip it',
      because: `${wet.precip_chance}% chance of rain ${dayLabel(wet.date, todayStr)} — let the sky do it.`,
    };
  }

  const chance = Math.max(...horizon.map((d) => d.precip_chance ?? 0));
  return {
    id: 'water_lawn',
    label: 'Water the lawn',
    glyph: '🌱',
    verdict: 'yes',
    answer: 'Worth doing',
    because: `No meaningful rain in the next ${horizon.length} days (highest chance ${chance}%).`,
  };
}

function grillTile({ hours, timezone }) {
  // Grilling is an evening question — look at hours 3–9 out.
  const evening = hours.slice(2, 9);
  if (evening.length === 0) return null;

  const wettest = Math.max(...evening.map((h) => h.precip_chance ?? 0));
  const windiest = Math.max(...evening.map((h) => (isNum(h.wind_mph) ? h.wind_mph : 0)));

  if (wettest >= PRECIP_LIKELY) {
    const firstWet = evening.find((h) => (h.precip_chance ?? 0) >= PRECIP_LIKELY);
    const when = hourLabel(firstWet.time, timezone);
    return {
      id: 'grill',
      label: 'Grill',
      glyph: '🔥',
      verdict: 'no',
      answer: 'Rain moving in',
      because: `${wettest}% chance of rain${when ? ` around ${when}` : ' this evening'}.`,
    };
  }

  if (windiest > GRILL_MAX_WIND_MPH) {
    return {
      id: 'grill',
      label: 'Grill',
      glyph: '🔥',
      verdict: 'caution',
      answer: 'Windy',
      because: `Gusts to ${Math.round(windiest)} mph this evening — hard to hold heat.`,
    };
  }

  const temp = Math.round(evening[0].temp_f);
  return {
    id: 'grill',
    label: 'Grill',
    glyph: '🔥',
    verdict: 'yes',
    answer: 'Yes',
    because: `${temp}°F this evening, under ${PRECIP_LIKELY}% rain and light wind.`,
  };
}

/**
 * Build the tile row.
 *
 * @param {object}  input
 * @param {object}  [input.weather]   PlaceWeatherData-shaped (hourly/daily).
 * @param {object}  [input.aqi]       PlaceAirQualityData-shaped.
 * @param {string}  [input.timezone]  IANA zone for the place.
 * @param {string}  [input.homeType]  Home.home_type, for tile relevance.
 * @param {Date}    [input.now]
 * @returns {{tiles: object[]}|null}  Null when nothing can be answered honestly.
 */
function buildGoodDayTiles({ weather, aqi, timezone, homeType, now = new Date() } = {}) {
  const hours = upcomingHours(weather && weather.hourly, now);
  const days = Array.isArray(weather && weather.daily) ? weather.daily : [];
  const todayStr = days[0] ? days[0].date : null;

  const tiles = [
    openWindowsTile({ aqi, hours, timezone }),
    runTile({ hours, timezone }),
    washCarTile({ days, todayStr }),
    waterLawnTile({ days, todayStr, homeType }),
    grillTile({ hours, timezone }),
  ].filter(Boolean);

  if (tiles.length === 0) return null;
  return { tiles };
}

module.exports = {
  buildGoodDayTiles,
  // Exported for unit testing.
  longestWindow,
  upcomingHours,
  dayLabel,
};
