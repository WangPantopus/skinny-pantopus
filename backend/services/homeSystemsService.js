// ============================================================
// SYSTEMS LEDGER — the six building systems, with provenance
//
// Turns the home's build year into a starting ledger, then lets real
// evidence upgrade it over time. Two rules govern the whole file:
//
//   1. NEVER BLANK. Every system is seeded from `Home.year_built` and a
//      typical-life prior, labelled "estimated from year built". Gating
//      the tiles on permit coverage would leave most homes staring at six
//      empty boxes — Shovels covers roughly 2,750 of ~20,000 US
//      permit-issuing jurisdictions, strong in metros and near-zero
//      rural — and a flagship that renders empty is how a flagship dies.
//
//   2. NEVER OVERCLAIM. Each row carries how we know it, and an estimate
//      is never dressed up as a fact. A resident's correction outranks
//      everything we derived, permanently: the person standing in the
//      building is the better source.
//
// Service-life figures are the widely published typical ranges (the
// InterNACHI standard life-expectancy chart and the NAHB/Bank of America
// component-life study). They are ranges, not point predictions, and the
// UI presents them as "typical service life" rather than a countdown to
// failure — a model that turns a tile red and immediately upsells our own
// marketplace is a scare-and-sell engine, not a record.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// key → label, typical service life range in years, and whether the
// system is plausibly original to the building (drives seeding).
const SYSTEM_DEFS = [
  {
    key: 'roof',
    label: 'Roof',
    // Asphalt shingle, the common US case.
    life_low: 20,
    life_high: 25,
    note: 'Asphalt shingle roofs typically last 20–25 years.',
  },
  {
    key: 'hvac',
    label: 'Heating & cooling',
    life_low: 15,
    life_high: 20,
    note: 'Furnaces typically last 15–20 years; central air units less.',
  },
  {
    key: 'water_heater',
    label: 'Water heater',
    life_low: 8,
    life_high: 12,
    note: 'Tank water heaters typically last 8–12 years.',
  },
  {
    key: 'electrical_panel',
    label: 'Electrical panel',
    life_low: 40,
    life_high: 60,
    note: 'Panels last decades, but capacity and recalled brands matter more than age.',
  },
  {
    key: 'sewer_septic',
    label: 'Sewer / septic',
    life_low: 30,
    life_high: 40,
    note: 'Septic tanks typically last 30–40 years; sewer laterals longer.',
  },
  {
    key: 'windows',
    label: 'Windows',
    life_low: 20,
    life_high: 30,
    note: 'Windows typically last 20–30 years before seals fail.',
  },
];

const SYSTEM_KEYS = SYSTEM_DEFS.map((d) => d.key);
const DEF_BY_KEY = Object.fromEntries(SYSTEM_DEFS.map((d) => [d.key, d]));

// Provenance ranking. A correction from the household can never be
// overwritten by something we inferred.
const SOURCE_RANK = { estimated: 0, permit: 1, marketplace: 2, resident: 3 };

const SOURCE_LABELS = {
  estimated: 'Estimated from year built',
  permit: 'From a permit record',
  marketplace: 'From a completed job',
  resident: 'You told us',
};

const SOURCE_CONFIDENCE = {
  estimated: 'low',
  permit: 'medium',
  marketplace: 'high',
  resident: 'high',
};

function currentYear(now = new Date()) {
  return now.getUTCFullYear();
}

function intOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/**
 * Status from age against the typical range.
 *   ok             comfortably inside expected life
 *   aging          inside the replacement window
 *   past_expected  beyond the typical range
 *   unknown        no install year to reason from
 */
function statusFor(age, def) {
  if (age === null) return 'unknown';
  if (age < def.life_low) return 'ok';
  if (age < def.life_high) return 'aging';
  return 'past_expected';
}

/**
 * A 0–1 "life remaining" figure for the bar. Deliberately measured
 * against the HIGH bound so a system inside its replacement window still
 * shows something left — it is a range, not a countdown to failure.
 */
function remainingFraction(age, def) {
  if (age === null) return null;
  const frac = 1 - age / def.life_high;
  return Math.max(0, Math.min(1, Math.round(frac * 100) / 100));
}

/**
 * Project one stored (or absent) row into the presented shape.
 * `yearBuilt` seeds the estimate when nothing better is on file.
 */
