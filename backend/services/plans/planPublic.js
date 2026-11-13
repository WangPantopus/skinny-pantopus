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
  if (!(await isFeatureEnabled('plans', plan.host_user_id))) return null;
  // A business's plan has a public page only while the business may host: verified with a published page, and
  // with the switch on (plan.business, attached by loadPlanRow). Its session for kids needs the kids' switch too.
  if (plan.business_user_id) return publicBusinessPlan(plan);
  if (plan.kind === 'playdate') {
    if (!(await isFeatureEnabled('plans_playdates', plan.host_user_id))) return null;
    return { kind: 'playdate', city: plan.city || null };
  }

  const viewer = anonymousViewer();
  const ctx = await planService.loadCardContext([plan], viewer);
  return publicCard(planService.buildCard(plan, viewer, ctx));
}

/** What anyone, signed out, may read of a plan's card: the area, never a point, the place or the people. */
function publicCard(card) {
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

/**
 * The signed-out card of a business's plan (board D6): the same card, plus the business, what it calls the plan,
 * and the place by name and street address, which is the business's own. A business's session for kids is a
 * public class, so it gets the whole card where a neighbor's playdate gets only its city. No price yet: a
 * business's plan is free until paid spots are built (`price: null`).
 */
async function publicBusinessPlan(plan) {
  const business = plan.business;
  if (!business || !business.ok) return null;
  if (plan.kind === 'playdate' && !business.kids_ok) return null;
  const viewer = anonymousViewer();
  const ctx = await planService.loadCardContext([plan], viewer);
  const card = planService.buildCard(plan, viewer, ctx);
  return {
    ...publicCard(card),
    business: card.business ? {
      name: card.business.name,
      avatar_url: card.business.avatar_url,
      verified: card.business.verified,
      page_url: card.business.page_url,
      plans_hosted: card.business.plans_hosted,
    } : null,
    label: card.label,
    label_text: card.label_text,
    place: card.place ? { name: card.place.name, address: card.place.address } : null,
    price: card.price,
  };
}

module.exports = { publicPlan };
