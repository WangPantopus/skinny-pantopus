const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { writeAuditLog } = require('../utils/homePermissions');
const homeClaimCompatService = require('./homeClaimCompatService');
const homeClaimRoutingService = require('./homeClaimRoutingService');
const { findHomeOwnerRowForClaimant } = require('../utils/homeOwnerRowLookup');
const { getClaimMergeRoleForClaim, getInviteRoleBase } = require('../utils/homeClaimMergeRoles');

function buildHttpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) {
    error.code = code;
  }
  return error;
}

async function getLatestUserHomeClaim(homeId, userId) {
  const { data: claims, error } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, state, claim_phase_v2, claimant_user_id, created_at')
    .eq('home_id', homeId)
    .eq('claimant_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return claims?.[0] || null;
}

const HOME_RESTORE_FIELDS = [
  'owner_id',
  'ownership_state',
  'household_resolution_state',
  'household_resolution_updated_at',
  'updated_at',
];

const OWNER_RESTORE_FIELDS = [
  'owner_status',
  'is_primary_owner',
  'added_via',
  'verification_tier',
  'updated_at',
];

const OCCUPANCY_RESTORE_FIELDS = [
  'role',
  'role_base',
  'is_active',
  'verification_status',
  'can_manage_home',
  'can_manage_finance',
  'can_manage_access',
  'can_manage_tasks',
  'can_view_sensitive',
  'age_band',
  'start_at',
  'end_at',
  'access_start_at',
  'access_end_at',
  'added_by_user_id',
  'updated_at',
];

const CLAIM_RESTORE_FIELDS = [
  'state',
  'claim_phase_v2',
  'terminal_reason',
  'challenge_state',
  'routing_classification',
  'merged_into_claim_id',
  'updated_at',
];

const INVITE_RESTORE_FIELDS = [
  'status',
  'proposed_role',
  'proposed_role_base',
  'updated_at',
];

function pickRestoreFields(row, fields) {
  return fields.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      payload[field] = row[field];
    }
    return payload;
  }, {});
}

async function assertOwnerInviteAuthority({ homeId, inviterUserId }) {
  if (!inviterUserId) {
    throw buildHttpError(403, 'Only verified owners can invite co-owners', 'OWNER_INVITE_AUTHORITY_REQUIRED');
  }

  const [ownerResult, homeResult] = await Promise.all([
    supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', homeId)
      .eq('subject_id', inviterUserId)
      .eq('owner_status', 'verified')
      .maybeSingle(),
    supabaseAdmin
      .from('Home')
      .select('id, owner_id')
      .eq('id', homeId)
      .maybeSingle(),
  ]);

  if (ownerResult.error) throw ownerResult.error;
  if (homeResult.error) throw homeResult.error;
  if (!homeResult.data) {
    throw buildHttpError(404, 'Home not found');
  }

  if (!ownerResult.data && homeResult.data.owner_id !== inviterUserId) {
    throw buildHttpError(403, 'Only verified owners can invite co-owners', 'OWNER_INVITE_AUTHORITY_REQUIRED');
  }
}

