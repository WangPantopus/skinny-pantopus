// ============================================================
// FOUNDING WINDOW — the scarce, deadline-bound tier on top of the
// permanent Block Founder rank (Wedge v2, D5).
//
// Ranks are permanent and unbounded (Block Founder #N). The Founding
// Neighbor tier is the first FOUNDING_SLOTS verified homes in a cell,
// taken within FOUNDING_WINDOW_DAYS of the cell's first founder — the
// mechanic Nextdoor's Leads ran on ("10 in 21 days"): a threshold makes
// a goal, a deadline makes a reason to act today.
//
// Derived from the rank rows, never stored, so it cannot drift from them.
// This module depends only on the database client so the anonymous
// preview can ask "are slots open here?" without loading the mail stack.
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');

const FOUNDING_SLOTS = 5;
const FOUNDING_WINDOW_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cell's founding window.
 * @returns {Promise<{opened_at: string|null, ends_at: string|null, open: boolean, taken: number, slots_total: number, slots_open: number}>}
 */
async function cellFoundingWindow(geohash6, now = new Date()) {
  const { data: first } = await supabaseAdmin
    .from('BlockFounder')
    .select('established_at')
    .eq('geohash6', geohash6)
    .eq('rank', 1)
    .maybeSingle();

  if (!first) {
    // No founder yet: the window opens with the first one, so every slot is open.
    return { opened_at: null, ends_at: null, open: true, taken: 0, slots_total: FOUNDING_SLOTS, slots_open: FOUNDING_SLOTS };
  }

  const openedAt = new Date(first.established_at);
  const endsAt = new Date(openedAt.getTime() + FOUNDING_WINDOW_DAYS * DAY_MS);
  const { data: rows } = await supabaseAdmin
    .from('BlockFounder')
    .select('rank, established_at')
    .eq('geohash6', geohash6)
    .lte('rank', FOUNDING_SLOTS);
  const taken = (rows || []).filter((r) => new Date(r.established_at).getTime() <= endsAt.getTime()).length;
  const withinWindow = now.getTime() <= endsAt.getTime();
  const slotsOpen = withinWindow ? Math.max(0, FOUNDING_SLOTS - taken) : 0;
  return {
    opened_at: openedAt.toISOString(),
    ends_at: endsAt.toISOString(),
    open: slotsOpen > 0,
    taken,
    slots_total: FOUNDING_SLOTS,
    slots_open: slotsOpen,
  };
}

/** Is this founder row inside the tier? (rank ≤ slots and taken before the window closed) */
function isFoundingRow(founder, window) {
  if (!founder || !window || !window.ends_at) return false;
  return founder.rank <= FOUNDING_SLOTS
    && new Date(founder.established_at).getTime() <= new Date(window.ends_at).getTime();
}

/** Cheap boolean for the anonymous preview's density label. Never a count. */
async function foundingSlotsOpen(geohash6, now = new Date()) {
  try {
    return (await cellFoundingWindow(geohash6, now)).open;
  } catch {
    return false;
  }
}

module.exports = {
  cellFoundingWindow,
  isFoundingRow,
  foundingSlotsOpen,
  FOUNDING_SLOTS,
  FOUNDING_WINDOW_DAYS,
};
