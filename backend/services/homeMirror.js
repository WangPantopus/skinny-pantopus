'use strict';
// ============================================================
// HOME MIRROR — "what a neighbor sees of my home", from the real code path.
//
// Loads the same rows the public-profile route loads and projects them
// with reveal=false through serializers/homeProfileSerializer, so the
// mirror shows exactly the outsider view and cannot drift from it.
// Members only: checkHomePermission decides who may ask.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const { checkHomePermission } = require('../utils/homePermissions');
const { serializeHomeForViewer, serializeOwnerForViewer, HIDDEN_FROM_OUTSIDERS } = require('../serializers/homeProfileSerializer');

const VIEWER_LABEL = 'A neighbor who is not in your household';

async function loadHomeMirror({ homeId, userId }) {
  const perm = await checkHomePermission(homeId, userId);
  if (!perm || !perm.hasAccess) return null;

  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('id, name, address, city, state, zipcode, home_type, visibility, owner_id, description, created_at')
    .eq('id', homeId)
    .maybeSingle();
  if (!home) return null;

  const { data: verifiedOwnerRows } = await supabaseAdmin
    .from('HomeOwner')
    .select('subject_id, is_primary_owner')
    .eq('home_id', homeId)
    .eq('subject_type', 'user')
    .eq('owner_status', 'verified');
  const sorted = [...(verifiedOwnerRows || [])].sort((a, b) => Number(!!b.is_primary_owner) - Number(!!a.is_primary_owner));
  const ownerId = sorted[0]?.subject_id || home.owner_id || null;
  const { data: ownerUser } = ownerId
    ? await supabaseAdmin.from('User').select('id, username, name, first_name, last_name, profile_picture_url').eq('id', ownerId).maybeSingle()
    : { data: null };

  return {
    surface: 'home',
    viewer: 'neighbor',
    viewer_label: VIEWER_LABEL,
    discoverable: home.visibility === 'public_preview',
    home: serializeHomeForViewer(home, { reveal: false }),
    owner: serializeOwnerForViewer(ownerUser, { reveal: false }),
    hidden: HIDDEN_FROM_OUTSIDERS,
  };
}

module.exports = { loadHomeMirror, VIEWER_LABEL };
