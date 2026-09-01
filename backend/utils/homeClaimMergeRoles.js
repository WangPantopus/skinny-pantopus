const { mapLegacyRole } = require('./homePermissions');

const CLAIM_MERGE_ROLE_BY_TYPE = {
  owner: {
    proposedRole: 'owner',
    proposedRoleBase: 'owner',
    occupancyClaimType: 'owner',
  },
  admin: {
    proposedRole: 'admin',
    proposedRoleBase: 'admin',
    occupancyClaimType: 'admin',
  },
  resident: {
    proposedRole: 'renter',
    proposedRoleBase: 'lease_resident',
    occupancyClaimType: 'resident',
  },
};

const DEFAULT_CLAIM_MERGE_ROLE = {
  proposedRole: 'member',
  proposedRoleBase: 'member',
  occupancyClaimType: 'member',
};

function getClaimMergeRoleForClaim(claim) {
  return CLAIM_MERGE_ROLE_BY_TYPE[claim?.claim_type] || DEFAULT_CLAIM_MERGE_ROLE;
}

function getInviteRoleBase(invite) {
  return invite?.proposed_role_base || mapLegacyRole(invite?.proposed_role || 'member');
}

module.exports = {
  getClaimMergeRoleForClaim,
  getInviteRoleBase,
};
