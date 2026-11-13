'use strict';

/**
 * Acting for a business (the business graph's shared pieces, section 2).
 *
 * One question, asked the same way by every feature that lets a person do something as a business: may this
 * signed-in person act for this business with this permission, and, where the feature needs it, is the business
 * one Pantopus has verified with a published page?
 *
 * The permission logic is not copied: this wraps checkBusinessPermission (utils/businessPermissions.js). What it
 * adds is one answer shape and one set of refusals, so a feature does not invent its own.
 *
 * The rule that goes with it (the caller's part):
 *  - The business is the public author. Author fields carry the business's account.
 *  - The staff member's id is saved where the feature has a place for it and is sent only to the business's team.
 *  - One audit line per action, through `audit` below, named `<feature>.<verb>`.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { checkBusinessPermission, writeAuditLog } = require('../utils/businessPermissions');
const { PANTOPUS_VERIFIED_STATUSES } = require('../utils/businessConstants');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REFUSALS = {
  business_not_found: [404, "That business isn't on Pantopus."],
  not_your_business: [403, "You're not on this business's team."],
  not_allowed: [403, "Your role on this business's team doesn't allow that."],
  business_not_verified: [403, 'This needs a business Pantopus has verified, with a published page.'],
  business_check_unavailable: [503, "We couldn't check your access to this business right now. Please try again."],
};

function refuse(code) {
  const [status, error] = REFUSALS[code];
  return { ok: false, status, code, error };
}

/** True for a business Pantopus has verified (a reviewed document or a registry check) with a published page. */
function isVerifiedAndPublished(profile) {
  return Boolean(profile)
    && profile.is_published === true
    && PANTOPUS_VERIFIED_STATUSES.has(profile.verification_status);
}

/**
 * @param {object} opts
 * @param {string} opts.businessUserId  the business's account
 * @param {string} opts.actorUserId     the signed-in person
 * @param {string|null} [opts.permission]  a business permission such as 'plans.post'; null asks only for a seat
 *   on the team
 * @param {boolean} [opts.needsVerified]  also require a verified business with a published page
 * @returns {Promise<
 *   { ok: true, business: { id: string, name: string, username: string|null, verified: boolean },
 *     actor: { user_id: string, role_base: string } }
 *   | { ok: false, status: number, code: string, error: string }>}
 *   Never throws: a lookup that fails answers `business_check_unavailable` and is never treated as a yes.
 */
async function actingForBusiness({ businessUserId, actorUserId, permission = null, needsVerified = false }) {
  if (!UUID.test(String(businessUserId || '')) || !actorUserId) return refuse('business_not_found');
  try {
    const { data: business, error } = await supabaseAdmin.from('User')
      .select('id, name, username, account_type').eq('id', businessUserId).maybeSingle();
    if (error) return refuse('business_check_unavailable');
    // A retired business is an individual account again, so it is not a business here.
    if (!business || business.account_type !== 'business') return refuse('business_not_found');

    const access = await checkBusinessPermission(businessUserId, actorUserId, permission, { throwOnError: true });
    if (!access.membership) return refuse('not_your_business');
    if (!access.hasAccess) return refuse('not_allowed');

    const { data: profile, error: profileError } = await supabaseAdmin.from('BusinessProfile')
      .select('business_user_id, verification_status, is_published').eq('business_user_id', businessUserId).maybeSingle();
    if (profileError) return refuse('business_check_unavailable');
    const verified = isVerifiedAndPublished(profile);
    if (needsVerified && !verified) return refuse('business_not_verified');

    return {
      ok: true,
      business: { id: String(business.id), name: business.name || '', username: business.username || null, verified },
      actor: { user_id: String(actorUserId), role_base: access.membership.role_base },
    };
  } catch (err) {
    logger.warn('businessActing.check_failed', { businessUserId, permission, error: err.message });
    return refuse('business_check_unavailable');
  }
}

/** The audit line for an action taken as a business: `<feature>.<verb>`, who did it, and what it touched. */
function audit({ businessUserId, actorUserId, action, targetType = null, targetId = null, metadata = {} }) {
  return writeAuditLog(businessUserId, actorUserId, action, targetType, targetId, metadata);
}

module.exports = { actingForBusiness, isVerifiedAndPublished, audit, REFUSALS };
