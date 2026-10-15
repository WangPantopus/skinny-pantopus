'use strict';

/**
 * GET /api/public/plans/:id, for the signed-out share page (board W1).
 *
 * The plan's public card without anything about a viewer and without any point
 * at all (the page draws an illustration, not a map): no host user id, no
 * distance, no exact time or place for a playdate. A playdate answers only
 * { kind: "playdate", city }. Plans exist publicly only while their host has
 * the `plans` flag (and `plans_playdates` for a playdate), so a share link from
 * a pilot tester works for the friends they invite.
 */

const { isFeatureEnabled } = require('../featureFlagService');
const planService = require('./planService');
const { canReadPostModeration } = require('../pulse/readAccess');

const NOBODY = '00000000-0000-0000-0000-000000000000';

function anonymousViewer() {
  return {
    id: NOBODY,
    role: null,
    verified: false,
    seesPlaydates: false,
    playdatesFlag: false,
    homes: [],
    savedPlaces: [],
    gps: null,
    locations: [],
    origin: null,
    blockedUserIds: new Set(),
    mutedUserIds: new Set(),
    hiddenPostIds: new Set(),
  };
}

async function publicPlan(postId) {
  if (!planService.isUuid(postId)) return null;
  const plan = await planService.loadPlanRow(postId);
  if (!plan || !plan.post || !canReadPostModeration(plan.post, null)) return null;
  if (plan.post.read_scope != null
    && (plan.post.read_scope !== 'public' || plan.post.allow_external_share === false)) return null;
  // An invited plan is for its host and the invited people only (S14).
  if (plan.join_requirement === 'invited') return null;
  if (!(await isFeatureEnabled('plans', plan.host_user_id))) return null;
  if (plan.kind === 'playdate') {
    if (!(await isFeatureEnabled('plans_playdates', plan.host_user_id))) return null;
    return { kind: 'playdate', city: plan.city || null };
  }

  const viewer = anonymousViewer();
  const ctx = await planService.loadCardContext([plan], viewer);
  const card = planService.buildCard(plan, viewer, ctx);
  return {
    id: card.id,
    kind: card.kind,
    title: card.title,
    about: card.about,
    starts_at: card.starts_at,
    ends_at: card.ends_at,
    starts_on: card.starts_on,
    day_part: card.day_part,
    timezone: card.timezone,
    area: { label: card.area.label, city: card.area.city, precision: card.area.precision },
    place_kind: card.place_kind,
    host: {
      display_name: card.host.display_name,
      avatar_url: card.host.avatar_url,
      verified_address: card.host.verified_address,
      plans_hosted: card.host.plans_hosted,
    },
    spots: card.spots,
    going_count: card.going_count,
    spots_left: card.spots_left,
    is_full: card.is_full,
    waitlist_count: card.waitlist_count,
    details: card.details,
    join_requirement: card.join_requirement,
    state: card.state,
    asking_closes_at: card.asking_closes_at,
    share_url: card.share_url,
  };
}

module.exports = { publicPlan };
