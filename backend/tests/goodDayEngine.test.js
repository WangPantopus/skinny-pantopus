// ============================================================
// TEST: Good Day To… verdict engine
//
// These tiles are opinionated by construction, so a visibly wrong verdict
// discredits every other card on the dashboard. The invariants pinned
// here are the ones that protect that: a tile never appears without the
// inputs to justify it, `because` always carries the actual numbers, and
// the row never grows past five.
// ============================================================

const { buildGoodDayTiles, longestWindow, upcomingHours, dayLabel } = require('../services/goodDayEngine');

const NOW = new Date('2026-06-07T15:00:00.000Z'); // 8am America/Los_Angeles
const TZ = 'America/Los_Angeles';

/** Hours from `startOffset` hours out, one per hour, with the given temps. */
function hours(temps, opts = {}) {
  return temps.map((temp_f, i) => ({
    time: new Date(NOW.getTime() + (i + 1) * 3600_000).toISOString(),
    temp_f,
    feels_like_f: opts.feelsLike ? opts.feelsLike[i] : null,
    wind_mph: opts.wind ? opts.wind[i] : 5,
    precip_chance: opts.precip ? opts.precip[i] : 0,
  }));
}

function days(specs) {
  return specs.map((precip_chance, i) => ({
    date: `2026-06-${String(7 + i).padStart(2, '0')}`,
    condition_code: 'clear',
    high_f: 70,
    low_f: 52,
    precip_chance,
  }));
}

function build(overrides = {}) {
  return buildGoodDayTiles({
    weather: { hourly: hours([62, 64, 66, 68, 70, 70, 68, 66, 62]), daily: days([0, 10, 10]) },
    aqi: { index: 38, category_label: 'Good' },
    timezone: TZ,
    homeType: 'single_family',
    now: NOW,
    ...overrides,
  });
}

function tileById(result, id) {
  return result.tiles.find((t) => t.id === id);
}

describe('helpers', () => {
  test('upcomingHours drops the past and sorts forward', () => {
    const mixed = [
      { time: new Date(NOW.getTime() - 3600_000).toISOString(), temp_f: 55 },
      { time: new Date(NOW.getTime() + 7200_000).toISOString(), temp_f: 65 },
      { time: new Date(NOW.getTime() + 3600_000).toISOString(), temp_f: 60 },
    ];
    const out = upcomingHours(mixed, NOW);
    expect(out.map((h) => h.temp_f)).toEqual([60, 65]);
  });

  test('upcomingHours drops rows with no usable temperature', () => {
    const rows = [
      { time: new Date(NOW.getTime() + 3600_000).toISOString(), temp_f: null },
      { time: new Date(NOW.getTime() + 7200_000).toISOString(), temp_f: 60 },
    ];
    expect(upcomingHours(rows, NOW)).toHaveLength(1);
  });

  test('longestWindow returns the longest run, not the first', () => {
    const seq = [1, 0, 1, 1, 1, 0, 1];
    const win = longestWindow(seq.map((v) => ({ v })), (h) => h.v === 1);
    expect(win.length).toBe(3);
  });

  test('longestWindow is null when nothing qualifies', () => {
    expect(longestWindow([{ v: 0 }], (h) => h.v === 1)).toBeNull();
  });

  test('dayLabel says today / tomorrow before it says a weekday', () => {
    expect(dayLabel('2026-06-07', '2026-06-07')).toBe('today');
    expect(dayLabel('2026-06-08', '2026-06-07')).toBe('tomorrow');
    expect(dayLabel('2026-06-10', '2026-06-07')).toBe('Wednesday');
  });
});

describe('the row as a whole', () => {
  test('never exceeds five tiles', () => {
    expect(build().tiles.length).toBeLessThanOrEqual(5);
  });

  test('every tile shows its work', () => {
    for (const tile of build().tiles) {
      expect(tile.because.length).toBeGreaterThan(0);
      // A verdict with no number in it is an assertion, not a reason.
      expect(tile.because).toMatch(/\d/);
      expect(['yes', 'caution', 'no']).toContain(tile.verdict);
      expect(tile.id).toBeTruthy();
      expect(tile.label).toBeTruthy();
      expect(tile.glyph).toBeTruthy();
      expect(tile.answer).toBeTruthy();
    }
  });

  test('returns null rather than guessing when there is no data at all', () => {
    expect(buildGoodDayTiles({ weather: { hourly: [], daily: [] }, aqi: null, now: NOW })).toBeNull();
    expect(buildGoodDayTiles({})).toBeNull();
  });

  test('omits the AQI-dependent tile when air quality is unavailable', () => {
    const result = build({ aqi: null });
    expect(tileById(result, 'open_windows')).toBeUndefined();
    // The rest still answer.
    expect(tileById(result, 'run')).toBeDefined();
  });
});

