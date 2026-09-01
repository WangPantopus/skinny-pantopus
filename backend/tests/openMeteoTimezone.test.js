// ============================================================
// TEST: Open-Meteo local→UTC reconstruction
//
// Open-Meteo is queried with `timezone=auto`, so it returns NAIVE LOCAL
// timestamps ("2026-08-19T22:00") and carries the offset separately in
// `utc_offset_seconds`. Those strings were passed through verbatim into a
// field named `datetime_utc`, where `new Date(...)` parses them in the
// SERVER's zone — shifting and truncating every hour-based verdict tile
// and freeze window, silently, on the Open-Meteo fallback path.
//
// WeatherKit is unaffected (it returns real Z-suffixed instants), which is
// why this only bites when WeatherKit is unconfigured or its circuit is open.
// ============================================================

const { localToUtcIso } = require('../services/context/providers/openMeteo');

describe('localToUtcIso', () => {
  test('reconstructs the absolute instant from a naive local string', () => {
    // 22:00 at UTC-7 is 05:00 UTC the next day.
    expect(localToUtcIso('2026-08-19T22:00', -25200)).toBe('2026-08-20T05:00:00.000Z');
  });

  test('handles an eastern (positive) offset', () => {
    // 09:00 at UTC+2 is 07:00 UTC the same day.
    expect(localToUtcIso('2026-08-19T09:00', 7200)).toBe('2026-08-19T07:00:00.000Z');
  });

  test('is identity at UTC', () => {
    expect(localToUtcIso('2026-08-19T22:00', 0)).toBe('2026-08-19T22:00:00.000Z');
  });

  test('leaves an already-absolute timestamp alone', () => {
    // WeatherKit's forecastStart is a real instant and must not be shifted.
    expect(localToUtcIso('2026-08-19T22:00:00Z', -25200)).toBe('2026-08-19T22:00:00Z');
    expect(localToUtcIso('2026-08-19T22:00:00-07:00', -25200)).toBe('2026-08-19T22:00:00-07:00');
  });

  test('degrades to empty rather than an Invalid Date', () => {
    expect(localToUtcIso(null, -25200)).toBe('');
    expect(localToUtcIso('', -25200)).toBe('');
    expect(localToUtcIso('not-a-date', -25200)).toBe('');
    expect(localToUtcIso(12345, -25200)).toBe('');
  });

  test('treats a missing offset as UTC rather than producing NaN', () => {
    expect(localToUtcIso('2026-08-19T22:00', undefined)).toBe('2026-08-19T22:00:00.000Z');
    expect(localToUtcIso('2026-08-19T22:00', null)).toBe('2026-08-19T22:00:00.000Z');
  });

  test('the shift is exactly the offset — the bug was a whole-offset error', () => {
    const naive = '2026-12-01T06:00';
    const utc = Date.parse(localToUtcIso(naive, -28800)); // UTC-8
    const naiveAsIfUtc = Date.parse(`${naive}Z`);
    expect(utc - naiveAsIfUtc).toBe(8 * 3600 * 1000);
  });
});
