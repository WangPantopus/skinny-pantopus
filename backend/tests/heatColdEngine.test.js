// ============================================================
// TEST: heat & cold outlook — the national seasonal spine
//
// This replaces seasonalEngine's two-city gate, so the invariants that
// matter most are the ones about honesty: a coverage gap is never
// rendered as a calm reading, `none` is a real and common answer, and
// the guidance only claims things about the home that we actually know.
// ============================================================

const {
  buildHeatColdOutlook,
  nextFreezeWindow,
  coldestDay,
  warmestNight,
  forwardHours,
} = require('../services/heatColdEngine');

const NOW = new Date('2026-01-15T18:00:00.000Z');
const TZ = 'America/Los_Angeles';

function hours(temps) {
  return temps.map((temp_f, i) => ({
    time: new Date(NOW.getTime() + (i + 1) * 3600_000).toISOString(),
    temp_f,
  }));
}

function days(specs) {
  return specs.map(([low_f, high_f], i) => ({
    date: `2026-01-${String(15 + i).padStart(2, '0')}`,
    low_f,
    high_f,
  }));
}

function heat(levels) {
  const LABELS = ['Little to none', 'Minor', 'Moderate', 'Major', 'Extreme'];
  return {
    covered: true,
    days: levels.map((level, i) => ({
      date: `2026-01-${String(15 + i).padStart(2, '0')}`,
      day: i + 1,
      level,
      label: LABELS[level],
      meaning: 'x',
    })),
  };
}

describe('helpers', () => {
  test('nextFreezeWindow finds the contiguous stretch and its minimum', () => {
    const w = nextFreezeWindow(forwardHours(hours([40, 33, 30, 28, 31, 36]), NOW));
    expect(w.hours).toBe(3);
    expect(w.min_temp_f).toBe(28);
  });

  test('nextFreezeWindow is null when nothing freezes', () => {
    expect(nextFreezeWindow(forwardHours(hours([40, 41, 39]), NOW))).toBeNull();
  });

  test('coldestDay and warmestNight read the daily lows', () => {
    const d = days([[38, 50], [22, 34], [41, 55]]);
    expect(coldestDay(d).low_f).toBe(22);
    expect(warmestNight(d).low_f).toBe(41);
  });

  test('forwardHours drops the past', () => {
    const past = { time: new Date(NOW.getTime() - 3600_000).toISOString(), temp_f: 10 };
    expect(forwardHours([past, ...hours([40])], NOW)).toHaveLength(1);
  });
});

