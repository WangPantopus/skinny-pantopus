// ============================================================
// HEAT & COLD — the seasonal spine, nationally
//
// Crosses two forecasts with the home's own facts and emits an
// instruction rather than a reading:
//
//   heat  NWS HeatRisk (0–4, CONUS, 7 days) — services/external/heatRisk.js
//   cold  the hourly/daily temperature forecast already fetched for the
//         `weather` section, so the freeze half costs no new provider call
//
// Why this exists: `services/ai/seasonalEngine.js` is hard-gated to two
// 30 km circles around Vancouver WA and Portland OR. Outside them it
// returns all-nulls, so every user in the country silently loses the
// seasonal signal class — while INSIDE the gate, callers that pass no
// coordinates get Portland-specific copy regardless of where the home is.
// HeatRisk is national and data-driven, so neither failure mode applies.
//
// Heat and cold are the only two hazards with a forecast horizon long
// enough to act on AND a recurring seasonal cadence — useful on the order
// of 15–25 days a year. Often enough to build a habit, rare enough that
// the push is never noise. On every other day this returns `mode: 'none'`
// and the card says so plainly.
// ============================================================

const HOUR_MS = 60 * 60 * 1000;

// Freezing, °F. Pipe damage is the failure people actually pay for.
const FREEZE_F = 32;
// A hard freeze — the threshold where protective action really matters.
const HARD_FREEZE_F = 28;
// HeatRisk level at which the card leads with heat.
const HEAT_NOTABLE_LEVEL = 2;
// Nights at or above this don't let a house shed the day's heat.
const WARM_NIGHT_F = 75;
// Older homes more often have exposed or poorly insulated pipe runs.
const OLDER_HOME_YEAR = 1980;

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Hours at or after `now`, sorted forward. */
function forwardHours(hourly, now) {
  if (!Array.isArray(hourly)) return [];
  const nowMs = now.getTime();
  return hourly
    .filter((h) => h && h.time && isNum(num(h.temp_f)) && new Date(h.time).getTime() >= nowMs)
    .map((h) => ({ time: h.time, temp_f: num(h.temp_f) }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

function dayName(dateStr, todayStr, timezone) {
  if (!dateStr) return '';
  if (dateStr === todayStr) return 'today';
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const today = new Date(`${todayStr}T12:00:00Z`);
    if (Math.round((d - today) / 86400000) === 1) return 'tomorrow';
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(d);
  } catch {
    return dateStr;
  }
}

function clockLabel(iso, timezone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
      hour: 'numeric',
      hour12: true,
    })
      .format(new Date(iso))
      .replace(/\s?(AM|PM)/, (_, p) => p.toLowerCase());
  } catch {
    return '';
  }
}

/**
 * The next contiguous stretch at or below freezing in the hourly forecast.
 * Returns null when none is forecast inside the hourly horizon.
 */
function nextFreezeWindow(hours) {
  let start = null;
  for (let i = 0; i <= hours.length; i += 1) {
    const freezing = i < hours.length && hours[i].temp_f <= FREEZE_F;
    if (freezing && start === null) start = i;
    if (!freezing && start !== null) {
      const slice = hours.slice(start, i);
      return {
        starts: slice[0].time,
        ends: slice[slice.length - 1].time,
        hours: slice.length,
        min_temp_f: Math.round(Math.min(...slice.map((h) => h.temp_f))),
      };
    }
  }
  return null;
}

/** True when a colder night follows the first freezing one — worth saying. */
function coldColderLater(firstFreeze, coldest) {
  return Boolean(
    firstFreeze && coldest
      && coldest.date !== firstFreeze.date
      && coldest.low_f < firstFreeze.low_f,
  );
}

/**
 * The FIRST day in the forecast that reaches freezing.
 *
 * Distinct from `coldestDay`, and the distinction matters: the guidance
 * attached to this headline is protective action tied to a specific night
 * ("disconnect the hose bib, leave the far tap dripping"). Naming the
 * coldest night instead of the next freezing one tells the resident to act
 * on the wrong evening — with lows 40/31/36/38/18 the freeze is Wednesday
 * at 31°F, not Saturday at 18°F.
 */
/**
 * @param {Array}  daily
 * @param {string} [skipDate]  A date already cleared by the hourly scan.
 *   Today's daily low is normally the pre-dawn minimum that has ALREADY
 *   happened — when the 24h hourly window (which covers the rest of
 *   today) found no freeze, a "Freezing today" headline off daily[0]
 *   would order tonight-action for this morning's weather.
 */
