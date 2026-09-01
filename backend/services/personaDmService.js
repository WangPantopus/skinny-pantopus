// Persona DM service.
//
// Audience Profile design v2 §5.3 (DM tables), §7.2 (capability
// semantics: thread is the unit of quota consumption; once open, the
// thread allows unlimited back-and-forth), §13.4 (quota tests).
//
// P1.11 — pure data plumbing. The HTTP routes + reply-policy SLA
// enforcement + audience-context notifications land in P1.12.
//
// Design choices for the test surface:
//   * The mock supabaseAdmin doesn't parse Supabase nested-select
//     syntax (`*, foo:bar(...)`), so we never use it. The service
//     fetches membership / tier / persona in separate calls — the
//     same pattern as utils/identityProfiles.getPersonaMembershipForUser.
//   * Quota consumption and thread creation are not transactional in
//     real Postgres without RPCs; the service rolls back the quota
//     row by setting reverted_at if thread creation fails.
//   * Unread counters are bumped via read-modify-write rather than
//     an RPC. Concurrent sends to the same thread can race; this is
//     acceptable for v1.0 (rare in practice) and noted as P1.13
//     follow-up if it surfaces.

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { computeQuotaRemaining } = require('../utils/personaQuotas');

// One year in the future, used as a default period_end for memberships
// without a Stripe-driven period (free Followers, P1.7-pending paid
// tiers). Quota usage rows tied to such memberships effectively never
// roll, which is the right behaviour for free tiers.
const FAR_FUTURE_MS = 365 * 24 * 3600 * 1000;
function farFutureIso() {
  return new Date(Date.now() + FAR_FUTURE_MS).toISOString();
}

// Read membership + tier + persona in three separate calls. Returns
// null when the membership doesn't exist OR is in a terminal status.
// `active` and `past_due` retain DM access (audience-profile §7.3).
async function loadActiveMembership(personaId, fanUserId) {
  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('*')
    .eq('persona_id', personaId)
    .eq('user_id', fanUserId)
    .maybeSingle();
  if (!membership) return null;
  if (!['active', 'past_due'].includes(membership.status)) return null;

  let tier = null;
  if (membership.tier_id) {
    const { data: tierRow } = await supabaseAdmin
      .from('PersonaTier')
      .select('id, rank, msg_threads_per_period, creator_can_initiate_dm, reply_policy')
      .eq('id', membership.tier_id)
      .maybeSingle();
    tier = tierRow || null;
  }

  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, handle, display_name')
    .eq('id', personaId)
    .maybeSingle();

  return { ...membership, tier, persona };
}

async function isFanBlocked(personaId, fanUserId) {
  const { data } = await supabaseAdmin
    .from('PersonaBlock')
    .select('id')
    .eq('persona_id', personaId)
    .eq('blocked_user_id', fanUserId)
    .maybeSingle();
  return !!data;
}

// Compute remaining msg_thread quota in the membership's current
// period. Returns { limit, used, remaining } — limit/remaining are
// null when the tier doesn't grant DMs (e.g. Follower).
async function getMsgThreadQuota(membership) {
  const limit = membership?.tier?.msg_threads_per_period ?? null;
  if (limit == null) {
    return { limit: null, used: 0, remaining: null };
  }
  const periodStart = membership.current_period_start || membership.joined_at;
  const periodEnd   = membership.current_period_end || farFutureIso();

  const { count } = await supabaseAdmin
    .from('PersonaQuotaUsage')
    .select('id', { count: 'exact', head: true })
    .eq('membership_id', membership.id)
    .eq('capability', 'msg_thread')
    .is('reverted_at', null)
    .gte('used_at', periodStart)
    .lt('used_at', periodEnd);
  const used = count || 0;
  return { limit, used, remaining: computeQuotaRemaining(limit, used) };
}

