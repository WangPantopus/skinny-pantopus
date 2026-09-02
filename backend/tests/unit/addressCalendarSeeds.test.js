/**
 * The calendar registry's seed migrations are data, and data drifts: a
 * typo in an RRULE or a dtstart that disagrees with its rule would ship
 * a wrong reminder to every home in a state. This parses the seed SQL
 * and checks every row the way the service will read it.
 */
const fs = require('fs');
const path = require('path');
const { RRule } = require('rrule');

const FILES = ['195_address_calendar_rules.sql', '197_address_calendar_state_rules.sql'];

function parseRows(sql) {
  // Each tuple: ('scope', 'key', 'kind', 'title', 'detail', 'rrule', 'dtstart', lead, 'source', url|NULL, 'confidence')
  const rows = [];
  const re = /\(\s*'(state|county|city|home)',\s*'([^']*)',\s*'([^']*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'([^']*)',\s*'(\d{4}-\d{2}-\d{2})',\s*(\d+),\s*'((?:[^']|'')*)',\s*(NULL|'[^']*'),\s*'(official|unverified)'\s*\)/g;
  let m;
  while ((m = re.exec(sql))) {
    rows.push({ scope_type: m[1], scope_key: m[2], kind: m[3], title: m[4], detail: m[5], rrule: m[6], dtstart: m[7], lead_days: Number(m[8]), source: m[9], source_url: m[10], confidence: m[11] });
  }
  return rows;
}

const rows = FILES.flatMap((f) => parseRows(fs.readFileSync(path.join(__dirname, '../../database/migrations', f), 'utf8')));

describe('address calendar seeds', () => {
  it('parses every seeded row', () => {
    expect(rows.length).toBeGreaterThan(70);
    expect(rows.filter((r) => r.scope_type === 'state' && r.kind === 'property_tax').length).toBeGreaterThan(65);
  });

  it('every RRULE parses and its dtstart is an occurrence of the rule', () => {
    for (const r of rows) {
      const options = RRule.parseString(r.rrule);
      const start = new Date(`${r.dtstart}T12:00:00Z`);
      const rule = new RRule({ ...options, dtstart: start });
      const next = rule.after(new Date(start.getTime() - 1), true);
      expect({ row: r.title, key: r.scope_key, first: next && next.toISOString().slice(0, 10) })
        .toEqual({ row: r.title, key: r.scope_key, first: r.dtstart });
    }
  });

  it('state tax rules cover the statewide-schedule states once per installment, never the county-set ones', () => {
    const byState = new Map();
    for (const r of rows.filter((x) => x.scope_type === 'state' && x.kind === 'property_tax')) {
      byState.set(r.scope_key, (byState.get(r.scope_key) || 0) + 1);
    }
    for (const absent of ['AK', 'GA', 'IL', 'ME', 'NE', 'NH', 'NY', 'OH', 'PA', 'RI', 'VT', 'VA']) expect(byState.has(absent)).toBe(false);
    for (const present of ['WA', 'OR', 'CA', 'TX', 'FL', 'NJ', 'NV', 'DC']) expect(byState.has(present)).toBe(true);
    // No duplicate dates within a state.
    const seen = new Set();
    for (const r of rows.filter((x) => x.scope_type === 'state')) {
      const key = `${r.scope_key}|${r.rrule}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('only Washington is official; every other seed says so and cites a source', () => {
    for (const r of rows.filter((x) => x.scope_type === 'state')) {
      if (r.scope_key === 'WA') expect(r.confidence).toBe('official');
      else expect(r.confidence).toBe('unverified');
      expect(r.source.length).toBeGreaterThan(3);
      expect(r.lead_days).toBeGreaterThanOrEqual(7);
    }
  });
});
