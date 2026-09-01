// Unit tests for the Calendarly availability engine's pure core (no DB).
// Focus: interval math, DST-correct window construction, recurrence expansion, and the
// three composition modes (one_on_one, collective, round_robin).

const { DateTime } = require('luxon');
const { _internal } = require('../../services/scheduling/availabilityService');

const {
  mergeIntervals,
  subtractIntervals,
  intersectAll,
  intervalsCover,
  expandRecurrence,
  buildWeeklyWindows,
  memberFreeIntervals,
  computeSlotsCore,
} = _internal;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Helper: a UTC instant in ms for 2026-07-06 (a Monday).
function utc(dateStr) {
  return new Date(dateStr).getTime();
}

describe('interval math', () => {
  it('mergeIntervals merges overlapping and adjacent', () => {
    const merged = mergeIntervals([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 15, end: 20 },
      { start: 30, end: 40 },
    ]);
    expect(merged).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });

  it('subtractIntervals removes blockers, splitting where needed', () => {
    const free = subtractIntervals([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 50, end: 60 }]);
    expect(free).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ]);
  });

  it('intersectAll yields empty when any member has no free time (collective edge case)', () => {
    expect(intersectAll([[{ start: 0, end: 100 }], []])).toEqual([]);
  });

  it('intervalsCover requires full containment', () => {
    expect(intervalsCover([{ start: 0, end: 100 }], 10, 50)).toBe(true);
    expect(intervalsCover([{ start: 0, end: 40 }], 10, 50)).toBe(false);
  });
});

describe('buildWeeklyWindows — DST correctness', () => {
  const schedule = {
    timezone: 'America/New_York',
    rules: [{ weekday: 1, start_time: '09:00:00', end_time: '17:00:00' }], // Monday 9-5
    overrides: [],
  };

  it('a 9:00 rule stays 9:00 local across a spring-forward boundary', () => {
    // DST starts 2026-03-08. Mondays: 2026-03-02 (EST, UTC-5) and 2026-03-09 (EDT, UTC-4).
    const from = utc('2026-03-01T00:00:00Z');
    const to = utc('2026-03-15T00:00:00Z');
    const windows = buildWeeklyWindows(schedule, from, to);
    const startsLocal = windows.map((w) => DateTime.fromMillis(w.start, { zone: 'America/New_York' }));
    // Every window must begin at 09:00 local regardless of DST offset.
    for (const dt of startsLocal) {
      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    }
    // And the UTC instants must differ by the DST shift: Mar 2 -> 14:00Z, Mar 9 -> 13:00Z.
    const mar2 = windows.find((w) => DateTime.fromMillis(w.start, { zone: 'utc' }).toISODate() === '2026-03-02');
    const mar9 = windows.find((w) => DateTime.fromMillis(w.start, { zone: 'utc' }).toISODate() === '2026-03-09');
    expect(DateTime.fromMillis(mar2.start, { zone: 'utc' }).hour).toBe(14);
    expect(DateTime.fromMillis(mar9.start, { zone: 'utc' }).hour).toBe(13);
  });

  it('date override marking a day unavailable removes that day', () => {
    const sched = {
      ...schedule,
      overrides: [{ date: '2026-03-09', is_unavailable: true, start_time: null, end_time: null }],
    };
    const windows = buildWeeklyWindows(sched, utc('2026-03-08T00:00:00Z'), utc('2026-03-10T00:00:00Z'));
    expect(windows.length).toBe(0); // only Mar 9 (Mon) was in range, and it's blocked
  });

  it('date override with custom hours replaces the weekly rule', () => {
    const sched = {
      ...schedule,
      overrides: [{ date: '2026-03-09', is_unavailable: false, start_time: '13:00:00', end_time: '15:00:00' }],
    };
    const windows = buildWeeklyWindows(sched, utc('2026-03-09T00:00:00Z'), utc('2026-03-10T00:00:00Z'));
    expect(windows.length).toBe(1);
    expect(DateTime.fromMillis(windows[0].start, { zone: 'America/New_York' }).hour).toBe(13);
    expect(DateTime.fromMillis(windows[0].end, { zone: 'America/New_York' }).hour).toBe(15);
  });
});

