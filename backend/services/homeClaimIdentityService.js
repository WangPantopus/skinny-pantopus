/**
 * Stripe Identity checks for home claims. Approval needs a confirmed identity
 * (mutate_home_claim_review), and the claimant confirms it with a Stripe
 * Identity document and selfie check. Every result is read from Stripe itself,
 * by the webhook or by reading the session when the claimant comes back, and
 * recorded by record_home_claim_identity_check; nothing the app reports counts.
 *
 * Production runs live checks only: a test-mode check lets anyone pick
 * "verified". STRIPE_IDENTITY_SECRET_KEY can be a restricted key that only
 * reads and writes Identity, so payments can stay in test mode.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const MESSAGES = {
  IDENTITY_CHECK_UNAVAILABLE: 'Identity checks aren\'t available right now. Your claim is unchanged.',
  IDENTITY_ALREADY_CONFIRMED: 'Your identity is already confirmed for this claim.',
  IDENTITY_CHECK_PROCESSING: 'Stripe is still checking your ID. This usually takes a few minutes.',
  IDENTITY_CHECK_LIMIT: 'You\'ve started several identity checks today. Please try again tomorrow.',
  IDENTITY_CHECK_ATTEMPTS: 'Your ID couldn\'t be confirmed after several tries. Contact Pantopus support for help with this claim.',
  IDENTITY_CHECK_NOT_OPEN: 'This claim isn\'t waiting for review anymore.',
  IDENTITY_CHECK_INVALID: 'Check the identity check details and try again.',
  CLAIM_NOT_FOUND: 'Claim not found.',
  CLAIM_RECIPIENT_MISMATCH: 'This claim belongs to another account.',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Sessions a person may start in a day, across all their claims, and submissions one session takes
// before it's no longer offered. Stripe bills every submitted check, passed or not.
const DAILY_SESSION_LIMIT = 5;
const SESSION_ATTEMPT_LIMIT = 3;

function failure(code = 'IDENTITY_CHECK_UNAVAILABLE', status = 503) {
  return Object.assign(new Error(MESSAGES[code] || MESSAGES.IDENTITY_CHECK_UNAVAILABLE), { code, status, statusCode: status });
}

function sendError(res, error) {
  const safe = error?.code && Object.hasOwn(MESSAGES, error.code) ? error : failure();
  if (safe === error && safe.status >= 500) logger.warn('Identity check unavailable', { errorCode: error.code });
  return res.status(safe.statusCode).json({ error: safe.message, code: safe.code });
}

function config() {
  const production = process.env.APP_ENV === 'production';
  const key = process.env.STRIPE_IDENTITY_SECRET_KEY || (production ? '' : process.env.STRIPE_SECRET_KEY || '');
  const live = /^(sk|rk)_live_/.test(key);
  return {
    available: /^(sk|rk)_(live|test)_/.test(key) && (!production || live),
    key,
    live,
    webhookSecret: process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || '',
  };
}

let cachedClient = null;
function stripeClient() {
  const { key } = config();
  if (cachedClient?.key === key) return cachedClient.client;
  const stripeModule = require('stripe');
  const stripeCtor = typeof stripeModule === 'function' ? stripeModule : stripeModule?.default;
  if (typeof stripeCtor !== 'function') throw new TypeError('Stripe SDK module did not export a constructor');
  cachedClient = { key, client: stripeCtor(key) };
  return cachedClient.client;
}

/** Our name for where a Stripe verification session stands. */
function checkStatus(session) {
  switch (session?.status) {
    case 'verified': return 'verified';
    case 'processing': return 'processing';
    case 'canceled': return 'canceled';
    // A session waits for input before the first attempt, after the person closed it
    // (abandoned) and after a failed attempt; only the last needs a new try.
    case 'requires_input': return session.last_error?.code && session.last_error.code !== 'abandoned' ? 'requires_input' : 'started';
    default: return null;
  }
}

async function retrieveSession(sessionId) {
  const stripe = stripeClient();
  let session;
  try {
    session = await stripe.identity.verificationSessions.retrieve(sessionId);
  } catch (error) {
    logger.warn('Stripe Identity session read failed', { errorType: error?.type, errorCode: error?.code });
    throw failure();
  }
  if (session?.status !== 'verified') return { session, verifiedName: null };
  // The name on the ID lets a reviewer compare it with the ownership document. A key without
  // access to verified outputs still records the check, just without the name.
  try {
    const expanded = await stripe.identity.verificationSessions.retrieve(sessionId, { expand: ['verified_outputs'] });
    const outputs = expanded?.verified_outputs;
    const name = [outputs?.first_name, outputs?.last_name].filter(part => typeof part === 'string' && part.trim()).join(' ').trim();
    return { session, verifiedName: name ? name.slice(0, 200) : null };
  } catch (error) {
    logger.warn('Stripe Identity verified outputs unavailable', { errorType: error?.type, errorCode: error?.code });
    return { session, verifiedName: null };
  }
}