// Open a new DM thread.
//
// initiatedByRole='fan'      → consumes 1 quota; tier must allow
//                              msg_threads_per_period > 0.
// initiatedByRole='creator'  → no quota consumed; tier must allow
//                              creator_can_initiate_dm (Insider+).
//
// Returns one of:
//   { ok: true, threadId, message, quotaRemaining }
//   { ok: false, code: 'no_membership' | 'blocked' | 'tier_does_not_allow'
//                | 'quota_exhausted' | 'internal_error' }
async function openThread({
  personaId, fanUserId, initiatedByRole, initiatedByUserId, body, media = [],
}) {
  if (!personaId || !fanUserId || !initiatedByRole || !initiatedByUserId) {
    return { ok: false, code: 'invalid_args' };
  }
  if (!body || !String(body).trim()) {
    return { ok: false, code: 'empty_body' };
  }

  const membership = await loadActiveMembership(personaId, fanUserId);
  if (!membership) return { ok: false, code: 'no_membership' };

  if (await isFanBlocked(personaId, fanUserId)) {
    return { ok: false, code: 'blocked' };
  }

  // Tier permission gate.
  if (initiatedByRole === 'fan' && !(membership.tier?.msg_threads_per_period > 0)) {
    return { ok: false, code: 'tier_does_not_allow' };
  }
  if (initiatedByRole === 'creator' && !membership.tier?.creator_can_initiate_dm) {
    return { ok: false, code: 'tier_does_not_allow' };
  }

  // Quota consumption (fan-initiated only).
  let quotaUsageId = null;
  if (initiatedByRole === 'fan') {
    const quotaBefore = await getMsgThreadQuota(membership);
    if ((quotaBefore.remaining ?? 0) <= 0) {
      return { ok: false, code: 'quota_exhausted', quota: quotaBefore };
    }
    // used_at is explicitly set (not relying on the DB DEFAULT) so the
    // period-window count query in getMsgThreadQuota sees the row in
    // the next read. Production has DEFAULT now() on the column; this
    // explicit set is a no-op there and required for test fixtures.
    // used_at is explicitly set (not relying on the DB DEFAULT) so
    // the period-window count query in getMsgThreadQuota sees the row
    // immediately. Same for reverted_at — production DB defaults the
    // column to NULL, but SQL `IS NULL` matches both NULL and missing
    // values; explicit null keeps the count predicate equality-safe.
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('PersonaQuotaUsage')
      .insert({
        membership_id: membership.id,
        period_start: membership.current_period_start || membership.joined_at,
        period_end:   membership.current_period_end   || farFutureIso(),
        capability: 'msg_thread',
        related_entity_type: 'PersonaDmThread',
        used_at: new Date().toISOString(),
        reverted_at: null,
      })
      .select()
      .single();
    if (usageError || !usage) {
      logger.error('persona_dm.quota_insert_error', {
        error: usageError?.message, membershipId: membership.id,
      });
      return { ok: false, code: 'internal_error' };
    }
    quotaUsageId = usage.id;
  }

  // Create the thread row.
  const { data: thread, error: threadError } = await supabaseAdmin
    .from('PersonaDmThread')
    .insert({
      persona_id: personaId,
      membership_id: membership.id,
      initiated_by_user_id: initiatedByUserId,
      initiated_by_role: initiatedByRole,
      quota_usage_id: quotaUsageId,
      // The first message bumps the OTHER party's unread counter — we
      // initialize both to 0 here and let appendMessage handle the
      // increment so unread accounting stays in one place.
      fan_unread_count: 0,
      creator_unread_count: 0,
    })
    .select()
    .single();

  if (threadError || !thread) {
    if (quotaUsageId) {
      await supabaseAdmin
        .from('PersonaQuotaUsage')
        .update({ reverted_at: new Date().toISOString() })
        .eq('id', quotaUsageId);
    }
    logger.error('persona_dm.thread_insert_error', {
      error: threadError?.message, personaId, fanUserId,
    });
    return { ok: false, code: 'internal_error' };
  }

  // First message — drives the unread counter for the recipient and
  // populates last_message_at / last_message_preview.
  let firstMessage = null;
  try {
    firstMessage = await sendMessage({
      threadId: thread.id,
      senderUserId: initiatedByUserId,
      senderRole: initiatedByRole,
      body,
      media,
    });
  } catch (err) {
    if (quotaUsageId) {
      await supabaseAdmin
        .from('PersonaQuotaUsage')
        .update({ reverted_at: new Date().toISOString() })
        .eq('id', quotaUsageId);
    }
    await supabaseAdmin
      .from('PersonaDmThread')
      .delete()
      .eq('id', thread.id);
    logger.error('persona_dm.first_message_failed', {
      error: err?.message, threadId: thread.id,
    });
    return { ok: false, code: 'internal_error' };
  }

  const quotaAfter = await getMsgThreadQuota(membership);
  return {
    ok: true,
    threadId: thread.id,
    thread,
    message: firstMessage,
    membership,
    quotaRemaining: quotaAfter.remaining,
  };
}