describe('open windows', () => {
  test('says no when the air outside is worse than the air inside', () => {
    const tile = tileById(build({ aqi: { index: 168, category_label: 'Unhealthy' } }), 'open_windows');
    expect(tile.verdict).toBe('no');
    expect(tile.answer).toBe('Keep them closed');
    expect(tile.because).toContain('168');
  });

  test('says yes with a cutoff time when the air and the temperature agree', () => {
    const tile = tileById(build(), 'open_windows');
    expect(tile.verdict).toBe('yes');
    expect(tile.answer).toMatch(/^Yes — until \d+(am|pm)$/);
    expect(tile.because).toContain('AQI 38');
  });

  test('downgrades to caution on moderate air', () => {
    const tile = tileById(build({ aqi: { index: 72, category_label: 'Moderate' } }), 'open_windows');
    expect(tile.verdict).toBe('caution');
  });

  test('says too cold when it never reaches the comfort band', () => {
    const tile = tileById(build({
      weather: { hourly: hours([28, 30, 31, 33]), daily: days([0, 0]) },
    }), 'open_windows');
    expect(tile.verdict).toBe('no');
    expect(tile.answer).toBe('Too cold');
  });
});

describe('run', () => {
  test('names the best window', () => {
    const tile = tileById(build(), 'run');
    expect(tile.verdict).toBe('yes');
    expect(tile.answer).toMatch(/\d+(am|pm)/);
  });

  test('prefers feels-like over the raw temperature', () => {
    // 70°F air but feels like 95 — outside the comfortable band.
    const tile = tileById(build({
      weather: {
        hourly: hours([70, 70, 70], { feelsLike: [95, 96, 97] }),
        daily: days([0, 0]),
      },
    }), 'run');
    expect(tile.verdict).toBe('no');
  });

  test('says not today when rain covers the day', () => {
    const tile = tileById(build({
      weather: { hourly: hours([60, 61, 62], { precip: [80, 85, 90] }), daily: days([90, 80]) },
    }), 'run');
    expect(tile.verdict).toBe('no');
    expect(tile.because).toContain('90%');
  });
});

describe('wash the car', () => {
  test('says wait and names the day the rain arrives', () => {
    const tile = tileById(build({
      weather: { hourly: hours([62, 64]), daily: days([0, 10, 70]) },
    }), 'wash_car');
    expect(tile.verdict).toBe('no');
    expect(tile.answer).toContain('rain');
    expect(tile.because).toContain('70%');
  });

  test('says go ahead across a dry stretch', () => {
    const tile = tileById(build({
      weather: { hourly: hours([62, 64]), daily: days([0, 5, 10]) },
    }), 'wash_car');
    expect(tile.verdict).toBe('yes');
  });
});

describe('water the lawn', () => {
  test('says skip it when rain is coming', () => {
    const tile = tileById(build({
      weather: { hourly: hours([62, 64]), daily: days([0, 80]) },
    }), 'water_lawn');
    expect(tile.verdict).toBe('no');
    expect(tile.answer).toBe('Skip it');
  });

  test('is omitted for a home with no ground to water', () => {
    const result = build({ homeType: 'condo' });
    expect(tileById(result, 'water_lawn')).toBeUndefined();
    // The home-independent tiles still render.
    expect(tileById(result, 'wash_car')).toBeDefined();
  });

  test('renders when the home type is unknown', () => {
    expect(tileById(build({ homeType: null }), 'water_lawn')).toBeDefined();
  });
});

describe('grill', () => {
  test('says no when rain moves in this evening', () => {
    const tile = tileById(build({
      weather: {
        hourly: hours([70, 70, 70, 70, 70, 70, 70, 70, 70], { precip: [0, 0, 0, 70, 80, 80, 60, 50, 50] }),
        daily: days([0, 0]),
      },
    }), 'grill');
    expect(tile.verdict).toBe('no');
    expect(tile.answer).toBe('Rain moving in');
  });

  test('flags wind without forbidding it', () => {
    const tile = tileById(build({
      weather: {
        hourly: hours([70, 70, 70, 70, 70, 70, 70, 70, 70], { wind: [5, 5, 5, 28, 30, 26, 22, 20, 18] }),
        daily: days([0, 0]),
      },
    }), 'grill');
    expect(tile.verdict).toBe('caution');
    expect(tile.because).toMatch(/mph/);
  });
});

describe('regression — the window range must span the whole window', () => {
  test('reports the real min/max, not just the endpoints', () => {
    // Starts and ends at 62°F but peaks at 68°F. Reading only the
    // endpoints reported "62–62°F", which is a false range.
    const result = buildGoodDayTiles({
      weather: {
        hourly: hours([62, 63, 64, 66, 67, 68, 67, 65, 62]),
        daily: days([0, 10, 60]),
      },
      aqi: { index: 38, category_label: 'Good' },
      timezone: TZ,
      homeType: 'single_family',
      now: NOW,
    });
    expect(tileById(result, 'open_windows').because).toContain('62–68°F');
  });

  test('collapses a flat window to a single temperature', () => {
    const result = buildGoodDayTiles({
      weather: { hourly: hours([64, 64, 64]), daily: days([0, 0]) },
      aqi: { index: 20, category_label: 'Good' },
      timezone: TZ,
      now: NOW,
    });
    const because = tileById(result, 'open_windows').because;
    expect(because).toContain('64°F');
    expect(because).not.toContain('64–64');
  });
});