function reportId(session) {
  const report = session?.last_verification_report;
  const id = typeof report === 'string' ? report : report?.id;
  return typeof id === 'string' && /^vr_[A-Za-z0-9]{1,200}$/.test(id) ? id : null;
}

async function rpc(name, args) {
  let response;
  try { response = await supabaseAdmin.rpc(name, args); } catch (_) { throw failure(); }
  if (!response || response.error || response.data == null) throw failure();
  return response.data;
}

async function record({ claimId, userId, session, verifiedName = null }) {
  const status = checkStatus(session);
  if (!status || typeof session.id !== 'string') throw failure();
  const result = await rpc('record_home_claim_identity_check', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_session_id: session.id,
    p_status: status,
    p_livemode: session.livemode === true,
    p_observed_at: new Date().toISOString(),
    p_error_code: status === 'requires_input' ? String(session.last_error.code).slice(0, 100) : null,
    p_verified_name: status === 'verified' ? verifiedName : null,
    p_report_id: reportId(session),
  });
  if (result.ok !== true) {
    throw Object.hasOwn(MESSAGES, result.code) && [400, 403, 404, 409].includes(result.status)
      ? failure(result.code, result.status) : failure();
  }
  return result;
}

/** Approval progress for claims, keyed by claim id (see home_claim_approval_progress). */
async function progressFor(claimIds) {
  const ids = [...new Set(claimIds)].filter(id => UUID.test(id));
  if (!ids.length) return new Map();
  const rows = await rpc('home_claim_approval_progress', { p_claim_ids: ids });
  if (!Array.isArray(rows)) throw failure();
  return new Map(rows.map(row => [row.claim_id, row]));
}

/** What the claimant's checklist shows. */
function claimantApproval(progress) {
  if (!progress) return null;
  return {
    identity: progress.identity,
    identity_check_available: config().available,
    proof: progress.proof,
  };
}

/** What a reviewer sees before approving, with the name on a confirmed ID. */
async function reviewerApproval(claimId) {
  const progress = (await progressFor([claimId])).get(claimId);
  if (!progress) throw failure();
  let identityName = null;
  if (progress.identity_confirmed) {
    const { data, error } = await supabaseAdmin
      .from('HomeVerificationEvidence')
      .select('metadata, updated_at')
      .eq('claim_id', claimId)
      .eq('provider', 'stripe_identity')
      .eq('evidence_type', 'idv')
      .eq('status', 'verified')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw failure();
    identityName = typeof data?.[0]?.metadata?.verified_name === 'string' ? data[0].metadata.verified_name : null;
  }
  return {
    identity_confirmed: progress.identity_confirmed === true,
    identity: progress.identity,
    identity_name: identityName,
    identity_checked_at: progress.identity_checked_at || null,
    proof: progress.proof,
    can_approve: progress.identity_confirmed === true && progress.proof === 'verified',
  };
}

/** The reviewer's approval panel, or null when it can't be read (the review still opens). */
async function reviewerApprovalOrNull(claimId) {
  try {
    return await reviewerApproval(claimId);
  } catch (error) {
    logger.warn('Claim approval progress unavailable', { errorCode: error?.code });
    return null;
  }
}

/** Identity checks are shown on their own, never as a document. */
function withoutIdentityEvidence(evidence) {
  return Array.isArray(evidence) ? evidence.filter(item => item?.evidence_type !== 'idv') : evidence;
}