// Append a message to an existing thread. Bumps the other party's
// unread counter and updates last_message_at / last_message_preview.
//
// senderRole='fan'     → bumps creator_unread_count.
// senderRole='creator' → bumps fan_unread_count.
async function sendMessage({ threadId, senderUserId, senderRole, body, media = [] }) {
  if (!threadId || !senderUserId || !senderRole || !body) {
    throw new Error('sendMessage requires threadId, senderUserId, senderRole, body');
  }
  if (!['fan', 'creator'].includes(senderRole)) {
    throw new Error(`Invalid senderRole: ${senderRole}`);
  }

  const { data: msg, error } = await supabaseAdmin
    .from('PersonaDmMessage')
    .insert({
      thread_id: threadId,
      sender_user_id: senderUserId,
      sender_role: senderRole,
      body: String(body),
      media: Array.isArray(media) ? media : [],
    })
    .select()
    .single();
  if (error || !msg) {
    throw new Error(error?.message || 'PersonaDmMessage insert failed');
  }

  // Read-modify-write the unread counter for the OTHER party.
  const { data: thread } = await supabaseAdmin
    .from('PersonaDmThread')
    .select('fan_unread_count, creator_unread_count')
    .eq('id', threadId)
    .maybeSingle();

  const update = {
    last_message_at: msg.created_at,
    last_message_preview: String(body).slice(0, 100),
    updated_at: msg.created_at,
  };
  if (senderRole === 'fan') {
    update.creator_unread_count = Number(thread?.creator_unread_count || 0) + 1;
  } else {
    update.fan_unread_count = Number(thread?.fan_unread_count || 0) + 1;
  }

  await supabaseAdmin
    .from('PersonaDmThread')
    .update(update)
    .eq('id', threadId);

  return msg;
}

// Reply-policy SLA tracking. Audience-profile §7.2: each paid tier
// carries a creator-selected reply policy. Threads where the fan
// initiated AND the creator hasn't replied surface a status the fan
// UI uses to drive the refund-request affordance.
//
// Returns:
//   null                                — no reply expected
//                                          (creator-initiated thread,
//                                           policy=discretion, or
//                                           creator already replied)
//   { status: 'on_track', policy, slaDays, daysRemaining }
//   { status: 'sla_missed', policy, slaDays }
//
// Sequential reads only (no nested select) so the mock supabaseAdmin
// works without modification. Same pattern as the rest of this service.
const SLA_DAYS_BY_POLICY = {
  within_3_days: 3,
  within_7_days: 7,
  within_14_days: 14,
  always: 1,
};

async function getReplyPolicyStatus(threadId) {
  if (!threadId) return null;

  const { data: thread } = await supabaseAdmin
    .from('PersonaDmThread')
    .select('id, created_at, initiated_by_role, membership_id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread) return null;
  if (thread.initiated_by_role !== 'fan') return null;

  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('id, tier_id')
    .eq('id', thread.membership_id)
    .maybeSingle();
  if (!membership?.tier_id) return null;

  const { data: tier } = await supabaseAdmin
    .from('PersonaTier')
    .select('reply_policy')
    .eq('id', membership.tier_id)
    .maybeSingle();
  const policy = tier?.reply_policy;
  if (!policy || policy === 'discretion') return null;

  // Has the creator replied at all? The first creator message clears
  // the SLA — subsequent reply latency is creator's discretion.
  const { data: creatorReplies } = await supabaseAdmin
    .from('PersonaDmMessage')
    .select('id, created_at')
    .eq('thread_id', threadId)
    .eq('sender_role', 'creator');
  if (creatorReplies && creatorReplies.length > 0) return null;

  const slaDays = SLA_DAYS_BY_POLICY[policy];
  if (!slaDays) return null;
  const ageMs = Date.now() - new Date(thread.created_at).getTime();
  const ageDays = ageMs / (24 * 3600 * 1000);
  if (ageDays > slaDays) {
    return { status: 'sla_missed', policy, slaDays };
  }
  return {
    status: 'on_track',
    policy,
    slaDays,
    daysRemaining: Math.max(0, Math.ceil(slaDays - ageDays)),
  };
}

// Resolve which side a viewer is on for a given thread. Returns one of:
//   { role: 'creator', persona, membership, thread }
//   { role: 'fan',     persona, membership, thread }
//   null  — viewer is neither.
async function resolveThreadViewer(threadId, viewerUserId) {
  if (!threadId || !viewerUserId) return null;
  const { data: thread } = await supabaseAdmin
    .from('PersonaDmThread')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread) return null;

  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id, handle, display_name')
    .eq('id', thread.persona_id)
    .maybeSingle();
  if (!persona) return null;

  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('*')
    .eq('id', thread.membership_id)
    .maybeSingle();
  if (!membership) return null;

  if (persona.user_id === viewerUserId) {
    return { role: 'creator', persona, membership, thread };
  }
  if (membership.user_id === viewerUserId) {
    return { role: 'fan', persona, membership, thread };
  }
  return null;
}

module.exports = {
  loadActiveMembership,
  isFanBlocked,
  getMsgThreadQuota,
  openThread,
  sendMessage,
  getReplyPolicyStatus,
  resolveThreadViewer,
};
