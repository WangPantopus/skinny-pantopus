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
const { isVerifiedResident } = require('./homePermissions');

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
    // The person's verified ownerships are read alongside their occupancies (one round trip, not two): they
    // decide the badge when the occupancy alone doesn't, and the Home when there is no occupancy.
    const [{ data: occRows }, ownersRead] = await Promise.all([
      supabaseAdmin
        .from('HomeOccupancy')
        .select(`
          verification_status,
          verification_source,
          verified_at,
          created_at,
          home:home_id ( id, city, state )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('HomeOwner')
        .select('home_id, subject_type')
        .eq('subject_id', userId)
        .eq('owner_status', 'verified'),
    ]);

    const occ = (occRows || []).find((r) => r.home);
    if (occ && occ.home) {
      const home = occ.home;
      const homeId = home.id;
      // Use the same attestation gate as home artifacts: an accepted household
      // invitation grants household tools, not an address-verified badge.
      let verified = isVerifiedResident({ occupancy: occ });
      if (!verified) {
        // A verified ownership of this Home as a person (homePermissions.isVerifiedOwner). An unreadable
        // ownership read, or more than one such row, leaves the summary empty, as that check's error did.
        if (ownersRead.error) return empty;
        const own = (ownersRead.data || []).filter((row) => row.home_id === homeId && row.subject_type === 'user');
        if (own.length > 1) return empty;
        verified = own.length === 1;
      }
      return {
        hasHome: true,
        city: home.city || null,
        state: home.state || null,
        verified,
      };
    }

    const ownerRows = ownersRead.data;

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