async function captureOwnerAcceptSnapshot({ homeId, userId, claim, invite }) {
  const [homeResult, ownerRowsResult, occupancyResult] = await Promise.all([
    supabaseAdmin
      .from('Home')
      .select('id, owner_id, ownership_state, household_resolution_state, household_resolution_updated_at, updated_at')
      .eq('id', homeId)
      .maybeSingle(),
    supabaseAdmin
      .from('HomeOwner')
      .select('*')
      .eq('home_id', homeId)
      .eq('subject_id', userId),
    supabaseAdmin
      .from('HomeOccupancy')
      .select('*')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (homeResult.error) throw homeResult.error;
  if (ownerRowsResult.error) throw ownerRowsResult.error;
  if (occupancyResult.error) throw occupancyResult.error;

  return {
    homeId,
    userId,
    home: homeResult.data || null,
    ownerRows: ownerRowsResult.data || [],
    occupancy: occupancyResult.data || null,
    claim,
    invite,
  };
}

async function restoreOwnerAcceptSnapshot(snapshot, context = {}) {
  if (!snapshot) return;
  const rollbackErrors = [];

  const safeRestore = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      rollbackErrors.push({ label, error: err });
      logger.error('Failed to roll back owner invite acceptance side effect', {
        step: label,
        error: err.message,
        homeId: snapshot.homeId,
        userId: snapshot.userId,
      });
    }
  };

  await safeRestore('home', async () => {
    if (!snapshot.home) return;
    const { error } = await supabaseAdmin
      .from('Home')
      .update(pickRestoreFields(snapshot.home, HOME_RESTORE_FIELDS))
      .eq('id', snapshot.home.id);
    if (error) throw error;
  });

  await safeRestore('owner_rows', async () => {
    const beforeIds = new Set(snapshot.ownerRows.map((row) => row.id));
    const { data: currentOwnerRows, error: currentOwnerError } = await supabaseAdmin
      .from('HomeOwner')
      .select('id')
      .eq('home_id', snapshot.homeId)
      .eq('subject_id', snapshot.userId);
    if (currentOwnerError) throw currentOwnerError;

    for (const row of (currentOwnerRows || [])) {
      const createdByThisAccept = context.createdOwnerRowId
        ? row.id === context.createdOwnerRowId
        : !beforeIds.has(row.id);
      if (createdByThisAccept) {
        const { error } = await supabaseAdmin
          .from('HomeOwner')
          .delete()
          .eq('id', row.id);
        if (error) throw error;
      }
    }

    for (const row of snapshot.ownerRows) {
      const { error } = await supabaseAdmin
        .from('HomeOwner')
        .update(pickRestoreFields(row, OWNER_RESTORE_FIELDS))
        .eq('id', row.id);
      if (error) throw error;
    }
  });

  await safeRestore('occupancy', async () => {
    if (snapshot.occupancy) {
      const { error } = await supabaseAdmin
        .from('HomeOccupancy')
        .update(pickRestoreFields(snapshot.occupancy, OCCUPANCY_RESTORE_FIELDS))
        .eq('id', snapshot.occupancy.id);
      if (error) throw error;
      return;
    }

    const deleteQuery = supabaseAdmin
      .from('HomeOccupancy')
      .delete();
    const { error } = context.createdOccupancyId
      ? await deleteQuery.eq('id', context.createdOccupancyId)
      : await deleteQuery
        .eq('home_id', snapshot.homeId)
        .eq('user_id', snapshot.userId);
    if (error) throw error;
  });

  await safeRestore('claim', async () => {
    const { error } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update(pickRestoreFields(snapshot.claim, CLAIM_RESTORE_FIELDS))
      .eq('id', snapshot.claim.id);
    if (error) throw error;
  });

  await safeRestore('invite', async () => {
    const { error } = await supabaseAdmin
      .from('HomeInvite')
      .update(pickRestoreFields(snapshot.invite, INVITE_RESTORE_FIELDS))
      .eq('id', snapshot.invite.id);
    if (error) throw error;
  });

  if (rollbackErrors.length) {
    const error = new Error('Owner invite acceptance rollback incomplete');
    error.rollbackErrors = rollbackErrors;
    throw error;
  }
}

async function promoteInvitedOwnerClaim({ homeId, userId }) {
  const now = new Date().toISOString();
  const [homeResult, ownersResult] = await Promise.all([
    supabaseAdmin
      .from('Home')
      .select('id, owner_id')
      .eq('id', homeId)
      .maybeSingle(),
    supabaseAdmin
      .from('HomeOwner')
      .select('id, subject_id, owner_status, is_primary_owner')
      .eq('home_id', homeId)
      .neq('owner_status', 'revoked'),
  ]);

  if (homeResult.error) throw homeResult.error;
  if (ownersResult.error) throw ownersResult.error;
  if (!homeResult.data) {
    throw buildHttpError(404, 'Home not found');
  }

  const verifiedOwners = (ownersResult.data || []).filter((owner) => owner.owner_status === 'verified');
  const isPrimaryOwner = verifiedOwners.length === 0 && !homeResult.data?.owner_id;
  const existingOwnerRow = await findHomeOwnerRowForClaimant(supabaseAdmin, homeId, userId);
  let ownerRowId = null;
  let createdOwnerRow = false;

  if (existingOwnerRow) {
    const { error } = await supabaseAdmin
      .from('HomeOwner')
      .update({
        owner_status: 'verified',
        is_primary_owner: isPrimaryOwner,
        verification_tier: 'weak',
        updated_at: now,
      })
      .eq('id', existingOwnerRow.id);
    if (error) throw error;
    ownerRowId = existingOwnerRow.id;
  } else {
    const { data: insertedOwner, error } = await supabaseAdmin
      .from('HomeOwner')
      .insert({
        home_id: homeId,
        subject_type: 'user',
        subject_id: userId,
        owner_status: 'verified',
        is_primary_owner: isPrimaryOwner,
        added_via: 'claim',
        verification_tier: 'weak',
      })
      .select('id')
      .single();
    if (error) throw error;
    ownerRowId = insertedOwner?.id || null;
    createdOwnerRow = true;
  }

  const homeUpdate = {
    ownership_state: 'owner_verified',
    updated_at: now,
  };
  if (!homeResult.data?.owner_id) {
    homeUpdate.owner_id = userId;
  }

  const { error: homeUpdateError } = await supabaseAdmin
    .from('Home')
    .update(homeUpdate)
    .eq('id', homeId);
  if (homeUpdateError) throw homeUpdateError;

  return { isPrimaryOwner, ownerRowId, createdOwnerRow };
}