describe('memberFreeIntervals — buffer math', () => {
  it('pads busy by [start - buffer_after, end + buffer_before] before subtracting', () => {
    const schedule = {
      timezone: 'UTC',
      rules: [{ weekday: 1, start_time: '09:00:00', end_time: '17:00:00' }],
      overrides: [],
    };
    const busy = [{ start: utc('2026-07-06T12:00:00Z'), end: utc('2026-07-06T13:00:00Z') }]; // noon-1pm
    const eventType = { buffer_before_min: 15, buffer_after_min: 15, default_duration: 30 };
    const free = memberFreeIntervals({ schedule, busy, eventType }, utc('2026-07-06T00:00:00Z'), utc('2026-07-07T00:00:00Z'));
    // Free should be 9:00-11:45 (busy starts noon, padded back 15m) and 13:15-17:00 (busy ends 1pm, padded fwd 15m).
    const second = free.find((iv) => DateTime.fromMillis(iv.start, { zone: 'utc' }).hour === 13);
    const first = free.find((iv) => DateTime.fromMillis(iv.start, { zone: 'utc' }).hour === 9);
    expect(DateTime.fromMillis(first.end, { zone: 'utc' }).toFormat('HH:mm')).toBe('11:45');
    expect(DateTime.fromMillis(second.start, { zone: 'utc' }).toFormat('HH:mm')).toBe('13:15');
  });

  it('buffer padding is ASYMMETRIC and correct (before=30/after=0) — guards against re-introducing the swap', () => {
    // A candidate placed BEFORE busy needs its AFTER buffer (0) to clear -> free runs to busy.start (12:00).
    // A candidate placed AFTER busy needs its BEFORE buffer (30) to clear -> free resumes at busy.end+30 (13:30).
    const schedule = {
      timezone: 'UTC',
      rules: [{ weekday: 1, start_time: '09:00:00', end_time: '17:00:00' }],
      overrides: [],
    };
    const busy = [{ start: utc('2026-07-06T12:00:00Z'), end: utc('2026-07-06T13:00:00Z') }];
    const eventType = { buffer_before_min: 30, buffer_after_min: 0, default_duration: 30 };
    const free = memberFreeIntervals({ schedule, busy, eventType }, utc('2026-07-06T00:00:00Z'), utc('2026-07-07T00:00:00Z'));
    const first = free.find((iv) => DateTime.fromMillis(iv.start, { zone: 'utc' }).hour === 9);
    const second = free.find((iv) => DateTime.fromMillis(iv.start, { zone: 'utc' }).hour >= 12);
    expect(DateTime.fromMillis(first.end, { zone: 'utc' }).toFormat('HH:mm')).toBe('12:00'); // after-buffer = 0
    expect(DateTime.fromMillis(second.start, { zone: 'utc' }).toFormat('HH:mm')).toBe('13:30'); // before-buffer = 30
  });
});

describe('expandRecurrence', () => {
  it('expands a weekly rule and includes occurrences whose anchor predates the window', () => {
    // Anchor: Mon 2026-06-01 09:00Z, 1h. Window: two weeks later.
    const anchor = utc('2026-06-01T09:00:00Z');
    const out = expandRecurrence('FREQ=WEEKLY;BYDAY=MO', anchor, HOUR, utc('2026-06-15T00:00:00Z'), utc('2026-06-22T00:00:00Z'));
    // Should include Mon 2026-06-15 (within window) even though anchor is 2 weeks earlier.
    const has615 = out.some((iv) => DateTime.fromMillis(iv.start, { zone: 'utc' }).toISODate() === '2026-06-15');
    expect(has615).toBe(true);
  });

  it('falls back to a single occurrence when the rule is empty/invalid', () => {
    const anchor = utc('2026-07-06T09:00:00Z');
    expect(expandRecurrence(null, anchor, HOUR, anchor - HOUR, anchor + HOUR)).toEqual([{ start: anchor, end: anchor + HOUR }]);
    expect(expandRecurrence('not-a-rule', anchor, HOUR, anchor - HOUR, anchor + HOUR)).toEqual([{ start: anchor, end: anchor + HOUR }]);
  });
});