function projectSystem(def, row, yearBuilt, now = new Date()) {
  const stored = intOrNull(row && row.installed_year);
  const source = (row && row.source) || 'estimated';

  // With no stored year, fall back to the building's own age. A system is
  // presumed original until someone tells us otherwise — which is the
  // conservative reading, and the one that prompts a correction.
  const installedYear = stored !== null ? stored : intOrNull(yearBuilt);
  const effectiveSource = stored !== null ? source : 'estimated';

  const age = installedYear === null ? null : Math.max(0, currentYear(now) - installedYear);

  return {
    key: def.key,
    label: def.label,
    installed_year: installedYear,
    age_years: age,
    typical_life_low: def.life_low,
    typical_life_high: def.life_high,
    status: statusFor(age, def),
    life_remaining: remainingFraction(age, def),
    source: effectiveSource,
    source_label: SOURCE_LABELS[effectiveSource] || SOURCE_LABELS.estimated,
    confidence: SOURCE_CONFIDENCE[effectiveSource] || 'low',
    source_ref: (row && row.source_ref) || null,
    note: def.note,
  };
}

/**
 * The ledger for a home: always six systems, in a stable order.
 *
 * Reads whatever is stored and fills the rest from the build year. It does
 * NOT write seed rows — an estimate is not a record, and persisting one
 * would make it look like the household confirmed something they never saw.
 *
 * @param {object} home  { id, year_built }
 * @returns {Promise<{systems: object[], summary: object}|null>}
 */
async function getSystemsLedger(home, { now = new Date() } = {}) {
  if (!home || !home.id) return null;

  let rows = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('HomeSystem')
      .select('system_key, installed_year, source, source_ref')
      .eq('home_id', home.id);
    if (error) throw new Error(error.message);
    rows = data || [];
  } catch (err) {
    logger.warn('homeSystems: read failed', { homeId: home.id, error: err.message });
    // Degrade to the estimated ledger rather than showing nothing.
    rows = [];
  }

  const byKey = {};
  for (const r of rows) if (r && r.system_key) byKey[r.system_key] = r;

  const systems = SYSTEM_DEFS.map((def) => projectSystem(def, byKey[def.key], home.year_built, now));

  const past = systems.filter((s) => s.status === 'past_expected');
  const aging = systems.filter((s) => s.status === 'aging');
  const confirmed = systems.filter((s) => s.source !== 'estimated');

  return {
    systems,
    summary: {
      past_expected_count: past.length,
      aging_count: aging.length,
      // How much of the ledger rests on real evidence rather than a prior.
      confirmed_count: confirmed.length,
      total_count: systems.length,
      headline: buildHeadline(past, aging, confirmed.length, systems.length),
    },
  };
}

function buildHeadline(past, aging, confirmedCount, total) {
  if (past.length > 0) {
    const names = past.map((s) => s.label.toLowerCase());
    const list = names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `Past typical service life: ${list}.`;
  }
  if (aging.length > 0) {
    return `${aging.length} system${aging.length === 1 ? '' : 's'} inside the usual replacement window.`;
  }
  if (confirmedCount === 0) {
    return `All six estimated from the build year — correct any you know and the record starts building.`;
  }
  return `Nothing past its expected life. ${confirmedCount} of ${total} confirmed.`;
}

