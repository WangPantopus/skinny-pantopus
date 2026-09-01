/**
 * Residency summary for profiles.
 *
 * PRV-05: this used to be served to unauthenticated callers, which made
 * GET /api/users/id/:id an anonymous "is this person a verified resident, and
 * in which city" oracle — queryable at scale with no account and no rate
 * limit, over the most safety-sensitive fact the product holds. Residency
 * facts now require a signed-in viewer.
 *
 * The stronger control the audit recommends is reciprocity: only a caller who
 * holds a verified residency themselves may read anyone else's. That is a
 * product decision (audit §7 Q5) — this function is where it goes when taken.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const { isVerifiedOwner } = require('./homePermissions');

/**
 * @param {string} userId - whose residency is being summarised
 * @param {string|null} viewerId - the signed-in caller, or null when anonymous
 * @returns {Promise<{ hasHome: boolean, city: string|null, state: string|null, verified: boolean }>}
 */
async function getPublicResidencySummary(userId, viewerId = null) {
  const empty = { hasHome: false, city: null, state: null, verified: false };
  if (!userId) return empty;

  // Anonymous callers learn nothing about where anyone lives.
  if (!viewerId) return empty;

  try {
    const { data: occRows } = await supabaseAdmin
      .from('HomeOccupancy')
      .select(`
        verification_status,
        verified_at,
        created_at,
        home:home_id ( id, city, state )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    const occ = (occRows || []).find((r) => r.home);
    if (occ && occ.home) {
      const home = occ.home;
      const homeId = home.id;
      // The public "verified resident" badge respects expiry when enforcement
      // is on: a verification past its validity window stops being presented
      // to strangers as current. Legacy rows without verified_at never demote.
      // eslint-disable-next-line global-require
      const verificationAge = require('./verificationAge');
      let verified = occ.verification_status === 'verified'
        && !verificationAge.staleAffectsTrust(occ.verified_at);
      if (!verified) {
        const ownerCheck = await isVerifiedOwner(homeId, userId);
        verified = ownerCheck.isOwner;
      }
      return {
        hasHome: true,
        city: home.city || null,
        state: home.state || null,
        verified,
      };
    }

    const { data: ownerRows } = await supabaseAdmin
      .from('HomeOwner')
      .select('home_id')
      .eq('subject_id', userId)
      .eq('owner_status', 'verified')
      .limit(1);

    if (ownerRows?.[0]?.home_id) {
      const { data: h } = await supabaseAdmin
        .from('Home')
        .select('city, state')
        .eq('id', ownerRows[0].home_id)
        .maybeSingle();
      return {
        hasHome: true,
        city: h?.city || null,
        state: h?.state || null,
        verified: true,
      };
    }

    return empty;
  } catch {
    return empty;
  }
}

module.exports = { getPublicResidencySummary };