describe('computeSlotsCore — composition modes', () => {
  const from = utc('2026-07-06T00:00:00Z');
  const to = utc('2026-07-07T00:00:00Z');
  const now = utc('2026-07-01T00:00:00Z'); // well before, so min_notice doesn't filter
  const baseEvent = { default_duration: 30, slot_interval_min: 30, min_notice_min: 0, max_horizon_days: 365 };

  it('one_on_one grids 30-min slots within a 3h window', () => {
    const membersFree = { m1: [{ start: utc('2026-07-06T09:00:00Z'), end: utc('2026-07-06T12:00:00Z') }] };
    const slots = computeSlotsCore({
      membersFree, memberIds: ['m1'], requiredMemberIds: ['m1'], mode: 'one_on_one',
      eventType: baseEvent, refTz: 'UTC', fromMs: from, toMs: to, nowMs: now,
    });
    expect(slots.map((s) => DateTime.fromMillis(s.startMs, { zone: 'utc' }).toFormat('HH:mm')))
      .toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
    expect(slots.every((s) => s.eligibleHosts.length === 1)).toBe(true);
  });

  it('collective offers only the intersection of required members', () => {
    const membersFree = {
      m1: [{ start: utc('2026-07-06T09:00:00Z'), end: utc('2026-07-06T12:00:00Z') }],
      m2: [{ start: utc('2026-07-06T10:00:00Z'), end: utc('2026-07-06T13:00:00Z') }],
    };
    const slots = computeSlotsCore({
      membersFree, memberIds: ['m1', 'm2'], requiredMemberIds: ['m1', 'm2'], mode: 'collective',
      eventType: { ...baseEvent, default_duration: 60, slot_interval_min: 60 },
      refTz: 'UTC', fromMs: from, toMs: to, nowMs: now,
    });
    // intersection 10:00-12:00 -> 10:00, 11:00
    expect(slots.map((s) => DateTime.fromMillis(s.startMs, { zone: 'utc' }).toFormat('HH:mm'))).toEqual(['10:00', '11:00']);
  });

  it('round_robin unions members and reports the eligible host set per slot', () => {
    const membersFree = {
      m1: [{ start: utc('2026-07-06T09:00:00Z'), end: utc('2026-07-06T11:00:00Z') }],
      m2: [{ start: utc('2026-07-06T10:00:00Z'), end: utc('2026-07-06T12:00:00Z') }],
    };
    const slots = computeSlotsCore({
      membersFree, memberIds: ['m1', 'm2'], requiredMemberIds: ['m1', 'm2'], mode: 'round_robin',
      eventType: { ...baseEvent, default_duration: 60, slot_interval_min: 60 },
      refTz: 'UTC', fromMs: from, toMs: to, nowMs: now,
    });
    const byTime = Object.fromEntries(
      slots.map((s) => [DateTime.fromMillis(s.startMs, { zone: 'utc' }).toFormat('HH:mm'), s.eligibleHosts.sort()])
    );
    expect(byTime['09:00']).toEqual(['m1']); // only m1 free 9-10
    expect(byTime['10:00']).toEqual(['m1', 'm2']); // both free 10-11
    expect(byTime['11:00']).toEqual(['m2']); // only m2 free 11-12
  });

  it('respects min_notice_min relative to now', () => {
    const soon = utc('2026-07-06T09:00:00Z');
    const membersFree = { m1: [{ start: soon, end: utc('2026-07-06T12:00:00Z') }] };
    const slots = computeSlotsCore({
      membersFree, memberIds: ['m1'], requiredMemberIds: ['m1'], mode: 'one_on_one',
      eventType: { ...baseEvent, min_notice_min: 24 * 60 }, // 24h notice
      refTz: 'UTC', fromMs: from, toMs: to,
      nowMs: utc('2026-07-06T08:00:00Z'), // 1h before window -> all filtered (need 24h notice)
    });
    expect(slots.length).toBe(0);
  });

  // Regression: a group booking used to mark the host busy, so the first attendee removed the
  // slot for everyone and a seat_cap of N could only ever sell 1 seat.
  describe('group seat capacity', () => {
    const window = { m1: [{ start: utc('2026-07-06T09:00:00Z'), end: utc('2026-07-06T10:00:00Z') }] };
    const groupEvent = { ...baseEvent, id: 'et-group', seat_cap: 3, assignment_mode: 'group' };
    const slotAt = utc('2026-07-06T09:00:00Z');

    const run = (groupSeatCounts) => computeSlotsCore({
      membersFree: window, memberIds: ['m1'], requiredMemberIds: ['m1'], mode: 'group',
      eventType: groupEvent, refTz: 'UTC', fromMs: from, toMs: to, nowMs: now, groupSeatCounts,
    });

    it('keeps a group slot open while seats remain', () => {
      expect(run(new Map()).some((s) => s.startMs === slotAt)).toBe(true);
      expect(run(new Map([[slotAt, 1]])).some((s) => s.startMs === slotAt)).toBe(true);
      expect(run(new Map([[slotAt, 2]])).some((s) => s.startMs === slotAt)).toBe(true);
    });

    it('drops the slot once seat_cap is reached', () => {
      expect(run(new Map([[slotAt, 3]])).some((s) => s.startMs === slotAt)).toBe(false);
      expect(run(new Map([[slotAt, 9]])).some((s) => s.startMs === slotAt)).toBe(false);
    });

    it('only closes the full instant, leaving other slots bookable', () => {
      const slots = run(new Map([[slotAt, 3]]));
      expect(slots.some((s) => s.startMs === utc('2026-07-06T09:30:00Z'))).toBe(true);
    });
  });

  // Regression: the grid was always built at default_duration, so booking any other allowed
  // duration could never match a slot and always 409'd SLOT_UNAVAILABLE.
  describe('multi-duration event types', () => {
    const membersFree = { m1: [{ start: utc('2026-07-06T09:00:00Z'), end: utc('2026-07-06T11:00:00Z') }] };
    const multi = { ...baseEvent, durations: [30, 60], default_duration: 30, slot_interval_min: 30 };
    const lengthsMin = (slots) => [...new Set(slots.map((s) => (s.endMs - s.startMs) / 60000))];

    const run = (durationMin) => computeSlotsCore({
      membersFree, memberIds: ['m1'], requiredMemberIds: ['m1'], mode: 'one_on_one',
      eventType: multi, refTz: 'UTC', fromMs: from, toMs: to, nowMs: now, durationMin,
    });

    it('builds the grid at the requested duration', () => {
      expect(lengthsMin(run(60))).toEqual([60]);
    });

    it('defaults to default_duration when none is requested', () => {
      expect(lengthsMin(run(undefined))).toEqual([30]);
    });

    it('ignores a duration the event type does not offer', () => {
      expect(lengthsMin(run(45))).toEqual([30]);
      expect(lengthsMin(run(-5))).toEqual([30]);
    });
  });
});
