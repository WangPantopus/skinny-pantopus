// ============================================================
// MAIL DAY — shared triage primitives
//
// `ensureTodayItems` materialises today's triage queue for a user from the
// unresolved `MailRoutingQueue` rows on their accessible homes. It lived
// inside routes/mailDay.js with exactly one caller, `GET /today`.
//
// That made it the ONLY writer of `MailDayItem` outside a dev-only seed
// route — which quietly inverted the Mail Day push. The notification job
// picks its candidates from `MailDayItem`, so a user who had not already
// opened the Mail Day screen that day had no rows and could not be
// notified: the push only reached people who had already visited the
// surface it advertises, which is the opposite of "schedule off the scan,
// not the clock".
//
// Extracted here so the job can materialise the same rows the screen
// would, from the same source, rather than duplicating the mapping.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// PostgREST silently truncates unpaginated selects at the server's
// max-rows cap (1000 on hosted Supabase) — a scan that "works" in dev
// quietly drops rows in production. Every table walk below pages in
// BATCH_SIZE steps, and .in() lists are chunked so the GET URL stays
// under gateway limits.
const BATCH_SIZE = 1000;
const IN_CHUNK_SIZE = 200;
// The most unresolved pieces one user's day materializes — see
// ensureTodayItems.
const MATERIALIZE_ROW_CAP = 200;

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Homes the user actively occupies.
 *
 * The error is CHECKED, not dropped. A failed read here returns [] just
 * like "this user occupies nothing", so ensureTodayItems early-returns 0
 * and reports success — the same invisible failure that killed Mail Day
 * once already, one function upstream of where it was fixed.
 * @returns {Promise<string[]|null>} null on a read FAILURE (distinct
 *   from [] meaning "genuinely no homes").
 */
async function getAccessibleHomeIds(userId) {
  // One implementation of "which homes may this user read mail for": the
  // hardened, expiry-aware query in utils/homeMailAccess. Only the failure
  // semantics differ here (null, never []).
  const { trustedHomeIdsOrThrow } = require('../utils/homeMailAccess');
  try {
    return await trustedHomeIdsOrThrow(userId);
  } catch (error) {
    logger.error('Mail day: occupancy read failed', { userId, error: error.message });
    return null;
  }
}

// Mail object type / category → the faux-photo MailDayKind the screen
// renders. Mirrors the Android `kindFor` mapping.
function kindFor(objectType, category) {
  if (category && String(category).toLowerCase().includes('bill')) return 'bill';
  switch (objectType) {
    case 'package': return 'package';
    case 'postcard': return 'postcard';
    case 'booklet': return 'magazine';
    case 'bundle': return 'flyer';
    default: return 'envelope';
  }
}

/**
 * Materialise today's triage queue for a user, if it isn't already there.
 *
 * Idempotent: returns early when the user already has rows for `today`.
 * Never throws — a failed backfill must not take down the screen that
 * calls it, nor the notification job.
 *
 * @param {string} userId
 * @param {string} today  UTC YYYY-MM-DD (matches MailDayItem.day_date)
 * @returns {Promise<number>} rows inserted (0 when nothing to do)
 */
