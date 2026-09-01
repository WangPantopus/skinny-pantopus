/**
 * Home Record Watch (Wave 2b) — the free half: the refi-window rate
 * watch on Freddie Mac PMMS data.
 *
 * The resident enters the month their loan was recorded; we freeze
 * that month's PMMS 30-year average as the baseline and compare the
 * current weekly average against it. When the market average sits
 * REFI_WINDOW_DROP_PP or more below the baseline, the weekly job sends
 * one push — and stays quiet until rates drop meaningfully further or
 * a long re-alert window passes, so the channel never nags.
 *
 * Language rule (the legal gate): every surface states averages and
 * deltas — "the market average is now X, about Y points below the
 * average for the month your loan was recorded" — and NEVER
 * "you should refinance", savings math, or personalized advice.
 *
 * The deed/lien half of Record Watch is NOT here: it needs the ATTOM
 * recorder dataset, and that trial-to-paid contract is an explicit
 * open business decision. This service is complete without it.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const { getPmmsHistory } = require('./pmmsService');

// The window: current weekly average at least this far below baseline.
const REFI_WINDOW_DROP_PP = 0.75;
// Re-alert only on a further drop of this much below the last alert…
const REALERT_DROP_PP = 0.25;
// …or after this long, whichever comes first.
const REALERT_AFTER_DAYS = 90;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

class WatchError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** The comparison every surface shows. Pure, exported for tests. */
function evaluate(watch, pmms) {
  if (!pmms || !pmms.latest) return null;
  const current = pmms.latest.rate;
  const delta = round2(current - Number(watch.baseline_rate));
  return {
    baseline_rate: Number(watch.baseline_rate),
    current_rate: current,
    current_as_of: pmms.latest.date,
    // The cache served an expired reading (Freddie Mac unreachable) —
    // the copy must date the number instead of calling it "now".
    stale: Boolean(pmms.stale),
    delta_pp: delta,
    refi_window: delta <= -REFI_WINDOW_DROP_PP,
  };
}

/** Should the weekly job alert for this watch right now? Pure. */
function shouldAlert(watch, evaluation, now = new Date()) {
  if (!evaluation || !evaluation.refi_window) return false;
  if (watch.last_alert_rate == null) return true;
  if (evaluation.current_rate <= Number(watch.last_alert_rate) - REALERT_DROP_PP) return true;
  if (!watch.last_alert_at) return true;
  const ageDays = (now - new Date(watch.last_alert_at)) / (24 * 60 * 60 * 1000);
  return ageDays >= REALERT_AFTER_DAYS;
}

function serializeWatch(row, pmms) {
  return {
    id: row.id,
    home_id: row.home_id,
    loan_recorded_month: row.loan_recorded_month,
    baseline_rate: Number(row.baseline_rate),
    created_at: row.created_at,
    evaluation: evaluate(row, pmms),
  };
}

// ── Lifecycle ────────────────────────────────────────────────

/** Create or replace the caller's watch for a home. */
async function setWatch({ homeId, userId, loanRecordedMonth }) {
  const month = String(loanRecordedMonth || '').trim();
  if (!MONTH_RE.test(month)) {
    throw new WatchError('Enter the month as YYYY-MM.', 'BAD_MONTH');
  }
  const pmms = await getPmmsHistory();
  if (!pmms) throw new WatchError('Rate history is unavailable right now. Try again shortly.', 'PMMS_UNAVAILABLE');
  const baseline = pmms.monthly[month];
  if (baseline == null) {
    // Pre-1971 or a future month — the survey has no average to hold
    // the market against, so the watch would be a guess. Fail closed.
    throw new WatchError('The mortgage survey has no data for that month.', 'MONTH_OUT_OF_RANGE');
  }

  const nowIso = new Date().toISOString();
  // No `id` in the payload: the column has a DB default, and supplying a
  // fresh uuid made the (home_id, user_id) conflict-update REWRITE the
  // row's primary key on every month edit.
  const { data, error } = await supabaseAdmin
    .from('HomeRecordWatch')
    .upsert(
      {
        home_id: homeId,
        user_id: userId,
        loan_recorded_month: month,
        baseline_rate: baseline,
        // Editing the month resets alert bookkeeping — a new baseline
        // is a new watch as far as idempotence is concerned.
        last_alert_rate: null,
        last_alert_at: null,
        updated_at: nowIso,
      },
      { onConflict: 'home_id,user_id' },
    )
    .select()
    .single();
  if (error) {
    logger.error('recordWatch: upsert failed', { homeId, userId, error: error.message });
    throw new Error('Could not save the watch');
  }
  return serializeWatch(data, pmms);
}