describe('cold leads when a freeze is imminent', () => {
  test('names the temperature, duration and start', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([0, 0, 0]),
      weather: { hourly: hours([35, 31, 27, 25, 26, 30, 38]), daily: days([[25, 40]]) },
      home: { year_built: 1948, home_type: 'single_family' },
      timezone: TZ,
      now: NOW,
    });

    expect(out.mode).toBe('cold');
    expect(out.freeze.hours).toBe(5);
    expect(out.freeze.min_temp_f).toBe(25);
    expect(out.headline).toContain('Hard freeze');
    expect(out.headline).toContain('25°F');
  });

  test('calls a shallow freeze a freeze, not a hard freeze', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([33, 31, 30, 36]), daily: days([[30, 42]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.headline).toMatch(/^Freeze,/);
  });

  test('states the build year as a fact and hedges the generalisation', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([30, 28, 36]), daily: days([[28, 40]]) },
      home: { year_built: 1948 },
      timezone: TZ,
      now: NOW,
    });
    expect(out.guidance).toContain('1948');
    expect(out.guidance).toMatch(/more often/);
    expect(out.guidance).toContain('hose bib');
  });

  test('omits the age claim for a home with no build year', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([30, 28, 36]), daily: days([[28, 40]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.guidance).not.toMatch(/dates to/);
    // The standard protective action still applies.
    expect(out.guidance).toContain('hose bib');
  });

  test('flags a freeze beyond the hourly horizon from the daily lows', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([48, 46, 44]), daily: days([[44, 55], [40, 50], [26, 38]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('cold');
    expect(out.freeze).toBeNull();
    expect(out.headline).toContain('26°F');
  });

  // Regression: today's daily low is normally the pre-dawn minimum that
  // has already happened. At 6pm, with every hour of the next 24 above
  // freezing, "Freezing today — low near 30°F" ordered tonight-action
  // (disconnect the hose bib) for this morning's weather.
  test('never announces a freeze the hourly window already ruled out', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([40, 38, 37, 36, 38, 41]), daily: days([[30, 44], [45, 55]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out === null || out.mode !== 'cold').toBe(true);
    if (out) expect(out.headline || '').not.toContain('Freezing today');
  });

  test('"and colder" never points at a cleared today', () => {
    const out = buildHeatColdOutlook({
      // Today's passed low (28) is the week's coldest; tomorrow freezes at 30.
      weather: { hourly: hours([40, 38, 37, 36]), daily: days([[28, 40], [30, 44]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('cold');
    expect(out.headline).toContain('tomorrow');
    expect(out.headline).not.toContain('colder today');
  });
});

describe('heat leads when HeatRisk says so', () => {
  test('names the level and the span of affected days', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([1, 3, 3, 3, 1]),
      weather: { hourly: hours([88, 90, 92]), daily: days([[70, 95], [78, 102], [79, 104]]) },
      home: { year_built: 1948 },
      timezone: TZ,
      now: NOW,
    });

    expect(out.mode).toBe('heat');
    expect(out.peak_level).toBe(3);
    expect(out.headline).toContain('Major heat risk');
    // Overnight lows are the signal that actually hurts people.
    expect(out.guidance).toContain('Overnight lows');
    expect(out.guidance).toContain('1948');
    expect(out.guidance).toContain('Check on anyone nearby');
  });

  test('a freeze outranks heat — it is sooner and more expensive to ignore', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([4, 4, 4]),
      weather: { hourly: hours([30, 28, 36]), daily: days([[28, 40]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('cold');
    // The heat data is still carried for the 7-day strip.
    expect(out.peak_level).toBe(4);
  });

  test('minor heat is not worth leading with', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([1, 1, 1]),
      weather: { hourly: hours([78, 80, 79]), daily: days([[60, 84]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('none');
  });
});

describe('honesty', () => {
  test('says plainly when there is nothing to act on', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([0, 1, 0]),
      weather: { hourly: hours([58, 60, 62]), daily: days([[50, 66]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('none');
    expect(out.guidance).toBe('');
    expect(out.headline).toContain('No heat or freeze risk');
  });

  test('outside CONUS the heat half reports a gap, and never a calm reading', () => {
    const out = buildHeatColdOutlook({
      heatRisk: { covered: false, days: [] },
      weather: { hourly: hours([76, 78, 77]), daily: days([[70, 82]]) },
      home: {},
      timezone: 'Pacific/Honolulu',
      now: NOW,
    });

    expect(out.heat_covered).toBe(false);
    expect(out.heat_days).toEqual([]);
    expect(out.peak_level).toBeNull();
    // It must not claim "no heat risk" where we simply have no data.
    expect(out.headline).not.toContain('heat');
    expect(out.headline).toContain('No freeze');
  });

  test('the freeze half still works where HeatRisk has no coverage', () => {
    const out = buildHeatColdOutlook({
      heatRisk: { covered: false, days: [] },
      weather: { hourly: hours([30, 26, 34]), daily: days([[26, 38]]) },
      home: {},
      timezone: 'America/Anchorage',
      now: NOW,
    });
    expect(out.mode).toBe('cold');
    expect(out.heat_covered).toBe(false);
  });

  test('returns null when there is no forecast at all', () => {
    expect(buildHeatColdOutlook({ weather: { hourly: [], daily: [] }, now: NOW })).toBeNull();
    expect(buildHeatColdOutlook({})).toBeNull();
  });

  test('a null reading is never treated as 0°F', () => {
    const out = buildHeatColdOutlook({
      weather: {
        hourly: [
          { time: new Date(NOW.getTime() + 3600_000).toISOString(), temp_f: null },
          { time: new Date(NOW.getTime() + 7200_000).toISOString(), temp_f: 55 },
        ],
        daily: days([[50, 66]]),
      },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('none');
    expect(out.freeze).toBeNull();
  });
});

// ── Regression: which freezing night the headline names ──────────────────
// `upcomingFreeze` was driven by coldestDay(daily), which scans the whole
// week for the minimum with no date ordering. The guidance attached to the
// headline is protective action tied to a specific night, so naming the
// wrong night is exactly the failure this section exists to prevent. The
// hourly horizon is 24h while daily runs 7 days, so this branch is the
// common case, not an edge.
describe('the freeze headline names the NEXT freezing night', () => {
  const { nextFreezingDay } = require('../services/heatColdEngine');

  test('nextFreezingDay returns the first qualifying day, not the coldest', () => {
    const d = days([[40, 55], [31, 42], [36, 48], [38, 50], [18, 30]]);
    expect(nextFreezingDay(d).low_f).toBe(31);
    expect(coldestDay(d).low_f).toBe(18);
  });

  test('the headline leads with the first freeze, not the deepest one', () => {
    const out = buildHeatColdOutlook({
      // No freeze inside the hourly horizon, so the daily branch runs.
      weather: {
        hourly: hours([48, 46, 44]),
        daily: days([[40, 55], [31, 42], [36, 48], [38, 50], [18, 30]]),
      },
      home: {},
      timezone: TZ,
      now: NOW,
    });

    expect(out.mode).toBe('cold');
    expect(out.headline).toContain('31°F');
    // And it still tells them a colder night is coming, rather than hiding it.
    expect(out.headline).toContain('18°F');
    expect(out.headline).toContain('colder');
  });

  test('says it once when the first freeze IS the coldest night', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([48, 46]), daily: days([[40, 55], [22, 34], [30, 41]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.headline).toContain('22°F');
    expect(out.headline).not.toContain('colder');
  });

  test('stays quiet when no day reaches freezing', () => {
    const out = buildHeatColdOutlook({
      weather: { hourly: hours([48, 46]), daily: days([[40, 55], [38, 50]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.mode).toBe('none');
  });
});

// ── Regression: the heat span must be CONTIGUOUS ─────────────────────────
// The span was built by filtering the whole array on level >= threshold and
// taking [0]..[last], which jumps level-0 gaps. NWS HeatRisk genuinely
// produces non-contiguous notable days.
describe('heat span stops at the first cool day', () => {
  test('does not bridge a gap between two notable stretches', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([3, 0, 0, 2]),
      weather: { hourly: hours([90, 92]), daily: days([[70, 95], [60, 80], [58, 78], [68, 92]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });

    expect(out.mode).toBe('heat');
    expect(out.peak_level).toBe(3);
    // The peak is day 1 alone; the run must not reach the level-2 day.
    expect(out.headline).toBe('Major heat risk, today.');
  });

  test('still spans a genuinely contiguous stretch', () => {
    const out = buildHeatColdOutlook({
      heatRisk: heat([1, 3, 3, 2, 0]),
      weather: { hourly: hours([90, 92]), daily: days([[70, 95], [76, 101], [78, 103], [74, 98], [62, 84]]) },
      home: {},
      timezone: TZ,
      now: NOW,
    });
    expect(out.headline).toContain('through');
  });
});