function nextFreezingDay(daily, skipDate) {
  if (!Array.isArray(daily)) return null;
  for (const d of daily) {
    const low = num(d && d.low_f);
    if (low === null || !d.date) continue;
    if (skipDate && d.date === skipDate) continue;
    if (low <= FREEZE_F) return { date: d.date, low_f: low };
  }
  return null;
}

/** The coldest daily low in the forecast, and which day it lands on. */
function coldestDay(daily, skipDate) {
  if (!Array.isArray(daily)) return null;
  let best = null;
  for (const d of daily) {
    const low = num(d && d.low_f);
    if (low === null || !d.date) continue;
    // Same rule as nextFreezingDay: a cleared today only contributes this
    // morning's low — "and colder today" must never point backwards.
    if (skipDate && d.date === skipDate) continue;
    if (!best || low < best.low_f) best = { date: d.date, low_f: low };
  }
  return best;
}

/** The warmest overnight low in the forecast — the heat signal that matters. */
function warmestNight(daily) {
  if (!Array.isArray(daily)) return null;
  let best = null;
  for (const d of daily) {
    const low = num(d && d.low_f);
    if (low === null || !d.date) continue;
    if (!best || low > best.low_f) best = { date: d.date, low_f: low };
  }
  return best;
}

// ── Guidance ────────────────────────────────────────────────
// The home fact is stated as a fact; the advice itself is standard
// protective action, hedged where it generalises.

function coldGuidance({ yearBuilt, homeType }) {
  const parts = [];
  if (isNum(yearBuilt) && yearBuilt < OLDER_HOME_YEAR) {
    parts.push(
      `Your home dates to ${yearBuilt}. Older homes more often have exposed or poorly insulated pipe runs.`,
    );
  }
  parts.push(
    'Disconnect the hose bib, open the cabinets under sinks on exterior walls, and leave a far tap dripping.',
  );
  if (homeType && String(homeType).toLowerCase().includes('manufactured')) {
    parts.push('Skirting vents and underbelly plumbing are the usual failure points on a manufactured home.');
  }
  return parts.join(' ');
}

function heatGuidance({ level, yearBuilt, warmNight }) {
  const parts = [];
  if (warmNight && warmNight.low_f >= WARM_NIGHT_F) {
    parts.push(
      `Overnight lows near ${Math.round(warmNight.low_f)}°F give the house no chance to shed the day's heat.`,
    );
  }
  if (isNum(yearBuilt) && yearBuilt < OLDER_HOME_YEAR) {
    parts.push(`Your home dates to ${yearBuilt}, so it likely leaks more than a newer build — cool one room rather than the whole house.`);
  }
  if (level >= 3) {
    parts.push('Check on anyone nearby who is older, alone, or without working cooling.');
  }
  return parts.join(' ');
}

/**
 * Compose the heat/cold outlook.
 *
 * @param {object}  input
 * @param {object}  [input.heatRisk]  services/external/heatRisk fetchHeatRisk result.
 * @param {object}  [input.weather]   { hourly: [{time, temp_f}], daily: [{date, low_f, high_f}] }
 * @param {object}  [input.home]      { year_built, home_type }
 * @param {string}  [input.timezone]
 * @param {Date}    [input.now]
 * @returns {object|null} PlaceHeatColdData, or null when nothing can be said.
 */