/** The caller's watch for a home (with a live evaluation), or null. */
async function getWatch({ homeId, userId }) {
  const { data, error } = await supabaseAdmin
    .from('HomeRecordWatch')
    .select('*')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const pmms = await getPmmsHistory();
  return serializeWatch(data, pmms);
}

/** Delete — returns true when a row was removed. */
async function deleteWatch({ homeId, userId }) {
  const { data, error } = await supabaseAdmin
    .from('HomeRecordWatch')
    .delete()
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .select();
  if (error) {
    logger.error('recordWatch: delete failed', { homeId, userId, error: error.message });
    throw new Error('Could not remove the watch');
  }
  return Boolean(data && data.length);
}

// ── The weekly evaluation job ────────────────────────────────

function alertBody(evaluation, watch) {
  const [year, month] = watch.loan_recorded_month.split('-');
  const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const drop = Math.abs(evaluation.delta_pp).toFixed(2);
  // Averages and deltas only — never advice. A stale reading is dated,
  // never stated as "now".
  const lead = evaluation.stale && evaluation.current_as_of
    ? `The 30-year mortgage average was ${evaluation.current_rate.toFixed(2)}% in the latest available survey (week of ${evaluation.current_as_of})`
    : `The 30-year mortgage average is now ${evaluation.current_rate.toFixed(2)}%`;
  return `${lead} — about ${drop} points below the ${monthName} average of ${evaluation.baseline_rate.toFixed(2)}%, the month your loan was recorded.`;
}

/**
 * Evaluate every watch against the current PMMS reading; alert the
 * ones whose refi window is open (idempotent via shouldAlert). Claim
 * BEFORE dispatching, mirroring mailDayNotification: multiple
 * instances run this without leader election, so the alert bookkeeping
 * update is the claim, and losing the race means skipping.
 * @returns {Promise<{evaluated: number, alerted: number}>}
 */
async function evaluateWatches() {
  const pmms = await getPmmsHistory();
  if (!pmms) {
    logger.warn('recordWatch: skipping evaluation — PMMS unavailable');
    return { evaluated: 0, alerted: 0 };
  }

  // Page the scan: PostgREST silently truncates unpaginated selects at
  // the server's max-rows cap (1000 on hosted Supabase), which would
  // permanently and silently exclude every watch past the cap — the job
  // would report success while most users never get their alert. Same
  // pattern as billBenchmarkRefresh.
  const BATCH_SIZE = 1000;
  const watches = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data: page, error } = await supabaseAdmin
      .from('HomeRecordWatch')
      .select('*')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) {
      logger.warn('recordWatch: scan failed', { error: error.message, offset });
      return { evaluated: 0, alerted: 0 };
    }
    watches.push(...(page || []));
    if (!page || page.length < BATCH_SIZE) break;
  }

  let alerted = 0;
  const nowIso = new Date().toISOString();
  for (const watch of watches) {
    const evaluation = evaluate(watch, pmms);
    if (!shouldAlert(watch, evaluation)) continue;

    // The claim: only the instance that flips the bookkeeping sends.
    const { data: claimed } = await supabaseAdmin
      .from('HomeRecordWatch')
      .update({ last_alert_rate: evaluation.current_rate, last_alert_at: nowIso, updated_at: nowIso })
      .eq('id', watch.id)
      .eq('updated_at', watch.updated_at)
      .select()
      .maybeSingle();
    if (!claimed) continue;

    const created = await notificationService.createNotification({
      userId: watch.user_id,
      type: 'rate_watch',
      title: 'Rates are below your loan month’s average',
      body: alertBody(evaluation, watch),
      icon: '📉',
      // The deep-link vocabulary both mobile routers parse (host `place`
      // + section query); the web notification resolver maps it to
      // /app/place/money. The old `/place/<homeId>/money` routed nowhere
      // on any client.
      link: '/place?section=money',
      metadata: {
        home_id: watch.home_id,
        baseline_rate: evaluation.baseline_rate,
        current_rate: evaluation.current_rate,
        delta_pp: evaluation.delta_pp,
      },
    });
    if (created) {
      alerted += 1;
    } else {
      // Dispatch failed — hand the claim back so a later run retries.
      await supabaseAdmin
        .from('HomeRecordWatch')
        .update({ last_alert_rate: watch.last_alert_rate, last_alert_at: watch.last_alert_at })
        .eq('id', watch.id)
        .then(() => {});
    }
  }
  logger.info('recordWatch: evaluation complete', { evaluated: watches.length, alerted });
  return { evaluated: watches.length, alerted };
}

module.exports = {
  setWatch,
  getWatch,
  deleteWatch,
  evaluateWatches,
  WatchError,
  // Exported for testing.
  evaluate,
  shouldAlert,
  REFI_WINDOW_DROP_PP,
  REALERT_DROP_PP,
  REALERT_AFTER_DAYS,
};
