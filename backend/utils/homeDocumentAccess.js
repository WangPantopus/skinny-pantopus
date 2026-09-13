const { checkHomePermission, mapLegacyRole, ROLE_RANK } = require('./homePermissions');

const HOME_DOCUMENT_VISIBILITIES = ['public', 'members', 'managers', 'sensitive'];
const HOME_DOCUMENT_TYPES = ['lease', 'insurance', 'warranty', 'manual', 'permit', 'floor_plan', 'receipt', 'photo', 'paint_color', 'other'];

async function homeDocumentVisibilities(homeId, userId, access) {
  // Match home_can_see_visibility: manager scope follows the current role,
  // while sensitive scope follows its explicit IAM permission/overrides.
  const allowed = ['public', 'members'];
  const role = access.effective_role_base || (access.isOwner ? 'owner' : null)
    || access.occupancy?.role_base || mapLegacyRole(access.occupancy?.role);
  if ((ROLE_RANK[role] || 0) >= ROLE_RANK.manager) allowed.push('managers');
  const sensitive = await checkHomePermission(homeId, userId, 'sensitive.view');
  if (sensitive.readFailed) return { allowed: [], readFailed: true };
  if (sensitive.hasAccess) allowed.push('sensitive');
  return { allowed };
}

function serializeHomeDocument(document) {
  if (document.details?.storage_contract !== 'home_document_v1' || document.file_id !== document.id) return document;
  const { upload_fingerprint, upload_sha256, upload_version, storage_contract, ...details } = document.details;
  return {
    ...document,
    details,
    storage_bucket: null,
    storage_path: null,
    file_version: upload_version || document.id,
    content_url: `/api/homes/${document.home_id}/documents/${document.id}/content`,
  };
}

module.exports = { HOME_DOCUMENT_VISIBILITIES, HOME_DOCUMENT_TYPES, homeDocumentVisibilities, serializeHomeDocument };
