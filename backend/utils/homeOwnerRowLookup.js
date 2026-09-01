/**
 * Resolve which HomeOwner row to update when verifying a claimant.
 * Partial unique index homeowner_subject_unique excludes revoked rows, so without
 * this, a claimant who was previously revoked gets a second INSERT instead of
 * reactivating their row (duplicate revoked + verified per subject_id).
 */
async function findHomeOwnerRowForClaimant(supabaseAdmin, homeId, subjectId) {
  const { data: nonRevoked, error: errActive } = await supabaseAdmin
    .from('HomeOwner')
    .select('id, owner_status')
    .eq('home_id', homeId)
    .eq('subject_id', subjectId)
    .neq('owner_status', 'revoked')
    .maybeSingle();

  if (errActive) throw errActive;
  if (nonRevoked) return nonRevoked;

  const { data: revokedRows, error: errRevoked } = await supabaseAdmin
    .from('HomeOwner')
    .select('id, owner_status')
    .eq('home_id', homeId)
    .eq('subject_id', subjectId)
    .eq('owner_status', 'revoked')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (errRevoked) throw errRevoked;
  return revokedRows?.[0] || null;
}

module.exports = { findHomeOwnerRowForClaimant };
