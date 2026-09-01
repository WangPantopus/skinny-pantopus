/**
 * Public-facing residency summary for profiles.
 * Uses primary home (first active HomeOccupancy by created_at) and
 * HomeOccupancy.verification_status + verified HomeOwner as signals.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const { isVerifiedOwner } = require('./homePermissions');

/**
 * @returns {Promise<{ hasHome: boolean, city: string|null, state: string|null, verified: boolean }>}
 */
async function getPublicResidencySummary(userId) {
  const empty = { hasHome: false, city: null, state: null, verified: false };
  if (!userId) return empty;

  try {
    const { data: occRows } = await supabaseAdmin
      .from('HomeOccupancy')
      .select(`
        verification_status,
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
      let verified = occ.verification_status === 'verified';
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