function buildHeatColdOutlook({ heatRisk, weather, home, timezone, now = new Date() } = {}) {
  const hours = forwardHours(weather && weather.hourly, now);
  const daily = Array.isArray(weather && weather.daily) ? weather.daily : [];
  const todayStr = daily[0] ? daily[0].date : null;
  const yearBuilt = num(home && home.year_built);
  const homeType = home && home.home_type;

  const heatDays = (heatRisk && heatRisk.covered && Array.isArray(heatRisk.days)) ? heatRisk.days : [];
  const heatCovered = Boolean(heatRisk && heatRisk.covered);
  const peak = heatDays.reduce(
    (acc, d) => (!acc || d.level > acc.level ? d : acc),
    null,
  );

  // A freeze beyond the hourly horizon still deserves a heads-up — and it
  // must be the NEXT freezing day, not the coldest one in the week. The
  // hourly horizon is 24h while the daily forecast runs 7 days, so this
  // branch is the common case, not an edge. When the hourly scan ran and
  // found nothing, today is already cleared: its remaining hours are all
  // inside that window, so its daily low can only be this morning's —
  // skip it rather than announce a freeze that already happened.
  const freeze = nextFreezeWindow(hours);
  const clearedToday = !freeze && hours.length > 0 ? todayStr : null;
  const cold = coldestDay(daily, clearedToday);
  const upcomingFreeze = freeze ? null : nextFreezingDay(daily, clearedToday);

  // Nothing usable at all — no forecast and no coverage.
  if (heatDays.length === 0 && hours.length === 0 && daily.length === 0) return null;

  // ── Cold leads when a freeze is actually in the hourly window: it is
  // the more imminent and the more expensive of the two to ignore.
  if (freeze) {
    const hard = freeze.min_temp_f <= HARD_FREEZE_F;
    const when = clockLabel(freeze.starts, timezone);
    return {
      mode: 'cold',
      heat_days: heatDays,
      heat_covered: heatCovered,
      peak_level: peak ? peak.level : null,
      peak_date: peak ? peak.date : null,
      freeze: {
        starts: freeze.starts,
        ends: freeze.ends,
        hours: freeze.hours,
        min_temp_f: freeze.min_temp_f,
      },
      headline: `${hard ? 'Hard freeze' : 'Freeze'}, ${freeze.min_temp_f}°F for ${freeze.hours} hour${freeze.hours === 1 ? '' : 's'}${when ? ` starting ${when}` : ''}.`,
      guidance: coldGuidance({ yearBuilt, homeType }),
      source_note: 'National Weather Service forecast',
    };
  }

  if (upcomingFreeze) {
    return {
      mode: 'cold',
      heat_days: heatDays,
      heat_covered: heatCovered,
      peak_level: peak ? peak.level : null,
      peak_date: peak ? peak.date : null,
      freeze: null,
      headline: coldColderLater(upcomingFreeze, cold)
        ? `Freezing ${dayName(upcomingFreeze.date, todayStr, timezone)} — low near ${Math.round(upcomingFreeze.low_f)}°F, `
          + `and colder ${dayName(cold.date, todayStr, timezone)} at ${Math.round(cold.low_f)}°F.`
        : `Freezing ${dayName(upcomingFreeze.date, todayStr, timezone)} — low near ${Math.round(upcomingFreeze.low_f)}°F.`,
      guidance: coldGuidance({ yearBuilt, homeType }),
      source_note: 'National Weather Service forecast',
    };
  }

  // ── Heat leads when HeatRisk says it is worth acting on.
  if (peak && peak.level >= HEAT_NOTABLE_LEVEL) {
    // Walk OUTWARD from the peak and stop at the first day below the
    // threshold. Filtering the whole array and taking [0] and [last]
    // spanned level-0 gaps — NWS HeatRisk genuinely produces
    // non-contiguous notable days, so [3,0,0,2] read as "Major heat risk,
    // today through Saturday", attaching check-on-your-neighbours guidance
    // to two cool days in the middle.
    const peakIdx = heatDays.findIndex((d) => d.date === peak.date);
    let lo = peakIdx;
    let hi = peakIdx;
    while (lo - 1 >= 0 && heatDays[lo - 1].level >= HEAT_NOTABLE_LEVEL) lo -= 1;
    while (hi + 1 < heatDays.length && heatDays[hi + 1].level >= HEAT_NOTABLE_LEVEL) hi += 1;
    const run = heatDays.slice(lo, hi + 1);
    const first = run[0];
    const last = run[run.length - 1];
    const span = first && last && first.date !== last.date
      ? `${dayName(first.date, todayStr, timezone)} through ${dayName(last.date, todayStr, timezone)}`
      : dayName((first || peak).date, todayStr, timezone);
    return {
      mode: 'heat',
      heat_days: heatDays,
      heat_covered: heatCovered,
      peak_level: peak.level,
      peak_date: peak.date,
      freeze: null,
      headline: `${peak.label} heat risk, ${span}.`,
      guidance: heatGuidance({ level: peak.level, yearBuilt, warmNight: warmestNight(daily) }),
      source_note: 'NWS HeatRisk (experimental)',
    };
  }

  // ── Nothing to act on. Say that, rather than manufacturing urgency.
  return {
    mode: 'none',
    heat_days: heatDays,
    heat_covered: heatCovered,
    peak_level: peak ? peak.level : null,
    peak_date: peak ? peak.date : null,
    freeze: null,
    headline: heatCovered
      ? 'No heat or freeze risk in the next week.'
      : 'No freeze in the forecast.',
    guidance: '',
    source_note: heatCovered ? 'NWS HeatRisk (experimental)' : 'National Weather Service forecast',
  };
}

module.exports = {
  buildHeatColdOutlook,
  // Exported for unit testing.
  nextFreezeWindow,
  nextFreezingDay,
  coldestDay,
  warmestNight,
  forwardHours,
  FREEZE_F,
  HARD_FREEZE_F,
};