async function ensureTodayItems(userId, today) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('MailDayItem')
      .select('id')
      .eq('user_id', userId)
      .eq('day_date', today)
      .limit(1);
    if (existing && existing.length > 0) return 0;

    const homeIds = await getAccessibleHomeIds(userId);
    // null = the read FAILED; [] = genuinely no homes. Only the second
    // is "nothing to do".
    if (homeIds === null) return 0;
    if (homeIds.length === 0) return 0;

    // Newest scans first, capped: a long-unresolved backlog otherwise
    // re-materializes in FULL as fresh rows every day, for every
    // occupant, forever — the triage screen is a daily ritual, not a
    // dumping ground, and the full backlog still lives in the mailbox.
    const { data: queue, error: queueErr } = await supabaseAdmin
      .from('MailRoutingQueue')
      .select('*, Mail!inner(*)')
      .in('home_id', homeIds)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .range(0, MATERIALIZE_ROW_CAP - 1);
    if (queueErr) {
      logger.error('Mail day: queue read failed', { userId, error: queueErr.message });
      return 0;
    }
    const rows = queue || [];
    if (rows.length === 0) return 0;

    const nowIso = new Date().toISOString();
    const inserts = rows.map((q) => {
      const mail = q.Mail || {};
      return {
        user_id: userId,
        home_id: q.home_id || null,
        mail_id: q.mail_id,
        kind: kindFor(mail.mail_object_type, mail.category),
        label: (mail.subject && String(mail.subject).trim()) || 'Mail',
        sender: mail.sender_display || mail.sender_business_name || null,
        suggested_name: q.recipient_name_raw || mail.recipient_name || '',
        suggested_avatar: 'personal_sky',
        confidence_percent: Math.round(Math.min(1, Math.max(0, q.best_match_confidence || 0)) * 100),
        secondary_label: 'Other',
        status: 'unreviewed',
        action: null,
        day_date: today,
        scanned_at: mail.created_at || nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
    });
    // Upsert-ignore, not insert: the empty-check above is a check-then-act
    // with no lock, and this runs from every app instance's cron AND from
    // GET /today. The unique index on (user_id, day_date, mail_id) makes
    // the race's loser a silent no-op instead of a duplicated triage queue.
    //
    // The index MUST be non-partial (migration 173) — Postgres cannot
    // infer a partial index from `ON CONFLICT (cols)` without repeating
    // its predicate, which PostgREST cannot emit, so a partial index
    // makes every call raise 42P10.
    //
    // And the result MUST be checked: this failure mode was invisible
    // precisely because it was not. A dropped error here means an empty
    // triage screen and no daily push, reported as success.
    const { error: writeErr } = await supabaseAdmin
      .from('MailDayItem')
      .upsert(inserts, { onConflict: 'user_id,day_date,mail_id', ignoreDuplicates: true });
    if (writeErr) {
      logger.error('Mail day materialization failed', {
        userId,
        rows: inserts.length,
        code: writeErr.code,
        error: writeErr.message,
      });
      return 0;
    }
    return inserts.length;
  } catch (err) {
    logger.warn('Mail day backfill failed (non-fatal)', { userId, error: err.message });
    return 0;
  }
}

/**
 * Users who have physical mail waiting to be triaged — the scan side.
 *
 * This is what the notification job must key off. It walks unresolved
 * `MailRoutingQueue` rows to the homes they belong to, then to the people
 * who actively occupy those homes, so a scan reaches its recipients
 * whether or not anyone has opened the app today.
 *
 * @returns {Promise<string[]>} distinct user ids
 */
async function usersWithUnresolvedMail() {
  const homeIdSet = new Set();
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data: queue, error } = await supabaseAdmin
      .from('MailRoutingQueue')
      .select('home_id')
      .eq('resolved', false)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const q of queue || []) {
      if (q && q.home_id) homeIdSet.add(q.home_id);
    }
    if (!queue || queue.length < BATCH_SIZE) break;
  }
  const homeIds = [...homeIdSet];
  if (homeIds.length === 0) return [];

  const userIds = new Set();
  for (const homeChunk of chunk(homeIds, IN_CHUNK_SIZE)) {
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const { data: occupants, error: occErr } = await supabaseAdmin
        .from('HomeOccupancy')
        .select('user_id')
        .in('home_id', homeChunk)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);
      if (occErr) throw new Error(occErr.message);
      for (const o of occupants || []) {
        if (o && o.user_id) userIds.add(o.user_id);
      }
      if (!occupants || occupants.length < BATCH_SIZE) break;
    }
  }
  return [...userIds];
}

module.exports = {
  ensureTodayItems,
  usersWithUnresolvedMail,
  getAccessibleHomeIds,
  kindFor,
};
