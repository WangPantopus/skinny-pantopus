'use strict';

/**
 * Plans invitations (founder decision, October 31): the host invites people on Pantopus, by email, or with a
 * one-person link they text themselves.
 *
 *  - An invitation is the host's yes. The person says "I'm in" with the ordinary ask (POST /api/plans/:id/requests)
 *    and is in: no distance, location or approval step (planService.askEligibility, planActions.askToJoin). A
 *    playdate still needs a verified address, and a full plan still puts them on the waitlist.
 *  - Each email or link invite is for one person: the first account that opens it takes it. An email invite opened
 *    by an account whose verified email isn't the invited address waits for the host's yes (needs_host_ok), so a
 *    forwarded email never shows a stranger a home address. An email invite also finds its person without the link:
 *    signing in with the invited, verified address claims it (attachEmailInvites).
 *  - Emails carry the plan's card only (what, when, the area), never an address: one per invite, no reminders, and
 *    an unsubscribe link. The host never learns whether an address has an account: email invites show the address
 *    until the person says they're in.
 *  - Account invites go only to people the host knows (connections, people who came to their plans), and people on
 *    either side of a block, or who muted the host, never hear about them.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { recordFunnelEvent } = require('../funnelEvents');
const { getMuteAndHideFilters } = require('../feedService');
const { localDisplayNames } = require('../../utils/identityProfiles');
const { loadChatPeople } = require('../chatPeople');
const rules = require('./planRules');
const planService = require('./planService');
const planNotify = require('./planNotifications');
const { loadViewer } = require('./planViewer');

// planActions requires this module; its helpers are read when called, not at load.
const actions = () => require('./planActions');

const LIMITS = Object.freeze({
  // Founder, October 31: "start at 20 email invites per plan".
  emailsPerPlan: 20,
  invitesPerPlan: 60,
  // Text invites nobody has opened yet.
  openLinksPerPlan: 30,
  emailsPerHostPerDay: 40,
  // From every host together: one address can't be flooded.
  emailsPerAddressPerDay: 5,
  accountsPerCall: 30,
  emailsPerCall: 20,
  people: 60,
});

const OPEN_STATUSES = ['pending', 'accepted', 'declined'];
const INVITE_COLUMNS = [
  'id', 'post_id', 'host_user_id', 'channel', 'invitee_user_id', 'email', 'status', 'needs_host_ok',
  'email_status', 'claimed_at', 'opened_at', 'answered_at', 'created_at', 'updated_at',
].join(', ');
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const fail = (status, code, message, extra) => {
  const { PlanError } = actions();
  throw new PlanError(status, code, message, extra);
};
const nowIso = () => new Date().toISOString();

// ── Small parts ──────────────────────────────────────────────

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length >= 3 && email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function isToken(value) {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

/** "al•••@gmail.com": enough for the person to recognize their own address, not enough to read someone else's. */
function emailHint(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, Math.min(2, local.length))}•••@${domain}`;
}

/** The plan's share page with the invite: the apps open it as a plan link, the web shows "Sam invited you". */
function inviteUrl(postId, token) {
  return `${planService.shareUrl(postId)}?invite=${encodeURIComponent(token)}`;
}

function unsubscribeUrl(token) {
  const base = planService.shareUrl('x').replace(/\/plans\/x$/, '');
  return `${base}/plans/unsubscribe?invite=${encodeURIComponent(token)}`;
}

/** The one-click unsubscribe a mail app sends (RFC 8058), through the web's /api proxy. */
function oneClickUnsubscribeUrl(token) {
  const base = planService.shareUrl('x').replace(/\/plans\/x$/, '');
  return `${base}/api/public/plans/invites/unsubscribe/${encodeURIComponent(token)}`;
}

function isOpenForAnswers(plan) {
  if (!plan || plan.status !== 'open') return false;
  return rules.isAskingOpen(plan, planService.startsAt(plan), planService.endsAt(plan));
}

/**
 * A playdate this person would see with a verified address (board J9): their invitation waits for them, and the
 * app says who invited them and to verify, never the playdate's details.
 */
function isLockedPlaydate(plan, viewer) {
  return Boolean(plan && plan.kind === 'playdate' && viewer.playdatesFlag && !viewer.verified
    && String(plan.host_user_id) !== viewer.id && plan.status === 'open'
    && planService.isVisibleTo(plan, { ...viewer, seesPlaydates: true }));
}

/** Is the signed-in person's own address `email`, verified? Sign-in refuses unconfirmed addresses; a token without
 *  the confirmation claim is checked against Auth. */
async function hasVerifiedEmail(user, email) {
  const mine = normalizeEmail(user?.email);
  if (!mine || !email || mine !== email) return false;
  if (user.emailConfirmed === true) return true;
  if (user.emailConfirmed === false) return false;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.id);
    if (error || !data?.user) return false;
    return normalizeEmail(data.user.email) === email && Boolean(data.user.email_confirmed_at);
  } catch (err) {
    logger.warn('plans.invites.email_check_unavailable', { userId: user.id, error: err.message });
    return false;
  }
}

async function names(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  const out = new Map();
  if (ids.length === 0) return out;
  const [local, people, users] = await Promise.all([
    localDisplayNames(ids),
    loadChatPeople(ids),
    supabaseAdmin.from('User').select('id, name, first_name, last_name, profile_picture_url').in('id', ids),
  ]);
  if (users.error) throw new Error(`Failed to load people: ${users.error.message}`);
  const rows = new Map((users.data || []).map((u) => [String(u.id), u]));
  for (const id of ids) {
    const user = { ...(rows.get(id) || { id }), local_display_name: local.get(id) || null };
    const shown = planService.withLocalAvatar(user, people);
    out.set(id, {
      user_id: id,
      display_name: planService.displayName(shown),
      avatar_url: planService.avatarUrl(shown),
      search_name: [user.local_display_name, user.name, user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase(),
    });
  }
  return out;
}

function person(entry) {
  return entry ? { user_id: entry.user_id, display_name: entry.display_name, avatar_url: entry.avatar_url } : null;
}

async function loadInvites(postId) {
  const { data, error } = await supabaseAdmin.from('PlanInvite').select(INVITE_COLUMNS)
    .eq('post_id', postId).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(500);
  if (error) throw new Error(`Failed to load invites: ${error.message}`);
  return data || [];
}

async function hostPlan(user, postId) {
  const viewer = await loadViewer(user);
  return { viewer, plan: await hostedPlanRow(postId, viewer) };
}

/** The plan, for its host only (as planActions reads a hosted plan). */
async function hostedPlanRow(postId, viewer) {
  if (!planService.isUuid(postId)) fail(404, 'not_found', "This plan isn't available.");
  const plan = await planService.loadPlanRow(postId);
  if (!plan || !planService.isVisibleTo(plan, viewer)) fail(404, 'not_found', "This plan isn't available.");
  if (String(plan.host_user_id) !== viewer.id) fail(403, 'not_host', 'Only the host can do that.');
  return plan;
}

function assertInvitable(plan, viewer) {
  if (!viewer.invitesFlag) fail(404, 'not_found', "Invitations aren't available right now.");
  if (plan.status === 'cancelled') fail(409, 'ended', 'This plan was cancelled.');
  if (!isOpenForAnswers(plan)) fail(409, 'ended', 'This plan has started, so invitations are closed.');
}

/**
 * At a home: the first invitation (or yes) shares the address with whoever says they're in, so the host confirms it
 * once, as accepting the first ask does (planActions.decide).
 */
async function assertSharesAddressConfirmed(plan, body) {
  if (plan.place_kind !== 'home' || body?.confirm_shares_address === true) return;
  const [accepted, invited] = await Promise.all([
    supabaseAdmin.from('PlanRequest').select('id', { count: 'exact', head: true })
      .eq('post_id', plan.post_id).eq('decided_by', 'host').in('status', ['accepted', 'left', 'removed']),
    supabaseAdmin.from('PlanInvite').select('id', { count: 'exact', head: true }).eq('post_id', plan.post_id),
  ]);
  if (accepted.error || invited.error) throw new Error(`Failed to check the plan: ${(accepted.error || invited.error).message}`);
  if (!accepted.count && !invited.count) {
    fail(409, 'confirm_shares_address', 'People you invite see your address once they say they’re in.');
  }
}

// ── The host's list ──────────────────────────────────────────

/**
 * What the host sees of one invitation:
 *  invited (not answered), opened (a text invite someone opened), in, waitlisted, asked (opened by an account the
 *  email wasn't for, waiting for the host's yes), cant_make_it, left.
 */
function stateOf(row, request) {
  if (row.status === 'declined') return 'cant_make_it';
  if (row.status === 'accepted') {
    if (!request) return 'left';
    if (request.status === 'accepted') return 'in';
    if (request.status === 'waitlisted') return 'waitlisted';
    if (request.status === 'pending') return 'asked';
    return 'left';
  }
  return row.channel === 'link' && row.invitee_user_id ? 'opened' : 'invited';
}

const STATE_ORDER = { asked: 0, in: 1, waitlisted: 2, opened: 3, invited: 4, cant_make_it: 5, left: 6 };

async function hostView(plan, rows) {
  const userIds = [...new Set(rows.map((r) => r.invitee_user_id).filter(Boolean).map(String))];
  const [people, requests] = await Promise.all([
    names(userIds),
    userIds.length
      ? supabaseAdmin.from('PlanRequest').select('id, user_id, status').eq('post_id', plan.post_id).in('user_id', userIds)
      : { data: [] },
  ]);
  if (requests.error) throw new Error(`Failed to load requests: ${requests.error.message}`);
  const requestByUser = new Map((requests.data || []).map((r) => [String(r.user_id), r]));

  let unopenedLinks = 0;
  const byKey = new Map();
  for (const row of rows) {
    if (row.channel === 'link' && !row.invitee_user_id) {
      if (row.status === 'pending') unopenedLinks += 1;
      continue;
    }
    const userId = row.invitee_user_id ? String(row.invitee_user_id) : null;
    const request = userId ? requestByUser.get(userId) || null : null;
    const state = stateOf(row, request);
    // An email invite names its person only once they've said they're in: until then the host sees the address
    // they typed, and never learns whether it has an account.
    const named = row.channel !== 'email' || (row.status === 'accepted' && ['in', 'waitlisted', 'asked'].includes(state));
    const view = {
      id: row.id,
      channel: row.channel,
      state,
      person: named && userId ? person(people.get(userId)) : null,
      email: row.channel === 'email' ? row.email : null,
      email_failed: row.channel === 'email' && ['failed', 'skipped'].includes(row.email_status),
      // The ask waiting for the host's yes (state asked): the ordinary accept or decline.
      request_id: state === 'asked' && request ? request.id : null,
      can_cancel: row.status === 'pending' || row.status === 'declined',
      invited_at: planService.iso(row.created_at),
      answered_at: planService.iso(row.answered_at),
    };
    // One row a person: an account invite and an email the same person opened show once, at the furthest state.
    const key = view.person ? `user:${view.person.user_id}` : `invite:${row.id}`;
    const seen = byKey.get(key);
    if (!seen || STATE_ORDER[view.state] < STATE_ORDER[seen.state]) byKey.set(key, view);
  }
  const invites = [...byKey.values()].sort((a, b) => (STATE_ORDER[a.state] - STATE_ORDER[b.state])
    || (new Date(b.invited_at) - new Date(a.invited_at)));
  const emailsUsed = rows.filter((r) => r.channel === 'email').length;
  return {
    invites,
    unopened_links: unopenedLinks,
    counts: {
      invited: invites.filter((i) => ['invited', 'opened'].includes(i.state)).length + unopenedLinks,
      in: invites.filter((i) => i.state === 'in').length,
      waitlisted: invites.filter((i) => i.state === 'waitlisted').length,
      cant_make_it: invites.filter((i) => i.state === 'cant_make_it').length,
    },
    emails_left: Math.max(0, LIMITS.emailsPerPlan - emailsUsed),
  };
}

async function listForHost(user, postId) {
  const { viewer, plan } = await hostPlan(user, postId);
  const view = await hostView(plan, await loadInvites(postId));
  return { ...view, can_invite: Boolean(viewer.invitesFlag) && isOpenForAnswers(plan) };
}

// ── People the host can invite ───────────────────────────────

/** Connections and people who came to the host's plans: the only accounts a host can invite. */
async function knownPeople(hostId) {
  const [connections, guests] = await Promise.all([
    planService.connectionIdsByUser([hostId]),
    supabaseAdmin.from('PlanRequest')
      .select('user_id, plan:Plan!inner(host_user_id)')
      .eq('plan.host_user_id', hostId)
      .in('status', ['accepted', 'left'])
      .limit(500),
  ]);
  if (guests.error) throw new Error(`Failed to load your guests: ${guests.error.message}`);
  const reasons = new Map();
  for (const id of connections.get(String(hostId)) || []) reasons.set(String(id), 'connection');
  for (const row of guests.data || []) {
    const id = String(row.user_id);
    reasons.set(id, reasons.get(id) === 'connection' ? 'both' : (reasons.get(id) || 'came_before'));
  }
  reasons.delete(String(hostId));
  return reasons;
}

async function peopleToInvite(user, postId, q) {
  const { viewer, plan } = await hostPlan(user, postId);
  if (!viewer.invitesFlag) fail(404, 'not_found', "Invitations aren't available right now.");
  const reasons = await knownPeople(viewer.id);
  for (const id of viewer.blockedUserIds) reasons.delete(String(id));
  const ids = [...reasons.keys()];
  const [people, rows, requests] = await Promise.all([
    names(ids),
    loadInvites(postId),
    ids.length
      ? supabaseAdmin.from('PlanRequest').select('user_id, status').eq('post_id', postId).in('user_id', ids)
      : { data: [] },
  ]);
  if (requests.error) throw new Error(`Failed to load requests: ${requests.error.message}`);
  const invitedIds = new Set(rows.filter((r) => r.invitee_user_id && (r.channel !== 'email' || r.status === 'accepted'))
    .map((r) => String(r.invitee_user_id)));
  const requestByUser = new Map((requests.data || []).map((r) => [String(r.user_id), r.status]));
  const query = typeof q === 'string' ? q.trim().toLowerCase().slice(0, 60) : '';
  const out = [];
  for (const id of ids) {
    const entry = people.get(id);
    if (!entry) continue;
    if (query && !entry.search_name.includes(query) && !entry.display_name.toLowerCase().includes(query)) continue;
    const requestStatus = requestByUser.get(id);
    let state = null;
    if (requestStatus === 'accepted') state = 'in';
    else if (requestStatus === 'pending' || requestStatus === 'waitlisted') state = 'asked';
    else if (invitedIds.has(id)) state = 'invited';
    out.push({ ...person(entry), reason: reasons.get(id), state });
  }
  const reasonOrder = { both: 0, came_before: 1, connection: 2 };
  out.sort((a, b) => ((a.state ? 1 : 0) - (b.state ? 1 : 0))
    || (reasonOrder[a.reason] - reasonOrder[b.reason])
    || a.display_name.localeCompare(b.display_name));
  return { people: out.slice(0, LIMITS.people), plan_id: plan.post_id };
}

// ── Sending ──────────────────────────────────────────────────

/**
 * "Sunday, November 1 at 1:25 PM" (a playdate: "Saturday morning, November 7"). Emails and texts are read later, so
 * they never say "today" or "tomorrow".
 */
function dateText(plan) {
  const tz = rules.timezoneForPlan(plan);
  const start = new Date(plan.post.event_date);
  if (Number.isNaN(start.getTime())) return '';
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(start);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', day: 'numeric' }).format(start);
  if (plan.kind === 'playdate') return `${weekday} ${rules.dayPart(plan.post.event_date, tz) || ''}, ${date}`.replace(' ,', ',');
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(start);
  return `${weekday}, ${date} at ${time}`;
}

function emailWords(plan, hostFirst) {
  const hideTime = plan.kind === 'playdate';
  const when = dateText(plan);
  const area = planNotify.areaPhrase(plan);
  // "Near Prune Hill, Camas", but "In Camas" when the area is the city.
  const city = plan.city && !String(area || '').toLowerCase().endsWith(plan.city.toLowerCase()) ? plan.city : null;
  return {
    hostFirst,
    noun: planNotify.noun(plan),
    icon: planNotify.ICON_BY_KIND[plan.kind] || '📅',
    playdate: hideTime,
    // A playdate's title stays in the app, for verified neighbors, as on its share page.
    title: hideTime ? null : plan.post.title,
    when,
    where: [area ? area[0].toUpperCase() + area.slice(1) : null, city].filter(Boolean).join(', '),
  };
}

async function sendInviteEmail(plan, row, token, hostFirst) {
  const { sendPlanInviteEmail } = require('../emailService');
  let emailStatus = 'sent';
  try {
    const sent = await sendPlanInviteEmail({
      toEmail: row.email,
      words: emailWords(plan, hostFirst),
      link: inviteUrl(plan.post_id, token),
      unsubscribeLink: unsubscribeUrl(token),
      oneClickUnsubscribeLink: oneClickUnsubscribeUrl(token),
    });
    if (!sent?.success) emailStatus = 'failed';
  } catch (err) {
    logger.warn('plans.invites.email_failed', { inviteId: row.id, error: err.message });
    emailStatus = 'failed';
  }
  const { error } = await supabaseAdmin.from('PlanInvite').update({ email_status: emailStatus, updated_at: nowIso() }).eq('id', row.id);
  if (error) logger.warn('plans.invites.email_status_unsaved', { inviteId: row.id, error: error.message });
}

/**
 * Why this address gets no email now: 'opted_out' after "don't send me invitations", 'too_many' after a few today
 * (from every host together), else null.
 */
async function emailHeld(email) {
  const [optedOut, today] = await Promise.all([
    supabaseAdmin.from('PlanInvite').select('id', { count: 'exact', head: true })
      .eq('email', email).not('email_opted_out_at', 'is', null),
    supabaseAdmin.from('PlanInvite').select('id', { count: 'exact', head: true })
      .eq('email', email).eq('email_status', 'sent').gt('created_at', new Date(Date.now() - DAY_MS).toISOString()),
  ]);
  if (optedOut.error || today.error) throw new Error(`Failed to check the address: ${(optedOut.error || today.error).message}`);
  if (optedOut.count) return 'opted_out';
  return (today.count || 0) >= LIMITS.emailsPerAddressPerDay ? 'too_many' : null;
}

/** A member whose verified address is `email`, or null. */
async function memberWithEmail(email) {
  const escaped = email.replace(/([\\%_])/g, '\\$1');
  const { data, error } = await supabaseAdmin.from('User').select('id, email').ilike('email', escaped).limit(2);
  if (error || !data || data.length !== 1) return null;
  const id = String(data[0].id);
  return (await hasVerifiedEmail({ id, email: data[0].email, emailConfirmed: null }, email)) ? id : null;
}

/**
 * One email invitation: the email (unless the address opted out or had enough today), and, when the address is a
 * member's verified email, the invitation becomes theirs with a notice. A member who blocked the host (or whom the
 * host blocked), muted them or hid the plan gets neither; the host sees "didn't send", as for an opted-out address.
 */
async function deliverEmailInvite(plan, viewer, row, token, hostFirst) {
  const found = await memberWithEmail(row.email);
  const memberId = found && found !== viewer.id ? found : null;
  const hears = !memberId || (await reachable(plan, viewer, [memberId])).has(memberId);
  const held = hears ? await emailHeld(row.email) : 'unreachable';
  if (held) {
    // An opt-out rides along on every later invitation to the address, so it outlives older plans.
    const patch = { email_status: 'skipped', updated_at: nowIso(), ...(held === 'opted_out' ? { email_opted_out_at: nowIso() } : {}) };
    const { error } = await supabaseAdmin.from('PlanInvite').update(patch).eq('id', row.id);
    if (error) logger.warn('plans.invites.email_status_unsaved', { inviteId: row.id, error: error.message });
  } else {
    await sendInviteEmail(plan, row, token, hostFirst);
  }
  if (!memberId || !hears) return;
  const { data: claimed } = await supabaseAdmin.from('PlanInvite')
    .update({ invitee_user_id: memberId, claimed_at: nowIso(), updated_at: nowIso() })
    .eq('id', row.id).is('invitee_user_id', null).select(INVITE_COLUMNS);
  if (claimed && claimed.length) await planNotify.invited({ plan, invite: claimed[0], userId: memberId, hostFirst });
}

/** Account invitees who'd hear about it: not blocked either way, not muting the host, not hiding the plan. */
async function reachable(plan, viewer, userIds) {
  const out = new Set();
  for (const id of userIds) {
    if (viewer.blockedUserIds.has(String(id))) continue;
    try {
      const filters = await getMuteAndHideFilters(String(id));
      if (filters.blockedUserIds?.has(String(plan.host_user_id))) continue;
      if (filters.mutedUserIds?.has(String(plan.host_user_id))) continue;
      if (filters.hiddenPostIds?.has(plan.post_id)) continue;
      out.add(String(id));
    } catch (err) {
      logger.warn('plans.invites.filters_unavailable', { userId: id, error: err.message });
    }
  }
  return out;
}

/**
 * POST /api/plans/:id/invites { user_ids?, emails?, confirm_shares_address? }: invite people the host knows and
 * people by email. Answers the host's list and a result for each person or address.
 */
async function createInvites(user, postId, body = {}) {
  const { viewer, plan } = await hostPlan(user, postId);
  assertInvitable(plan, viewer);

  const rawIds = Array.isArray(body.user_ids) ? body.user_ids : [];
  const rawEmails = Array.isArray(body.emails) ? body.emails : [];
  if (rawIds.length > LIMITS.accountsPerCall || rawEmails.length > LIMITS.emailsPerCall) {
    fail(422, 'validation', 'Invite up to 20 addresses and 30 people at a time.');
  }
  const userIds = [...new Set(rawIds.filter(planService.isUuid).map((id) => id.toLowerCase()))];
  const emails = [];
  const invalid = [];
  for (const raw of rawEmails) {
    const email = normalizeEmail(raw);
    if (!email) invalid.push(String(raw || '').slice(0, 80));
    else if (!emails.includes(email)) emails.push(email);
  }
  if (invalid.length > 0) fail(422, 'invalid_email', `Check this email address: ${invalid[0]}`, { invalid_emails: invalid });
  if (userIds.length === 0 && emails.length === 0) fail(422, 'validation', 'Choose someone to invite.');
  await assertSharesAddressConfirmed(plan, body);

  const existing = await loadInvites(postId);
  const newEmails = emails.filter((e) => !existing.some((r) => r.email === e));
  const newAccounts = userIds.filter((id) => !existing.some((r) => r.channel === 'account' && String(r.invitee_user_id) === id));
  if (existing.length + newEmails.length + newAccounts.length > LIMITS.invitesPerPlan) {
    fail(429, 'too_many_invites', `A plan can have up to ${LIMITS.invitesPerPlan} invitations.`);
  }
  const emailsUsed = existing.filter((r) => r.channel === 'email').length;
  if (emailsUsed + newEmails.length > LIMITS.emailsPerPlan) {
    fail(429, 'too_many_invites', `You can invite ${LIMITS.emailsPerPlan} people by email to a plan. ${Math.max(0, LIMITS.emailsPerPlan - emailsUsed)} left.`,
      { emails_left: Math.max(0, LIMITS.emailsPerPlan - emailsUsed) });
  }
  if (newEmails.length > 0) {
    const { count, error } = await supabaseAdmin.from('PlanInvite').select('id', { count: 'exact', head: true })
      .eq('host_user_id', viewer.id).eq('channel', 'email').gt('created_at', new Date(Date.now() - DAY_MS).toISOString());
    if (error) throw new Error(`Failed to count invitations: ${error.message}`);
    if ((count || 0) + newEmails.length > LIMITS.emailsPerHostPerDay) {
      fail(429, 'too_many_invites', `You can invite ${LIMITS.emailsPerHostPerDay} people by email a day. Try again tomorrow.`);
    }
  }

  const results = [];
  const hostEmail = normalizeEmail(user.email);
  const known = newAccounts.length ? await knownPeople(viewer.id) : new Map();
  const { data: requestRows, error: requestError } = await supabaseAdmin.from('PlanRequest')
    .select('user_id, status').eq('post_id', postId);
  if (requestError) throw new Error(`Failed to load requests: ${requestError.message}`);
  const inPlan = new Set((requestRows || []).filter((r) => r.status === 'accepted').map((r) => String(r.user_id)));

  // People on Pantopus.
  const invitedAccounts = [];
  for (const id of userIds) {
    if (id === viewer.id) { results.push({ user_id: id, outcome: 'host' }); continue; }
    if (!newAccounts.includes(id)) { results.push({ user_id: id, outcome: 'already_invited' }); continue; }
    if (inPlan.has(id)) { results.push({ user_id: id, outcome: 'already_in' }); continue; }
    if (!known.has(id) || viewer.blockedUserIds.has(id)) { results.push({ user_id: id, outcome: 'unavailable' }); continue; }
    const { data, error } = await supabaseAdmin.from('PlanInvite')
      .insert({ post_id: postId, host_user_id: viewer.id, channel: 'account', invitee_user_id: id })
      .select(INVITE_COLUMNS).single();
    if (error) {
      if (error.code === '23505') { results.push({ user_id: id, outcome: 'already_invited' }); continue; }
      throw new Error(`Failed to save the invitation: ${error.message}`);
    }
    invitedAccounts.push(data);
    results.push({ user_id: id, outcome: 'invited' });
    recordFunnelEvent('plan_invited', { userId: viewer.id, meta: { plan_id: postId, kind: plan.kind, channel: 'account' } });
  }

  // People by email.
  const hostFirst = actions().firstOf((await actions().userNames([viewer.id])).get(viewer.id));
  const emailed = [];
  for (const email of emails) {
    if (email === hostEmail) { results.push({ email, outcome: 'host' }); continue; }
    if (!newEmails.includes(email)) { results.push({ email, outcome: 'already_invited' }); continue; }
    const token = newToken();
    const { data, error } = await supabaseAdmin.from('PlanInvite')
      .insert({ post_id: postId, host_user_id: viewer.id, channel: 'email', email, token_hash: hashToken(token) })
      .select(INVITE_COLUMNS).single();
    if (error) {
      if (error.code === '23505') { results.push({ email, outcome: 'already_invited' }); continue; }
      throw new Error(`Failed to save the invitation: ${error.message}`);
    }
    emailed.push({ row: data, token });
    results.push({ email, outcome: 'invited' });
    recordFunnelEvent('plan_invited', { userId: viewer.id, meta: { plan_id: postId, kind: plan.kind, channel: 'email' } });
  }

  // Tell them: pushes and notices for accounts, an email for each address (in the background: the host's answer
  // shouldn't wait on the mail server), and a notice too for a member whose verified address it is.
  const hear = await reachable(plan, viewer, invitedAccounts.map((r) => r.invitee_user_id));
  for (const row of invitedAccounts) {
    if (hear.has(String(row.invitee_user_id))) {
      await planNotify.invited({ plan, invite: row, userId: row.invitee_user_id, hostFirst });
    }
  }
  if (emailed.length > 0) {
    (async () => {
      for (const { row, token } of emailed) {
        try {
          await deliverEmailInvite(plan, viewer, row, token, hostFirst);
        } catch (err) {
          logger.warn('plans.invites.email_step_failed', { inviteId: row.id, error: err.message });
        }
      }
    })();
  }

  const view = await hostView(plan, await loadInvites(postId));
  return { ...view, can_invite: true, results };
}

/**
 * POST /api/plans/:id/invites/link { confirm_shares_address? }: a one-person link the host sends from their phone
 * ("Text an invite"). Answers the link and the words to send with it, in the host's voice.
 */
async function createLinkInvite(user, postId, body = {}) {
  const { viewer, plan } = await hostPlan(user, postId);
  assertInvitable(plan, viewer);
  await assertSharesAddressConfirmed(plan, body);
  const existing = await loadInvites(postId);
  if (existing.length >= LIMITS.invitesPerPlan) fail(429, 'too_many_invites', `A plan can have up to ${LIMITS.invitesPerPlan} invitations.`);
  const openLinks = existing.filter((r) => r.channel === 'link' && !r.invitee_user_id && r.status === 'pending').length;
  if (openLinks >= LIMITS.openLinksPerPlan) {
    fail(429, 'too_many_invites', 'Lots of your text invites haven’t been opened yet. Try again once some have.');
  }
  const token = newToken();
  const { data, error } = await supabaseAdmin.from('PlanInvite')
    .insert({ post_id: postId, host_user_id: viewer.id, channel: 'link', token_hash: hashToken(token) })
    .select('id').single();
  if (error) throw new Error(`Failed to make the invitation: ${error.message}`);
  recordFunnelEvent('plan_invited', { userId: viewer.id, meta: { plan_id: postId, kind: plan.kind, channel: 'link' } });
  const ask = planNotify.noun(plan) === 'coffee' ? 'Want to get coffee' : `Want to come to my ${planNotify.noun(plan)}`;
  return {
    invite_id: data.id,
    url: inviteUrl(postId, token),
    // Sent from the host's own phone, so it's in their voice.
    message: `${ask} on ${dateText(plan)}? “${plan.post.title}”. Tap to say you’re in:`,
  };
}

/** DELETE /api/plans/:id/invites/:inviteId: take back an invitation nobody has said yes to. */
async function cancelInvite(user, postId, inviteId) {
  const { plan } = await hostPlan(user, postId);
  if (!planService.isUuid(inviteId)) fail(404, 'not_found', "That invitation isn't here.");
  const { data: row, error } = await supabaseAdmin.from('PlanInvite').select(INVITE_COLUMNS)
    .eq('id', inviteId).eq('post_id', postId).maybeSingle();
  if (error) throw new Error(`Failed to load the invitation: ${error.message}`);
  if (!row || row.status === 'cancelled') fail(404, 'not_found', "That invitation isn't here.");
  if (row.status === 'accepted') fail(409, 'already_in', 'They said they’re in. To take them out, remove them from the people going.');
  const { error: updateError } = await supabaseAdmin.from('PlanInvite')
    .update({ status: 'cancelled', updated_at: nowIso() }).eq('id', row.id).in('status', ['pending', 'declined']);
  if (updateError) throw new Error(`Failed to cancel the invitation: ${updateError.message}`);
  return { ...(await hostView(plan, await loadInvites(postId))), can_invite: isOpenForAnswers(plan) };
}

// ── The person invited ───────────────────────────────────────

/** The viewer's open invitations on these plans, the best one a plan (one that needs no host yes, then answered). */
async function viewerInvites(viewerId, postIds) {
  const out = new Map();
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!viewerId || ids.length === 0) return out;
  const { data, error } = await supabaseAdmin.from('PlanInvite').select(INVITE_COLUMNS)
    .in('post_id', ids).eq('invitee_user_id', viewerId).in('status', OPEN_STATUSES);
  if (error) {
    logger.warn('plans.invites.viewer_unavailable', { error: error.message });
    return out;
  }
  const rank = (r) => (r.needs_host_ok ? 10 : 0) + ({ accepted: 0, pending: 1, declined: 2 }[r.status] ?? 3);
  for (const row of data || []) {
    const seen = out.get(row.post_id);
    if (!seen || rank(row) < rank(seen)) out.set(row.post_id, row);
  }
  return out;
}

/**
 * For hosted plans: how many people are waiting, said yes, and can't make it (the plan screen's Invite row). One
 * count a person, as the host's list shows them (hostView): an account invite and a text link the same person opened
 * count once, at the furthest answer; an email invitation names its person only once they've said yes.
 */
async function hostInviteCounts(postIds) {
  const out = new Map();
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (ids.length === 0) return out;
  const { data, error } = await supabaseAdmin.from('PlanInvite').select('id, post_id, status, channel, invitee_user_id')
    .in('post_id', ids).neq('status', 'cancelled');
  if (error) {
    logger.warn('plans.invites.counts_unavailable', { error: error.message });
    return out;
  }
  const rank = { accepted: 0, pending: 1, declined: 2 };
  const byPlan = new Map();
  for (const row of data || []) {
    const named = row.invitee_user_id && (row.channel !== 'email' || row.status === 'accepted');
    const key = named ? `user:${row.invitee_user_id}` : `invite:${row.id}`;
    const people = byPlan.get(row.post_id) || new Map();
    const seen = people.get(key);
    if (!seen || rank[row.status] < rank[seen]) people.set(key, row.status);
    byPlan.set(row.post_id, people);
  }
  for (const [postId, people] of byPlan) {
    const counts = { pending: 0, accepted: 0, declined: 0 };
    for (const status of people.values()) counts[status] += 1;
    out.set(postId, counts);
  }
  return out;
}

/** The card's my_invite: what the app shows the person invited. */
function myInviteView(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    channel: row.channel,
    needs_host_ok: Boolean(row.needs_host_ok),
    invited_at: planService.iso(row.created_at),
  };
}

/**
 * Email invites waiting for this person's verified address become theirs (no link needed): someone invited by email
 * who installs the app and signs up with that address finds the plan. Answers how many it took.
 */
async function attachEmailInvites(user) {
  const email = normalizeEmail(user?.email);
  if (!email) return 0;
  try {
    // Not opened yet, or opened by an account the address isn't verified for (a forwarded email): it's this
    // person's invitation, so it becomes theirs.
    const { data, error } = await supabaseAdmin.from('PlanInvite').select(INVITE_COLUMNS)
      .eq('email', email).neq('status', 'cancelled')
      .or(`invitee_user_id.is.null,needs_host_ok.eq.true`).limit(20);
    if (error || !data || data.length === 0) return 0;
    const mine = data.filter((row) => String(row.host_user_id) !== String(user.id)
      && String(row.invitee_user_id || '') !== String(user.id)
      && (row.invitee_user_id ? true : row.status === 'pending'));
    if (mine.length === 0 || !(await hasVerifiedEmail(user, email))) return 0;
    let taken = 0;
    for (const row of mine) {
      if (await takeInvite(row, user.id)) taken += 1;
    }
    return taken;
  } catch (err) {
    logger.warn('plans.invites.attach_failed', { userId: user?.id, error: err.message });
    return 0;
  }
}

/**
 * The invited address's verified owner takes an email invitation: from nobody, or from an account that opened a
 * forwarded copy (which keeps only an ordinary ask the host answers). Their own answer starts fresh.
 */
async function takeInvite(row, userId) {
  const patch = { invitee_user_id: userId, needs_host_ok: false, claimed_at: nowIso(), updated_at: nowIso() };
  let query = supabaseAdmin.from('PlanInvite');
  if (row.invitee_user_id) {
    query = query.update({ ...patch, status: 'pending', opened_at: null, answered_at: null })
      .eq('id', row.id).eq('invitee_user_id', row.invitee_user_id).eq('needs_host_ok', true);
  } else {
    query = query.update(patch).eq('id', row.id).is('invitee_user_id', null);
  }
  const { data, error } = await query.select('id');
  if (error) {
    logger.warn('plans.invites.take_failed', { inviteId: row.id, error: error.message });
    return false;
  }
  return Boolean(data && data.length);
}

/**
 * POST /api/plans/:id/invites/claim { token }: the person opened an email or text invite. It becomes theirs (the
 * first account to open it); an email invite opened by an account the address isn't verified for waits for the
 * host's yes. Answers the plan as they now see it.
 */
async function claimInvite(user, postId, token) {
  if (!isToken(token)) fail(404, 'invite_unavailable', 'This invitation isn’t available anymore.');
  const viewer = await loadViewer(user);
  if (!planService.isUuid(postId)) fail(404, 'not_found', "This plan isn't available.");
  const plan = await planService.loadPlanRow(postId);
  const locked = isLockedPlaydate(plan, viewer);
  if (!plan || (!locked && !planService.isVisibleTo(plan, viewer))) fail(404, 'not_found', "This plan isn't available.");
  const { data: row, error } = await supabaseAdmin.from('PlanInvite').select(INVITE_COLUMNS)
    .eq('token_hash', hashToken(token)).eq('post_id', postId).maybeSingle();
  if (error) throw new Error(`Failed to load the invitation: ${error.message}`);
  if (!row || row.status === 'cancelled') fail(404, 'invite_unavailable', 'This invitation isn’t available anymore.');
  if (String(plan.host_user_id) === viewer.id) return { plan: await planBody(postId, viewer) };
  if (row.invitee_user_id && String(row.invitee_user_id) !== viewer.id) {
    // The address's verified owner takes their invitation back from whoever opened a forwarded copy.
    const owner = row.channel === 'email' && row.needs_host_ok && (await hasVerifiedEmail(user, row.email));
    if (!owner || !(await takeInvite(row, viewer.id))) {
      fail(409, 'invite_used', 'Someone else already used this invitation. You can still ask to join.');
    }
    await supabaseAdmin.from('PlanInvite').update({ opened_at: nowIso(), updated_at: nowIso() }).eq('id', row.id);
    return claimedAnswer(postId, viewer, locked);
  }
  if (!row.invitee_user_id) {
    const needsHostOk = row.channel === 'email' && !(await hasVerifiedEmail(user, row.email));
    const { error: claimError } = await supabaseAdmin.from('PlanInvite')
      .update({ invitee_user_id: viewer.id, needs_host_ok: needsHostOk, claimed_at: nowIso(), opened_at: nowIso(), updated_at: nowIso() })
      .eq('id', row.id).is('invitee_user_id', null);
    if (claimError) throw new Error(`Failed to open the invitation: ${claimError.message}`);
  } else if (!row.opened_at) {
    await supabaseAdmin.from('PlanInvite').update({ opened_at: nowIso(), updated_at: nowIso() }).eq('id', row.id);
  }
  return claimedAnswer(postId, viewer, locked);
}

/** The plan as the person now sees it; a playdate they can't see yet keeps their invitation and says to verify. */
async function claimedAnswer(postId, viewer, locked) {
  if (locked) fail(403, 'needs_verified_address', 'Playdates are for verified neighbors. Verify your address to see this one.');
  return { plan: await planBody(postId, viewer) };
}

async function planBody(postId, viewer) {
  const { body } = await planService.getForViewer(postId, viewer);
  return body;
}

/** The plan screen was opened: an invitation the person hadn't seen counts as seen (the sign-in jump happens once). */
async function markOpened(viewerId, postId) {
  const { error } = await supabaseAdmin.from('PlanInvite').update({ opened_at: nowIso(), updated_at: nowIso() })
    .eq('post_id', postId).eq('invitee_user_id', viewerId).is('opened_at', null).neq('status', 'cancelled');
  if (error) logger.warn('plans.invites.open_unsaved', { postId, error: error.message });
}

/**
 * After the person's ask (planActions.askToJoin) as an invitee: their invitations count as answered yes.
 */
async function markAccepted(plan, viewerId, request) {
  const { data, error } = await supabaseAdmin.from('PlanInvite')
    .update({ status: 'accepted', answered_at: nowIso(), updated_at: nowIso() })
    .eq('post_id', plan.post_id).eq('invitee_user_id', viewerId).in('status', ['pending', 'declined'])
    .select('id, channel, claimed_at, created_at');
  if (error) {
    logger.warn('plans.invites.accept_unsaved', { postId: plan.post_id, error: error.message });
    return;
  }
  for (const row of data || []) {
    recordFunnelEvent('plan_invite_joined', {
      userId: viewerId,
      meta: { plan_id: plan.post_id, kind: plan.kind, channel: row.channel, status: request?.status || null },
    });
  }
}

/** POST /api/plans/:id/invites/decline: "Can't make it". Someone already in or waiting is taken out first. */
async function declineInvite(user, postId, { io = null } = {}) {
  const viewer = await loadViewer(user);
  if (!planService.isUuid(postId)) fail(404, 'not_found', "This plan isn't available.");
  const plan = await planService.loadPlanRow(postId);
  if (!plan || !planService.isVisibleTo(plan, viewer)) fail(404, 'not_found', "This plan isn't available.");
  const invites = await viewerInvites(viewer.id, [postId]);
  const invite = invites.get(postId);
  if (!invite) fail(404, 'not_found', 'You don’t have an invitation to this plan.');
  const { data: mine } = await supabaseAdmin.from('PlanRequest').select('status')
    .eq('post_id', postId).eq('user_id', viewer.id).maybeSingle();
  const wasIn = mine && ['pending', 'waitlisted', 'accepted'].includes(mine.status);
  if (wasIn) await actions().withdrawMine(user, postId, { io });
  const { data: changed, error } = await supabaseAdmin.from('PlanInvite')
    .update({ status: 'declined', answered_at: nowIso(), updated_at: nowIso() })
    .eq('post_id', postId).eq('invitee_user_id', viewer.id).in('status', ['pending', 'accepted'])
    .select('id');
  if (error) throw new Error(`Failed to save your answer: ${error.message}`);
  // Someone who was in already told the host by leaving (guestLeft).
  if (changed && changed.length && !(mine && mine.status === 'accepted')) {
    const who = actions().firstOf((await actions().userNames([viewer.id])).get(viewer.id));
    const goingCount = planService.seatsTaken(plan, await actions().activeRequests(postId));
    await planNotify.inviteDeclined({ plan, userId: viewer.id, guestName: who, goingCount });
  }
  return { plan: await planBody(postId, viewer) };
}

/**
 * GET /api/plans/invites/next: right after signing in, the newest invitation this person hasn't opened (an email
 * invite reaches them by their verified address), so the app can open it. { plan_id } or { plan_id: null }.
 */
async function nextInvite(user) {
  await attachEmailInvites(user);
  const { data, error } = await supabaseAdmin.from('PlanInvite').select('post_id, created_at')
    .eq('invitee_user_id', user.id).eq('status', 'pending').is('opened_at', null)
    .gt('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString())
    .order('created_at', { ascending: false }).limit(10);
  if (error) throw new Error(`Failed to load invitations: ${error.message}`);
  if (!data || data.length === 0) return { plan_id: null };
  const viewer = await loadViewer(user);
  const plans = new Map((await planService.loadPlanRows(data.map((r) => r.post_id))).map((p) => [p.post_id, p]));
  for (const row of data) {
    const plan = plans.get(row.post_id);
    // A playdate they can't see yet opens too: it says who invited them and to verify (J9).
    const seen = plan && (planService.isVisibleTo(plan, viewer) || isLockedPlaydate(plan, viewer));
    if (seen && isOpenForAnswers(plan)) return { plan_id: plan.post_id };
  }
  return { plan_id: null };
}

/**
 * For the J9 answer of GET /api/plans/:id: the host's first name when this person holds an invitation to the
 * playdate (which then counts as opened), else null.
 */
async function lockedInviteFrom(viewer, plan) {
  if (!isLockedPlaydate(plan, viewer)) return null;
  const invite = (await viewerInvites(viewer.id, [plan.post_id])).get(plan.post_id);
  if (!invite) return null;
  if (!invite.opened_at) await markOpened(viewer.id, plan.post_id);
  return actions().firstOf((await actions().userNames([plan.host_user_id])).get(String(plan.host_user_id)));
}

/** Plans the viewer is invited to and hasn't answered: GET /api/plans/mine's `invited`. */
async function invitedPlanIds(viewerId) {
  const { data, error } = await supabaseAdmin.from('PlanInvite').select('post_id')
    .eq('invitee_user_id', viewerId).eq('status', 'pending').limit(50);
  if (error) {
    logger.warn('plans.invites.mine_unavailable', { error: error.message });
    return [];
  }
  return [...new Set((data || []).map((r) => r.post_id))];
}

// ── The host's other actions ─────────────────────────────────

/** The host said no to, or removed, someone: their invitations to the plan end with it. */
async function cancelForPerson(postId, userId) {
  const { error } = await supabaseAdmin.from('PlanInvite').update({ status: 'cancelled', updated_at: nowIso() })
    .eq('post_id', postId).eq('invitee_user_id', userId).neq('status', 'cancelled');
  if (error) logger.warn('plans.invites.cancel_unsaved', { postId, error: error.message });
}

/** The plan was cancelled: people on Pantopus who were invited and hadn't answered hear it (no email). */
async function notifyCancelled(plan, hostFirst, note) {
  const { data, error } = await supabaseAdmin.from('PlanInvite').select('invitee_user_id')
    .eq('post_id', plan.post_id).eq('status', 'pending').not('invitee_user_id', 'is', null);
  if (error || !data) return;
  const { data: requests } = await supabaseAdmin.from('PlanRequest').select('user_id').eq('post_id', plan.post_id);
  const asked = new Set((requests || []).map((r) => String(r.user_id)));
  for (const id of new Set(data.map((r) => String(r.invitee_user_id)))) {
    if (asked.has(id)) continue;
    await planNotify.cancelled({ plan, request: { id: null, user_id: id }, hostFirst, note, wasIn: false });
  }
}

// ── Signed out ───────────────────────────────────────────────

/**
 * For the share page with ?invite=: whose invitation it is and, for an email invite, a hint of the address to sign
 * up with. Never the address itself or who opened it.
 */
async function publicInvite(postId, token) {
  if (!isToken(token) || !planService.isUuid(postId)) return null;
  const { data: row, error } = await supabaseAdmin.from('PlanInvite')
    .select('id, host_user_id, channel, email, status, invitee_user_id')
    .eq('token_hash', hashToken(token)).eq('post_id', postId).maybeSingle();
  if (error || !row) return null;
  const hostName = (await actions().userNames([row.host_user_id])).get(String(row.host_user_id));
  return {
    host_first_name: actions().firstOf(hostName),
    available: row.status !== 'cancelled',
    channel: row.channel,
    email_hint: row.channel === 'email' ? emailHint(row.email) : null,
  };
}

/** "Don't send me invitations": every invitation row for the address stops emails to it. */
async function unsubscribe(token) {
  if (!isToken(token)) return null;
  const { data: row, error } = await supabaseAdmin.from('PlanInvite').select('email')
    .eq('token_hash', hashToken(token)).eq('channel', 'email').maybeSingle();
  if (error || !row?.email) return null;
  const { error: updateError } = await supabaseAdmin.from('PlanInvite')
    .update({ email_opted_out_at: nowIso(), updated_at: nowIso() })
    .eq('email', row.email).is('email_opted_out_at', null);
  if (updateError) throw new Error(`Failed to save the unsubscribe: ${updateError.message}`);
  logger.info('plans.invites.unsubscribed');
  return { email_hint: emailHint(row.email) };
}

module.exports = {
  LIMITS,
  normalizeEmail,
  emailHint,
  hashToken,
  inviteUrl,
  listForHost,
  peopleToInvite,
  createInvites,
  createLinkInvite,
  cancelInvite,
  claimInvite,
  declineInvite,
  nextInvite,
  lockedInviteFrom,
  attachEmailInvites,
  viewerInvites,
  hostInviteCounts,
  myInviteView,
  invitedPlanIds,
  markOpened,
  markAccepted,
  cancelForPerson,
  notifyCancelled,
  publicInvite,
  unsubscribe,
};