async function ownClaim({ homeId, claimId, userId }) {
  if (!UUID.test(homeId || '') || !UUID.test(claimId || '')) throw failure('CLAIM_NOT_FOUND', 404);
  const { data, error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, home_id, claimant_user_id')
    .eq('id', claimId)
    .maybeSingle();
  if (error) throw failure();
  // Someone else's claim reads as missing, so ids can't be probed.
  if (!data || data.home_id !== homeId || data.claimant_user_id !== userId) throw failure('CLAIM_NOT_FOUND', 404);
  return data;
}

/** The newest check on a claim that could still change, in this key's mode. */
async function openSession(claimId) {
  const { data, error } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('metadata, created_at')
    .eq('claim_id', claimId)
    .eq('provider', 'stripe_identity')
    .eq('evidence_type', 'idv')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw failure();
  const live = config().live;
  const row = (data || []).find(item => item.metadata?.livemode === live
    && ['started', 'processing', 'requires_input'].includes(item.metadata?.check_status));
  return row ? { sessionId: row.metadata.session_id, checkStatus: row.metadata.check_status,
    attempts: Number(row.metadata.attempts) || 0, sessions: (data || []).length } : { sessions: (data || []).length };
}

async function sessionsStartedToday(userId) {
  const { data: claims, error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id')
    .eq('claimant_user_id', userId);
  if (error) throw failure();
  const ids = (claims || []).map(claim => claim.id);
  if (!ids.length) return 0;
  const { count, error: countError } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('id', { count: 'exact', head: true })
    .in('claim_id', ids)
    .eq('provider', 'stripe_identity')
    .eq('evidence_type', 'idv')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (countError) throw failure();
  return count || 0;
}

/**
 * Start (or continue) the claimant's identity check. Returns the Stripe page to open,
 * or no page when the check is already with Stripe or done.
 */
async function start({ homeId, claimId, userId, returnUrl }) {
  const settings = config();
  await ownClaim({ homeId, claimId, userId });
  if (!settings.available) throw failure('IDENTITY_CHECK_UNAVAILABLE', 503);
  const progress = (await progressFor([claimId])).get(claimId);
  if (!progress?.active) throw failure('IDENTITY_CHECK_NOT_OPEN', 409);
  if (progress.identity_confirmed) throw failure('IDENTITY_ALREADY_CONFIRMED', 409);

  // An open session is continued, never doubled: Stripe keeps the person's progress in it.
  const open = await openSession(claimId);
  if (open.sessionId) {
    const { session, verifiedName } = await retrieveSession(open.sessionId);
    if (session?.metadata?.claim_id !== claimId || session.livemode !== settings.live) throw failure();
    await record({ claimId, userId, session, verifiedName });
    if (session.status === 'verified') throw failure('IDENTITY_ALREADY_CONFIRMED', 409);
    if (session.status === 'processing') throw failure('IDENTITY_CHECK_PROCESSING', 409);
    if (session.status === 'requires_input') {
      if (open.attempts >= SESSION_ATTEMPT_LIMIT && session.last_error?.code !== 'abandoned') {
        throw failure('IDENTITY_CHECK_ATTEMPTS', 409);
      }
      // Retrieving a waiting session hands out a fresh single-use link; it's never stored.
      if (session.url) return { verification_url: session.url };
    }
  }

  if (await sessionsStartedToday(userId) >= DAILY_SESSION_LIMIT) throw failure('IDENTITY_CHECK_LIMIT', 429);
  let session;
  try {
    session = await stripeClient().identity.verificationSessions.create({
      type: 'document',
      options: {
        document: {
          allowed_types: ['driving_license', 'passport', 'id_card'],
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      client_reference_id: claimId,
      metadata: { claim_id: claimId, home_id: homeId, user_id: userId },
      ...(returnUrl ? { return_url: returnUrl } : {}),
    }, { idempotencyKey: `home-claim-identity-${claimId}-${open.sessions}` });
  } catch (error) {
    logger.warn('Stripe Identity session create failed', { errorType: error?.type, errorCode: error?.code });
    throw failure();
  }
  await record({ claimId, userId, session });
  return { verification_url: session.url };
}

/** The claimant's checklist after re-reading an open check from Stripe. */
async function refresh({ homeId, claimId, userId }) {
  await ownClaim({ homeId, claimId, userId });
  if (config().available) {
    // A check that needed another try may have been retried since, so it's re-read too.
    const open = await openSession(claimId);
    if (open.sessionId) {
      try {
        const { session, verifiedName } = await retrieveSession(open.sessionId);
        if (session?.metadata?.claim_id === claimId) await record({ claimId, userId, session, verifiedName });
      } catch (error) {
        // The last recorded state stays; the webhook or the next read catches up.
        logger.warn('Identity check refresh failed', { errorCode: error?.code });
      }
    }
  }
  return claimantApproval((await progressFor([claimId])).get(claimId));
}

/** A signed identity.verification_session.* event: record the session as Stripe has it now. */
async function handleWebhookEvent(event) {
  const object = event?.data?.object;
  const claimId = object?.metadata?.claim_id;
  const userId = object?.metadata?.user_id;
  if (object?.object !== 'identity.verification_session' || !UUID.test(claimId || '') || !UUID.test(userId || '')) {
    return { handled: false };
  }
  if (event.type === 'identity.verification_session.redacted') return { handled: false };
  const { session, verifiedName } = await retrieveSession(object.id);
  if (session?.metadata?.claim_id !== claimId || session?.metadata?.user_id !== userId) return { handled: false };
  try {
    const result = await record({ claimId, userId, session, verifiedName });
    return { handled: true, recorded: result.recorded === true };
  } catch (error) {
    // A claim that's gone or belongs to someone else never succeeds on a retry.
    if ([400, 403, 404].includes(error.status)) {
      logger.warn('Identity check event not recorded', { errorCode: error.code });
      return { handled: false };
    }
    throw error;
  }
}

module.exports = {
  config,
  start,
  refresh,
  handleWebhookEvent,
  progressFor,
  claimantApproval,
  reviewerApproval,
  reviewerApprovalOrNull,
  withoutIdentityEvidence,
  sendError,
  stripeClient,
};
