/**
 * A vacation hold that holds (Mail tab, SRV-5). While a person is away, their own ordinary mail waits; special
 * deliveries still come, and Home mail keeps arriving for the rest of the household. The morning they come back
 * (7 a.m. on the hold's end date, in their own zone), everything held arrives together inside one bundle piece,
 * "Held while you were away · 12 pieces", that opens to its pieces.
 *
 * A hold keeps its dates in VacationHold (vacation_hold_transition). A held piece keeps its delivery time at the
 * release round and remembers the hold and its own natural time in mail_extracted (vacation_hold_id,
 * natural_delivered_at), so starting, changing, ending or cancelling a hold moves the waiting pieces (syncHeldMail):
 * a piece no hold keeps any more goes back to its own round, or the next one when that has passed.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { DateTime } = require('luxon');
const { createHash } = require('crypto');

const ACTIVE = ['scheduled', 'active'];

function delivery() {
  // eslint-disable-next-line global-require
  return require('./mailDelivery');
}

/** The person's current holds, each with the window it holds: [{ hold, from, release }]. */
async function holdWindows(userId) {
  if (!userId) return [];
  const { data, error } = await supabaseAdmin.from('VacationHold').select('*').eq('user_id', userId).in('status', ACTIVE)
    .order('start_date').order('id');
  if (error) throw new Error(error.message);
  if (!data?.length) return [];
  const timeZone = (await delivery().personTimeZone(userId)) || delivery().FALLBACK_TIME_ZONE;
  const at = (date, hour) => DateTime.fromISO(String(date).slice(0, 10), { zone: timeZone })
    .set({ hour, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  return data.map((hold) => ({ hold, from: at(hold.start_date, 0), release: at(hold.end_date, delivery().MORNING_HOUR) }))
    .filter((w) => w.release > w.from);
}

// A release inside another hold is still held. Follow the entire connected
// window, including a later hold that starts at the previous return round.
// Keep the first hold's identity so its waiting pieces share one bundle.
function holding(windows, when) {
  let held = null;
  for (const w of windows) {
    if (!held) {
      if (when >= w.from && when < w.release) held = w;
    } else if (w.from <= held.release && w.release > held.release) {
      held = { ...held, release: w.release, hold: { ...held.hold, end_date: w.hold.end_date } };
    }
  }
  return held;
}

/**
 * The delivery rule's hook (services/mailDelivery): when one of this person's holds keeps an ordinary piece of their
 * own mail that would come at `natural`, the hold and the time it arrives instead.
 */
async function heldUntil(piece, natural) {
  // Home mail keeps coming for the household, a letter for this person at the Home included.
  if (!piece?.recipient_user_id || piece.recipient_home_id) return null;
  const w = holding(await holdWindows(piece.recipient_user_id), natural);
  return w ? { until: w.release, holdId: w.hold.id } : null;
}

// Stable identity makes concurrent send/hold/job syncs converge on one wrapper.
function bundleIdFor(userId, holdId) {
  const hash = createHash('sha1').update(`pantopus:vacation-bundle:${userId}:${holdId}`).digest('hex').slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20)}`;
}

const BUNDLE_LABEL = (n) => `Held while you were away · ${n} ${n === 1 ? 'piece' : 'pieces'}`;

/**
 * Bring one person's waiting mail in line with their holds now. A piece a current hold keeps waits for its release
 * round. A piece a hold kept that no hold keeps any more (the hold ended early, was cancelled or shortened) comes at
 * the next round. Either way the pieces one hold kept arrive together inside one bundle; held counts stay current.
 * Idempotent. Answers { held, released }.
 */
async function syncHeldMail(userId, now = new Date()) {
  const windows = await holdWindows(userId);
  const { nextRound, personTimeZone, FALLBACK_TIME_ZONE } = delivery();
  const timeZone = (await personTimeZone(userId)) || FALLBACK_TIME_ZONE;
  const waiting = [];
  // Read the stable candidate set before updating delivery times. PostgREST caps
  // a response even when limit(2000) asks for more; no piece may escape a hold.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from('Mail')
      .select('id, delivered_at, special_delivery, mail_extracted, mail_object_type, bundle_id, lifecycle')
      .eq('recipient_user_id', userId).is('recipient_home_id', null).eq('special_delivery', false)
      .gt('delivered_at', now.toISOString()).is('deleted_at', null)
      .order('id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    waiting.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  const pieces = (waiting || []).filter((m) => m.mail_object_type !== 'bundle' && !m.mail_extracted?.vacation_bundle_hold_id);
  // hold id -> { release, pieces }: current holds release on their return morning, others at the next round.
  const groups = new Map(windows.map((w) => [w.hold.id, { release: w.release, pieces: [] }]));
  const round = nextRound(timeZone, now);
  let held = 0; let released = 0;
  for (const piece of pieces) {
    const extracted = piece.mail_extracted || {};
    const natural = new Date(extracted.natural_delivered_at || piece.delivered_at);
    const due = natural <= now ? round : natural;
    const w = holding(windows, due);
    const holdId = w ? w.hold.id : extracted.vacation_hold_id || null;
    if (!holdId) continue;
    if (!groups.has(holdId)) groups.set(holdId, { release: round, pieces: [] });
    const group = groups.get(holdId);
    if (w && w.release > group.release) group.release = w.release;
    group.pieces.push(piece);
    const at = w ? w.release : group.release;
    const next = { delivered_at: at.toISOString(),
      mail_extracted: { ...extracted, vacation_hold_id: holdId, natural_delivered_at: natural.toISOString() } };
    if (Date.parse(next.delivered_at) === Date.parse(piece.delivered_at) && extracted.vacation_hold_id === holdId) continue;
    const { error: writeError } = await supabaseAdmin.from('Mail').update(next).eq('id', piece.id);
    if (writeError) throw new Error(writeError.message);
    if (w) held += 1; else released += 1;
  }
  await syncBundles(userId, groups, now);
  for (const w of windows) {
    const count = groups.get(w.hold.id).pieces.length;
    if (w.hold.items_held_count !== count) {
      await supabaseAdmin.from('VacationHold').update({ items_held_count: count }).eq('id', w.hold.id);
    }
  }
  return { held, released };
}

// One bundle per hold with waiting pieces, arriving with them; a hold with none has no waiting bundle.
async function syncBundles(userId, groups, now) {
  const { data: bundles, error } = await supabaseAdmin.from('Mail').select('id, mail_extracted, delivered_at')
    .eq('recipient_user_id', userId).eq('mail_object_type', 'bundle').gt('delivered_at', now.toISOString())
    .is('deleted_at', null).not('mail_extracted->>vacation_bundle_hold_id', 'is', null).order('id');
  if (error) throw new Error(error.message);
  for (const bundle of bundles || []) {
    if (!groups.get(bundle.mail_extracted.vacation_bundle_hold_id)?.pieces.length) {
      // Its pieces left the hold: the bundle never arrives (nothing showed it yet).
      await supabaseAdmin.from('Mail').update({ deleted_at: now.toISOString() }).eq('id', bundle.id);
    }
  }
  for (const [holdId, { release, pieces }] of groups) {
    if (!pieces.length) continue;
    const label = BUNDLE_LABEL(pieces.length);
    const matching = (bundles || []).filter((b) => b.mail_extracted.vacation_bundle_hold_id === holdId);
    const existing = matching[0];
    const fields = { bundle_label: label, bundle_item_count: pieces.length, subject: label, display_title: label,
      delivered_at: release.toISOString(),
      content: `Mail that came while you were away: ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}.` };
    let bundleId = existing?.id;
    if (bundleId) {
      const { error: writeError } = await supabaseAdmin.from('Mail').update(fields).eq('id', bundleId);
      if (writeError) throw new Error(writeError.message);
    } else {
      const { data: made, error: makeError } = await supabaseAdmin.from('Mail').upsert({
        id: bundleIdFor(userId, holdId), deleted_at: null, ...fields, recipient_user_id: userId, drawer: 'personal', type: 'other', mail_type: 'other',
        mail_object_type: 'bundle', bundle_type: 'auto', collapsed_by_default: true, sender_display: 'Pantopus',
        sender_trust: 'verified_business', lifecycle: 'delivered', special_delivery: false,
        mail_extracted: { vacation_bundle_hold_id: holdId, from_pantopus: true, summary_source: 'sender' },
      }, { onConflict: 'id' }).select('id').single();
      if (makeError) throw new Error(makeError.message);
      bundleId = made.id;
    }
    // Reconcile duplicate waiting wrappers made by earlier concurrent syncs.
    for (const duplicate of matching.slice(1)) {
      const { error: removeError } = await supabaseAdmin.from('Mail').update({ deleted_at: now.toISOString() }).eq('id', duplicate.id);
      if (removeError) throw new Error(removeError.message);
    }
    for (let offset = 0; offset < pieces.length; offset += 100) {
      const { error: linkError } = await supabaseAdmin.from('Mail').update({ bundle_id: bundleId })
        .in('id', pieces.slice(offset, offset + 100).map((p) => p.id));
      if (linkError) throw new Error(linkError.message);
    }
  }
}

/** Sync after a hold changed; a failure is logged, and the next change or the hourly job tries again. */
async function syncHeldMailSafe(userId) {
  try {
    return await syncHeldMail(userId);
  } catch (error) {
    logger.error('Vacation hold mail sync failed', { error: error.message });
    return null;
  }
}

/**
 * The mailbox's vacation line: the hold in effect or the next one, with how many pieces it holds now, or null.
 * { status: 'scheduled' | 'active', start_date, end_date, held_count, release_at }.
 */
async function vacationLine(userId, now = new Date()) {
  const windows = await holdWindows(userId);
  const upcoming = windows.find((x) => x.from > now);
  const w = holding(windows, now) || (upcoming ? holding(windows, upcoming.from) : null);
  if (!w) return null;
  const { count, error } = await supabaseAdmin.from('Mail').select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId).eq('mail_extracted->>vacation_hold_id', w.hold.id).is('deleted_at', null)
    .gt('delivered_at', now.toISOString());
  if (error) throw new Error(error.message);
  return { status: now >= w.from ? 'active' : 'scheduled', start_date: w.hold.start_date, end_date: w.hold.end_date,
    held_count: count || 0, release_at: w.release.toISOString(), hold_id: w.hold.id };
}

module.exports = { holdWindows, heldUntil, syncHeldMail, syncHeldMailSafe, vacationLine, BUNDLE_LABEL };