async function claimHasVerifiedIdentity(claim) {
  if (claim.identity_status === 'verified') {
    return true;
  }

  const { data: evidenceRows, error } = await supabaseAdmin
    .from('HomeVerificationEvidence')
    .select('id, evidence_type, status')
    .eq('claim_id', claim.id)
    .eq('evidence_type', 'idv');

  if (error) throw error;

  return (evidenceRows || []).some((evidence) => evidence.status === 'verified');
}

async function acceptClaimMerge({
  homeId,
  claimId,
  userId,
  invite,
}) {
  if (!invite || invite.home_id !== homeId || invite.proposed_preset_key !== `claim_merge:${claimId}`) {
    throw buildHttpError(404, 'No eligible household invitation was found for this claim');
  }

  const { data: claim, error: claimError } = await supabaseAdmin
    .from('HomeOwnershipClaim')
    .select('id, home_id, claimant_user_id, claim_type, state, claim_phase_v2, terminal_reason, challenge_state, routing_classification, identity_status, merged_into_claim_id')
    .eq('id', claimId)
    .eq('home_id', homeId)
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claim) {
    throw buildHttpError(404, 'Claim not found');
  }

  if (claim.claimant_user_id !== userId) {
    throw buildHttpError(403, 'Not authorized');
  }

  if (!homeClaimRoutingService.isClaimActiveRecord(claim)) {
    throw buildHttpError(400, 'Claim is not eligible for merge acceptance');
  }

  const hasVerifiedIdentity = await claimHasVerifiedIdentity(claim);
  if (!hasVerifiedIdentity) {
    throw buildHttpError(
      409,
      'Identity confirmation is required before this claim can be merged into the household',
      'IDENTITY_CONFIRMATION_REQUIRED',
    );
  }

  const acceptedRole = getClaimMergeRoleForClaim(claim);
  const inviteRoleBase = getInviteRoleBase(invite);
  if (inviteRoleBase !== acceptedRole.proposedRoleBase) {
    logger.warn('Claim merge invite role did not match claim type; using claim-derived role', {
      homeId,
      claimId,
      inviteId: invite.id,
      claimType: claim.claim_type,
      inviteRoleBase,
      acceptedRoleBase: acceptedRole.proposedRoleBase,
    });
  }

  const acceptedRoleBase = acceptedRole.proposedRoleBase;
  const acceptedAsOwner = acceptedRoleBase === 'owner' && claim.claim_type === 'owner';
  const occupancyAttachService = require('./occupancyAttachService');
  let ownerPromotion = null;
  let rollbackSnapshot = null;
  let attachResult = null;
  let mergedIntoClaim = null;
  let homeResolutionState = null;

  try {
    if (acceptedAsOwner) {
      await assertOwnerInviteAuthority({ homeId, inviterUserId: invite.invited_by });
      rollbackSnapshot = await captureOwnerAcceptSnapshot({ homeId, userId, claim, invite });
      ownerPromotion = await promoteInvitedOwnerClaim({ homeId, userId });
    }

    attachResult = await occupancyAttachService.attach({
      homeId,
      userId,
      method: acceptedAsOwner ? 'owner_invite' : 'owner_bootstrap',
      claimType: acceptedRole.occupancyClaimType,
      roleOverride: acceptedRoleBase,
      actorId: userId,
      metadata: {
        source: acceptedAsOwner ? 'claim_owner_invite_accept' : 'claim_merge_accept',
        invite_id: invite.id,
        claim_id: claimId,
        invited_by: invite.invited_by || null,
      },
    });

    if (!attachResult.success && attachResult.status !== 'already_attached') {
      logger.error('Failed to attach claimant during merge acceptance', {
        error: attachResult.error,
        homeId,
        claimId,
        inviteId: invite.id,
      });
      throw buildHttpError(500, 'Failed to accept household merge');
    }

    mergedIntoClaim = acceptedAsOwner ? null : await getLatestUserHomeClaim(homeId, invite.invited_by);
    const nextClaimPhase = acceptedAsOwner ? 'verified' : 'merged_into_household';
    const nextTerminalReason = acceptedAsOwner ? 'none' : 'merged_via_invite';

    const { error: claimUpdateError } = await supabaseAdmin
      .from('HomeOwnershipClaim')
      .update({
        state: 'approved',
        claim_phase_v2: nextClaimPhase,
        terminal_reason: nextTerminalReason,
        challenge_state: 'none',
        routing_classification: 'merge_candidate',
        merged_into_claim_id: mergedIntoClaim?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId);

    if (claimUpdateError) throw claimUpdateError;

    const { error: inviteUpdateError } = await supabaseAdmin
      .from('HomeInvite')
      .update({
        status: 'accepted',
        proposed_role: acceptedRole.proposedRole,
        proposed_role_base: acceptedRoleBase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id);
    if (inviteUpdateError) throw inviteUpdateError;

    homeResolutionState = await homeClaimCompatService.recalculateHouseholdResolutionState(homeId);
  } catch (err) {
    if (acceptedAsOwner && rollbackSnapshot) {
      try {
        await restoreOwnerAcceptSnapshot(rollbackSnapshot, {
          createdOwnerRowId: ownerPromotion?.createdOwnerRow ? ownerPromotion.ownerRowId : null,
          createdOccupancyId: rollbackSnapshot.occupancy ? null : attachResult?.occupancy?.id,
        });
      } catch (rollbackError) {
        err.rollbackError = rollbackError;
        logger.error('Owner invite acceptance rollback incomplete', {
          error: rollbackError.message,
          homeId,
          claimId,
          inviteId: invite.id,
        });
      }
    }
    throw err;
  }

  const nextClaimPhase = acceptedAsOwner ? 'verified' : 'merged_into_household';
  const nextTerminalReason = acceptedAsOwner ? 'none' : 'merged_via_invite';

  const notificationService = require('./notificationService');
  try {
    const [{ data: claimant }, { data: home }] = await Promise.all([
      supabaseAdmin.from('User').select('name, username, first_name').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('Home').select('name, address').eq('id', homeId).maybeSingle(),
    ]);

    await notificationService.notifyHomeInviteAccepted({
      inviterUserId: invite.invited_by,
      accepterName: claimant?.name || claimant?.first_name || claimant?.username || 'Someone',
      homeName: home?.name || home?.address || 'A home',
      homeId,
    });
  } catch (notificationError) {
    logger.warn('Failed to notify inviter about accepted merge', {
      error: notificationError.message,
      homeId,
      claimId,
      inviteId: invite.id,
    });
  }

  await writeAuditLog(
    homeId,
    userId,
    acceptedAsOwner ? 'OWNERSHIP_CLAIM_OWNER_INVITE_ACCEPTED' : 'OWNERSHIP_CLAIM_MERGED',
    'HomeOwnershipClaim',
    claimId,
    {
      invite_id: invite.id,
      merged_into_claim_id: mergedIntoClaim?.id || null,
      accepted_role_base: acceptedRoleBase,
      is_primary_owner: ownerPromotion?.isPrimaryOwner ?? null,
    },
  );

  return {
    claimId,
    mergedIntoClaimId: mergedIntoClaim?.id || null,
    claimPhaseV2: nextClaimPhase,
    terminalReason: nextTerminalReason,
    acceptedRoleBase,
    acceptedAsOwner,
    homeResolutionState,
    occupancy: attachResult.occupancy || null,
  };
}

module.exports = {
  acceptClaimMerge,
};
