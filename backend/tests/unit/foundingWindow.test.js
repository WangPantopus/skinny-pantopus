/**
 * The Founding Neighbor tier (Wedge v2 D5): first 5 verified homes in a
 * cell, within 21 days of the first. Derived from BlockFounder rows.
 */
jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
const { resetTables, seedTable } = require('../__mocks__/supabaseAdmin');
const fw = require('../../services/place/foundingWindow');

const CELL = 'c22zp5';
const at = (daysAfter) => new Date(Date.parse('2026-09-01T12:00:00.000Z') + daysAfter * 86400000).toISOString();
const founder = (rank, daysAfter) => ({ id: `f${rank}`, home_id: `h${rank}`, user_id: `u${rank}`, geohash6: CELL, rank, established_at: at(daysAfter) });

beforeEach(() => resetTables());

describe('cellFoundingWindow', () => {
  it('is fully open before any founder exists', async () => {
    const w = await fw.cellFoundingWindow(CELL, new Date(at(0)));
    expect(w).toMatchObject({ open: true, taken: 0, slots_open: 5, opened_at: null, ends_at: null });
  });

  it('opens with the first founder and counts slots taken inside 21 days', async () => {
    seedTable('BlockFounder', [founder(1, 0), founder(2, 3), founder(3, 10)]);
    const w = await fw.cellFoundingWindow(CELL, new Date(at(12)));
    expect(w.ends_at).toBe(at(21));
    expect(w).toMatchObject({ taken: 3, slots_open: 2, open: true });
  });

  it('closes when the fifth slot is taken, and when the window expires', async () => {
    seedTable('BlockFounder', [founder(1, 0), founder(2, 1), founder(3, 2), founder(4, 3), founder(5, 4), founder(6, 5)]);
    const full = await fw.cellFoundingWindow(CELL, new Date(at(6)));
    expect(full).toMatchObject({ taken: 5, slots_open: 0, open: false });
    resetTables();
    seedTable('BlockFounder', [founder(1, 0), founder(2, 30)]); // #2 arrived after the deadline
    const late = await fw.cellFoundingWindow(CELL, new Date(at(31)));
    expect(late).toMatchObject({ taken: 1, slots_open: 0, open: false });
    expect(fw.isFoundingRow(founder(2, 30), late)).toBe(false);
    expect(fw.isFoundingRow(founder(1, 0), late)).toBe(true);
  });

  it('a rank above 5 is never founding, even inside the window', async () => {
    seedTable('BlockFounder', [founder(1, 0)]);
    const w = await fw.cellFoundingWindow(CELL, new Date(at(1)));
    expect(fw.isFoundingRow(founder(6, 1), w)).toBe(false);
    expect(fw.isFoundingRow(founder(5, 1), w)).toBe(true);
  });
});

describe('foundingSlotsOpen (the preview boolean)', () => {
  it('never throws and answers a boolean', async () => {
    expect(await fw.foundingSlotsOpen(CELL)).toBe(true);
    seedTable('BlockFounder', [1, 2, 3, 4, 5].map((r) => founder(r, 0)));
    expect(await fw.foundingSlotsOpen(CELL, new Date(at(1)))).toBe(false);
  });
});
