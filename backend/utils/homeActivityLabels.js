// Readable sentences for Home audit codes, shared by the Home activity timeline
// (GET /api/homes/:id/timeline) and the Members & Security audit log
// (GET /api/homes/:id/audit-log). Codes come from writeAuditLog and the Home SQL
// transactions; a code without a label here (readable ones, cut features' and
// future ones) reads as its own sentence.
const HOME_ACTIVITY_LABELS = {
  member_role: 'Member role changed',
  member_override: 'Member permission changed',
  member_remove: 'Member removed',
  member_attached: 'Household member added',
  apply_role_preset: 'Member role changed',
  OCCUPANCY_ATTACHED: 'Household member added',
  OCCUPANCY_DETACHED: 'Household member removed',
  OCCUPANCY_PENDING_APPROVAL: 'Request to join waiting for approval',
  OCCUPANCY_ROLE_UPGRADED: 'Member role changed',
  OCCUPANCY_UPGRADED: 'Member role changed',
  OCCUPANCY_TEMPLATE_APPLIED: 'Member permissions set',
  HOME_ACCESS_SECRET_CREATE: 'Access code added',
  HOME_ACCESS_SECRET_BOOTSTRAP_WIFI: 'Wi-Fi details added',
  HOME_ACCESS_SECRET_UPDATE: 'Access code updated',
  HOME_ACCESS_SECRET_DELETE: 'Access code deleted',
  scoped_grant_created: 'Share link created',
  scoped_grant_revoked: 'Share link revoked',
  HOME_INVITE_CREATED: 'Invitation sent',
  HOME_INVITE_RESEND_CREATED: 'Invitation sent again',
  HOME_INVITE_ACCEPTED: 'Invitation accepted',
  HOME_INVITE_REVOKED: 'Invitation revoked',
  HOME_INVITE_WITHDRAWN: 'Invitation withdrawn',
  residency_submission_saved: 'Residency claim submitted',
  residency_legacy_submission_saved: 'Residency claim submitted',
  residency_claim_rejected: 'Residency claim declined',
  MAIL_CODE_VERIFIED: 'Address verified by mail',
  POSTCARD_CODE_VERIFIED: 'Address verified by postcard',
  POSTCARD_REQUEST_SAVED: 'Verification postcard requested',
  OWNERSHIP_CLAIM_OWNER_INVITE_ACCEPTED: 'Owner invitation accepted',
  HOME_OWNER_POINTER_CLEARED: 'Owner of record cleared',
  CHALLENGE_WINDOW_EXPIRED_PROMOTED: 'Ownership challenge period ended',
  TRANSFER_PROPOSED: 'Ownership transfer proposed',
  TRANSFER_INITIATED: 'Ownership transfer started',
  TRANSFER_EXECUTED: 'Ownership transferred',
  QUORUM_ACTION_PROPOSED: 'Owner vote proposed',
  QUORUM_VOTE_CAST: 'Owner vote cast',
  QUORUM_ACTION_EXECUTED: 'Owner vote carried out',
  QUORUM_ACTION_EXPIRED: 'Owner vote expired',
  QUORUM_ACTION_AUTO_APPROVED: 'Owner vote approved automatically',
  AUTHORITY_REQUESTED: 'Landlord verification requested',
  AUTHORITY_VERIFIED: 'Landlord verified',
  AUTHORITY_REVOKED: 'Landlord verification revoked',
  TENANT_MOVE_OUT: 'Tenant moved out',
};
const CHECKLIST_ACTIVITY_LABELS = { completed: 'Checklist item completed', skipped: 'Checklist item skipped' };

function describeHomeActivity(row) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  if (row.action === 'home_checklist_updated' && CHECKLIST_ACTIVITY_LABELS[metadata.status]) return CHECKLIST_ACTIVITY_LABELS[metadata.status];
  if (row.action === 'member_remove' && metadata.user_id && metadata.user_id === row.actor_user_id) return 'Member left the home';
  if (Object.hasOwn(HOME_ACTIVITY_LABELS, row.action)) return HOME_ACTIVITY_LABELS[row.action];
  const words = String(row.action || '').replace(/[_.]+/g, ' ').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Home activity';
}

module.exports = { HOME_ACTIVITY_LABELS, describeHomeActivity };
