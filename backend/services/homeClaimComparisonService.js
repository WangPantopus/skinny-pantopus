const supabaseAdmin = require('../config/supabaseAdmin');
const homeClaimRoutingService = require('./homeClaimRoutingService');

function mapById(rows, idField = 'id') {
  const map = {};
  for (const row of rows || []) {
    map[row[idField]] = row;
  }
  return map;
}

function shouldIncludeComparisonClaim(claim) {
  return (
    homeClaimRoutingService.isClaimActiveRecord(claim) ||
    homeClaimRoutingService.hasQualifyingActiveChallenge(claim)
  );
}

async function buildHomeClaimComparison(homeId) {
  const [homeResult, ownersResult, claimsResult] = await Promise.all([
    supabaseAdmin
      .from('Home')
      .select('id, name, address, city, state, zipcode, security_state, household_resolution_state, household_resolution_updated_at')
      .eq('id', homeId)
      .maybeSingle(),
    supabaseAdmin
      .from('HomeOwner')
      .select('id, home_id, subject_id, owner_status, is_primary_owner, verification_tier, added_via, created_at, updated_at')
      .eq('home_id', homeId)
      .eq('owner_status', 'verified'),
    supabaseAdmin
      .from('HomeOwnershipClaim')
      .select('id, home_id, claimant_user_id, claim_type, state, claim_phase_v2, terminal_reason, challenge_state, claim_strength, routing_classification, identity_status, merged_into_claim_id, expires_at, method, risk_score, created_at, updated_at')
      .eq('home_id', homeId)
      .order('created_at', { ascending: true }),
  ]);

  if (homeResult.error) throw homeResult.error;
  if (ownersResult.error) throw ownersResult.error;
  if (claimsResult.error) throw claimsResult.error;

  const home = homeResult.data;
  if (!home) return null;

  const owners = ownersResult.data || [];
  const allClaims = claimsResult.data || [];
  const claims = allClaims.filter((claim) => shouldIncludeComparisonClaim(claim));

  const userIds = [
    ...new Set([
      ...owners.map((owner) => owner.subject_id),
      ...claims.map((claim) => claim.claimant_user_id),
    ]),
  ];

  const claimIds = claims.map((claim) => claim.id);

  const [usersResult, evidenceResult] = await Promise.all([
    userIds.length === 0
      ? { data: [], error: null }
      : supabaseAdmin
        .from('User')
        .select('id, username, name, email, profile_picture_url, created_at')
        .in('id', userIds),
    claimIds.length === 0
      ? { data: [], error: null }
      : supabaseAdmin
        .from('HomeVerificationEvidence')
        .select('id, claim_id, evidence_type, provider, status, confidence_level, storage_ref, metadata, created_at, updated_at')
        .in('claim_id', claimIds)
        .order('created_at', { ascending: true }),
  ]);

  if (usersResult.error) throw usersResult.error;
  if (evidenceResult.error) throw evidenceResult.error;

  const usersById = mapById(usersResult.data || []);
  const evidenceByClaimId = {};
  for (const evidence of evidenceResult.data || []) {
    if (!evidenceByClaimId[evidence.claim_id]) {
      evidenceByClaimId[evidence.claim_id] = [];
    }
    evidenceByClaimId[evidence.claim_id].push(evidence);
  }

  const incumbentOwners = owners.map((owner) => ({
    ...owner,
    user: usersById[owner.subject_id] || null,
  }));

  const comparisonClaims = claims.map((claim) => ({
    id: claim.id,
    home_id: claim.home_id,
    claimant_user_id: claim.claimant_user_id,
    claimant: usersById[claim.claimant_user_id] || null,
    claim_type: claim.claim_type,
    state: claim.state,
    claim_phase_v2: claim.claim_phase_v2 || homeClaimRoutingService.mapLegacyStateToPhaseV2(claim.state),
    terminal_reason: claim.terminal_reason || 'none',
    challenge_state: claim.challenge_state || 'none',
    claim_strength: claim.claim_strength || null,
    routing_classification: claim.routing_classification || null,
    identity_status: claim.identity_status || 'not_started',
    merged_into_claim_id: claim.merged_into_claim_id || null,
    expires_at: claim.expires_at || null,
    method: claim.method,
    risk_score: claim.risk_score,
    created_at: claim.created_at,
    updated_at: claim.updated_at,
    evidence: evidenceByClaimId[claim.id] || [],
  }));

  return {
    home_id: home.id,
    home: {
      id: home.id,
      name: home.name || null,
      address: home.address,
      city: home.city,
      state: home.state,
      zipcode: home.zipcode,
      security_state: home.security_state,
      household_resolution_state: home.household_resolution_state,
      household_resolution_updated_at: home.household_resolution_updated_at,
    },
    household_resolution_state: home.household_resolution_state,
    incumbent: {
      owners: incumbentOwners,
      has_verified_owner: incumbentOwners.length > 0,
      challenge_state: comparisonClaims.some((claim) => homeClaimRoutingService.hasQualifyingActiveChallenge(claim))
        ? 'challenged'
        : 'none',
    },
    claims: comparisonClaims,
  };
}

module.exports = {
  buildHomeClaimComparison,
};