/**
 * Record what the household knows. A resident entry is the highest-ranked
 * source, so it always wins; derived sources never overwrite it.
 *
 * @param {object} params
 * @param {string} params.homeId
 * @param {string} params.systemKey
 * @param {number|null} params.installedYear
 * @param {string} [params.source='resident']
 * @param {string} [params.sourceRef]
 * @param {string} [params.userId]
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function recordSystem({ homeId, systemKey, installedYear, source = 'resident', sourceRef, userId }) {
  if (!homeId || !SYSTEM_KEYS.includes(systemKey)) {
    return { ok: false, reason: 'invalid_system' };
  }
  if (!(source in SOURCE_RANK)) return { ok: false, reason: 'invalid_source' };

  const year = intOrNull(installedYear);
  if (year !== null && (year < 1700 || year > currentYear() + 1)) {
    return { ok: false, reason: 'invalid_year' };
  }

  try {
    // The error is checked, not dropped: a transient read failure used to
    // leave `existing` null, skip the SOURCE_RANK ratchet below, and fall
    // through to an unconditional upsert — exactly how a derived source
    // could overwrite what the household told us.
    const { data: existing, error: readErr } = await supabaseAdmin
      .from('HomeSystem')
      .select('id, source')
      .eq('home_id', homeId)
      .eq('system_key', systemKey)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    // Provenance only ratchets up. A permit or a completed job must never
    // silently overwrite what the person living there told us.
    if (existing && SOURCE_RANK[existing.source] > SOURCE_RANK[source]) {
      return { ok: false, reason: 'outranked' };
    }

    const nowIso = new Date().toISOString();
    // supabase-js never throws on query errors — an unchecked upsert
    // would confirm { ok: true } to a resident whose correction was
    // silently dropped.
    const { error: writeErr } = await supabaseAdmin
      .from('HomeSystem')
      .upsert({
        home_id: homeId,
        system_key: systemKey,
        installed_year: year,
        source,
        source_ref: sourceRef || null,
        updated_by: userId || null,
        updated_at: nowIso,
      }, { onConflict: 'home_id,system_key' });
    if (writeErr) throw new Error(writeErr.message);

    return { ok: true };
  } catch (err) {
    logger.error('homeSystems: write failed', { homeId, systemKey, error: err.message });
    return { ok: false, reason: 'write_failed' };
  }
}

/**
 * Provenance capture — a paid, confirmed job at this address.
 *
 * Called after payment captures and the owner confirms, so the row only
 * ever records work that really happened and was really paid for.
 *
 * Deliberately writes the SERVICE HISTORY and not the system's install
 * year. A completed "roofing" gig does not tell us whether the roof was
 * replaced or a flashing was patched, and silently resetting a 25-year
 * clock on that guess would be exactly the overclaiming this ledger
 * exists to avoid. The install year stays the resident's to confirm.
 *
 * This is the half that compounds: a prompt converts at 20–30%, automatic
 * capture converts at 100%, and Angi knows a price was quoted in a ZIP
 * while this knows a dispute-free job happened at a verified address on a
 * specific date. Never throws — provenance must not be able to fail a
 * payment path.
 *
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function recordCompletedJob({ homeId, gigId, title, category, price, performedBy, performedAt }) {
  if (!homeId || !gigId) return { ok: false, reason: 'missing_home_or_gig' };

  try {
    // One row per gig. Backed by a partial unique index on gig_id
    // (migration 163), so this read is a fast path rather than the
    // guarantee — two concurrent owner-confirms are stopped by the index,
    // not by the check. The error is surfaced rather than dropped: a failed
    // read used to fall through to an unconditional insert.
    const { data: existing, error: readErr } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .select('id')
      .eq('gig_id', gigId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (existing) return { ok: true, reason: 'already_recorded' };

    const nowIso = new Date().toISOString();
    const { error: writeErr } = await supabaseAdmin
      .from('HomeMaintenanceLog')
      .insert({
        home_id: homeId,
        task: String(title || category || 'Completed job').slice(0, 200),
        performed_at: performedAt || nowIso,
        performed_by: performedBy || null,
        cost: Number.isFinite(Number(price)) ? Number(price) : null,
        // The gig id is the evidence pointer — it is what makes this row
        // verifiable rather than a self-reported claim. It lives in its own
        // column so the guarantee does not rest on user-visible free text.
        gig_id: gigId,
        status: 'completed',
        recurrence: 'one_time',
        created_at: nowIso,
        updated_at: nowIso,
      });
    if (writeErr) {
      // The partial unique index on gig_id is the real guarantee — a
      // concurrent confirm losing to it is success, not failure.
      if (writeErr.code === '23505') return { ok: true, reason: 'already_recorded' };
      throw new Error(writeErr.message);
    }

    return { ok: true };
  } catch (err) {
    logger.warn('homeSystems: provenance capture failed', { homeId, gigId, error: err.message });
    return { ok: false, reason: 'write_failed' };
  }
}

module.exports = {
  getSystemsLedger,
  recordCompletedJob,
  recordSystem,
  SYSTEM_DEFS,
  SYSTEM_KEYS,
  SOURCE_RANK,
  // Exported for unit testing.
  projectSystem,
  statusFor,
  remainingFraction,
  buildHeadline,
};
