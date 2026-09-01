const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');

// PersonaMembership.fan_handle is intentionally NOT derived from User.username,
// LocalProfile.handle, or any other personal-side identifier — that is the
// audience-side firewall (Audience Profile design v2 §1, invariant 1, and
// §6.1 serializeFanForCreator). Phase 0 lets fans accept the random handle;
// PR 3's privacy-handshake screen lets them pick another (still not their
// personal username unless they explicitly opt in).
function generateRandomFanHandle() {
  return `fan_${crypto.randomBytes(4).toString('hex')}`;
}

function identityHandleFromUserId(userId) {
  return `fan_${String(userId || '').replace(/-/g, '').slice(0, 32)}`;
}

// PersonaFollow is now a SQL view over PersonaMembership (see migration 132).
// New writes go straight to PersonaMembership; this helper projects the result
// back into the legacy PersonaFollow shape so API responses stay stable until
// PR 1 reshapes the public contract.
function projectMembershipAsLegacyFollow(membership) {
  if (!membership) return null;
  const tierRank = Number(membership.tier?.rank || 0);
  return {
    id: membership.id,
    persona_id: membership.persona_id,
    follower_user_id: membership.user_id,
    relationship_type: tierRank > 1 ? 'subscriber' : membership.relationship_type,
    status: membership.status,
    source: membership.source,
    notification_level: membership.notification_level,
    public_visibility: membership.public_visibility,
    approved_by_user_id: membership.approved_by_user_id,
    approved_at: membership.approved_at,
    created_at: membership.created_at,
    updated_at: membership.updated_at,
  };
}

function normalizeHandle(value) {
  return String(value || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

function normalizeAudienceHandleInput(value) {
  return String(value || '').trim().replace(/^@/, '');
}

function audienceIdentityError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function sanitizeHandle(value, fallback) {
  const raw = String(value || fallback || '')
    .trim()
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return raw || fallback || `profile-${Date.now()}`;
}

function cleanIdentityText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function fullNameFromUserParts(user) {
  const parts = [user?.first_name, user?.middle_name, user?.last_name]
    .map(cleanIdentityText)
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

// Public local identity policy: seed profiles with a readable name first and
// keep username as the handle/fallback.
function displayNameFromUser(user) {
  if (!user) return 'Pantopus member';
  return (
    cleanIdentityText(user.display_name) ||
    cleanIdentityText(user.public_display_name) ||
    cleanIdentityText(user.name) ||
    fullNameFromUserParts(user) ||
    cleanIdentityText(user.first_name) ||
    cleanIdentityText(user.username) ||
    'Pantopus member'
  );
}

async function canExposePublicLocality(userId) {
  if (!userId) return false;
  const { data } = await supabaseAdmin
    .from('UserPrivacySettings')
    .select('show_neighborhood')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.show_neighborhood === 'public';
}

async function getLocalProfileByUserId(userId) {
  const { data } = await supabaseAdmin
    .from('LocalProfile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

async function getLocalProfileByHandle(handle) {
  const normalized = normalizeHandle(handle);
  const { data } = await supabaseAdmin
    .from('LocalProfile')
    .select('*')
    .eq('handle_normalized', normalized)
    .maybeSingle();
  if (data) return data;

  const { data: user } = await supabaseAdmin
    .from('User')
    .select('id, username, name, first_name, middle_name, last_name, profile_picture_url, bio, city, state, verified')
    .eq('username', handle)
    .maybeSingle();
  if (!user) return null;
  const exposeLocality = await canExposePublicLocality(user.id);
  return {
    id: `legacy-local-${user.id}`,
    user_id: user.id,
    handle: user.username,
    handle_normalized: normalizeHandle(user.username),
    display_name: displayNameFromUser(user),
    avatar_url: user.profile_picture_url || null,
    bio: user.bio || null,
    public_city: exposeLocality ? (user.city || null) : null,
    public_state: exposeLocality ? (user.state || null) : null,
    show_neighborhood: exposeLocality,
    verified_resident: !!user.verified,
    user,
  };
}

async function ensureLocalProfile(userId) {
  const existing = await getLocalProfileByUserId(userId);
  if (existing) return existing;

  const { data: user } = await supabaseAdmin
    .from('User')
    .select('id, username, name, first_name, middle_name, last_name, profile_picture_url, bio, city, state, verified')
    .eq('id', userId)
    .maybeSingle();
  if (!user) return null;
  const exposeLocality = await canExposePublicLocality(user.id);

  const baseHandle = sanitizeHandle(user.username, `user-${String(user.id).replace(/-/g, '').slice(0, 12)}`);
  const payload = {
    user_id: userId,
    handle: baseHandle,
    handle_normalized: normalizeHandle(baseHandle),
    display_name: displayNameFromUser(user),
    avatar_url: user.profile_picture_url || null,
    bio: user.bio || null,
    public_city: exposeLocality ? (user.city || null) : null,
    public_state: exposeLocality ? (user.state || null) : null,
    show_neighborhood: exposeLocality,
    verified_resident: !!user.verified,
  };

  const { data: created, error } = await supabaseAdmin
    .from('LocalProfile')
    .insert(payload)
    .select()
    .single();
  if (error) return { id: `legacy-local-${user.id}`, ...payload, user };
  return created;
}

async function getActivePersonaForUser(userId) {
  const { data } = await supabaseAdmin
    .from('PublicPersona')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return data || null;
}

async function getPersonaByHandle(handle) {
  const { data } = await supabaseAdmin
    .from('PublicPersona')
    .select('*')
    .eq('handle_normalized', normalizeHandle(handle))
    .maybeSingle();
  return data || null;
}

async function getPersonaById(id) {
  const { data } = await supabaseAdmin
    .from('PublicPersona')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data || null;
}

async function getPersonaMembershipForUser(personaId, userId) {
  if (!personaId || !userId) return null;
  const { data: membership } = await supabaseAdmin
    .from('PersonaMembership')
    .select('*')
    .eq('persona_id', personaId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return null;

  if (!membership.tier_id) return { ...membership, tier: null };
  const { data: tier } = await supabaseAdmin
    .from('PersonaTier')
    .select('id, rank, name, status')
    .eq('id', membership.tier_id)
    .maybeSingle();
  return { ...membership, tier: tier || null };
}

async function getPersonaFollow(personaId, userId) {
  return projectMembershipAsLegacyFollow(
    await getPersonaMembershipForUser(personaId, userId)
  );
}

// P1.10 — viewer's tier rank on a given persona, used by the broadcast
// read filter (audience-profile §11.3 / §13.4):
//   * 0 → anonymous viewer; sees only public broadcasts.
//   * 1..4 → fan with active or past_due membership; rank comes from
//     PersonaTier.rank linked through PersonaMembership.tier_id.
//   * 4 → owner sees everything (the rank-4 sentinel doubles for "no
//     restriction" since that's the highest tier in the v1 ladder).
//
// past_due is treated as still-readable per audience-profile §7.3 —
// fans retain read access during dunning. Terminal statuses
// (canceled, expired, removed) drop back to 0.
async function getViewerTierRankForPersona(personaId, viewerUserId) {
  if (!viewerUserId || !personaId) return 0;

  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('user_id')
    .eq('id', personaId)
    .maybeSingle();
  if (persona && persona.user_id === viewerUserId) {
    return 4;
  }

  const membership = await getPersonaMembershipForUser(personaId, viewerUserId);
  if (!membership) return 0;
  if (!['active', 'past_due'].includes(membership.status)) return 0;
  // An active membership with no joined tier is a legacy free-follower
  // row (created before migration 136 backfilled tier_id). Treat it as
  // rank 1 so its bearer keeps follower-tier read access.
  const rawRank = membership.tier?.rank ? Number(membership.tier.rank) : 1;
  return Math.max(1, Math.min(4, rawRank));
}

async function getBridgeSetting(userId, personaId) {
  if (!userId || !personaId) return null;
  const { data } = await supabaseAdmin
    .from('IdentityBridgeSetting')
    .select('*')
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .maybeSingle();
  return data || null;
}

async function getAudienceIdentityForUser(userId) {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('AudienceIdentity')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return data || null;
}

async function getAudienceIdentityById(id) {
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from('AudienceIdentity')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data || null;
}

async function getAudienceIdentityUsageCount(identity) {
  if (!identity?.user_id) return 0;
  const { count, error } = await supabaseAdmin
    .from('PersonaMembership')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', identity.user_id)
    .neq('status', 'removed');
  if (error) throw error;
  return Number(count || 0);
}

async function canEditAudienceIdentityForHandshake(identity) {
  if (!identity) return true;
  if (identity.public_persona_id || identity.source === 'persona_bound') return false;
  return await getAudienceIdentityUsageCount(identity) === 0;
}

async function isAudienceIdentityHandleAvailable(handle, userId, excludeIdentityId = null) {
  const normalized = normalizeHandle(handle);
  if (!normalized) return false;

  const { data: identity } = await supabaseAdmin
    .from('AudienceIdentity')
    .select('id, user_id')
    .eq('handle_normalized', normalized)
    .maybeSingle();
  if (identity && identity.id !== excludeIdentityId && identity.user_id !== userId) {
    return false;
  }

  const { data: persona } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, user_id')
    .eq('handle_normalized', normalized)
    .maybeSingle();
  if (persona && persona.user_id !== userId) {
    return false;
  }

  return true;
}

async function generateUniqueAudienceHandle(userId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateRandomFanHandle();
    if (await isAudienceIdentityHandleAvailable(candidate, userId)) {
      return candidate;
    }
  }

  const base = identityHandleFromUserId(userId);
  if (await isAudienceIdentityHandleAvailable(base, userId)) {
    return base;
  }

  for (let suffix = 1; suffix <= 20; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (await isAudienceIdentityHandleAvailable(candidate, userId)) {
      return candidate;
    }
  }

  throw audienceIdentityError('fan_handle_taken', 'Could not generate an available audience identity handle.');
}

function audienceIdentityMembershipPayload(identity) {
  if (!identity) return {};
  return {
    audience_identity_id: identity.id,
    fan_handle: identity.handle,
    fan_handle_normalized: identity.handle_normalized || normalizeHandle(identity.handle),
    fan_display_name: identity.display_name || identity.handle,
    fan_avatar_url: identity.avatar_url || null,
  };
}

function serializeAudienceIdentity(identity) {
  if (!identity) return null;
  return {
    id: identity.id,
    handle: identity.handle,
    displayName: identity.display_name || identity.handle,
    avatarUrl: identity.avatar_url || null,
    publicPersonaId: identity.public_persona_id || null,
    source: identity.source || 'generated',
    status: identity.status || 'active',
  };
}

function isHandleConflictError(error) {
  if (!error) return false;
  if (String(error.code || '') === '23505') return true;
  const text = [error.message, error.details, error.hint, error.constraint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return text.includes('handle') || text.includes('audience identity');
}

async function insertAudienceIdentity(payload) {
  const { data, error } = await supabaseAdmin
    .from('AudienceIdentity')
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (isHandleConflictError(error)) {
      throw audienceIdentityError('fan_handle_taken', 'That audience identity handle is already taken.');
    }
    throw error;
  }
  return data || payload;
}

async function updateUnusedAudienceIdentity(identity, options = {}) {
  const preferredHandle = normalizeAudienceHandleInput(options.preferredHandle);
  if (!identity?.id || !identity?.user_id || !preferredHandle) return identity;

  if (!await canEditAudienceIdentityForHandshake(identity)) {
    return identity;
  }

  if (!await isAudienceIdentityHandleAvailable(preferredHandle, identity.user_id, identity.id)) {
    throw audienceIdentityError('fan_handle_taken', 'That audience identity handle is already taken.');
  }

  const payload = {
    handle: preferredHandle,
    handle_normalized: normalizeHandle(preferredHandle),
    display_name: options.displayName || preferredHandle,
    avatar_url: options.avatarUrl || null,
    source: 'user_selected',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('AudienceIdentity')
    .update(payload)
    .eq('id', identity.id)
    .select()
    .single();
  if (error) {
    if (isHandleConflictError(error)) {
      throw audienceIdentityError('fan_handle_taken', 'That audience identity handle is already taken.');
    }
    throw error;
  }
  return data || { ...identity, ...payload };
}

async function syncAudienceIdentityMembershipSnapshots(identity) {
  if (!identity?.id || !identity?.user_id) return;
  await supabaseAdmin
    .from('PersonaMembership')
    .update({
      ...audienceIdentityMembershipPayload(identity),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', identity.user_id);
}

async function syncAudienceIdentityFromPersona(persona) {
  if (!persona?.user_id || persona.status === 'suspended') return null;
  const payload = {
    user_id: persona.user_id,
    public_persona_id: persona.id,
    handle: persona.handle,
    handle_normalized: persona.handle_normalized || normalizeHandle(persona.handle),
    display_name: persona.display_name || persona.handle,
    avatar_url: persona.avatar_url || null,
    status: 'active',
    source: 'persona_bound',
    updated_at: new Date().toISOString(),
  };

  const existing = await getAudienceIdentityForUser(persona.user_id);
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('AudienceIdentity')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      if (isHandleConflictError(error)) {
        throw audienceIdentityError('fan_handle_taken', 'That Beacon handle is already used as another audience identity.');
      }
      throw error;
    }
    const identity = data || { ...existing, ...payload };
    await syncAudienceIdentityMembershipSnapshots(identity);
    return identity;
  }

  const created = await insertAudienceIdentity(payload);
  await syncAudienceIdentityMembershipSnapshots(created);
  return created;
}

async function getOrCreateAudienceIdentityForUser(userId, options = {}) {
  if (!userId) return null;

  const activePersona = await getActivePersonaForUser(userId);
  if (activePersona) {
    return syncAudienceIdentityFromPersona(activePersona);
  }

  const existing = await getAudienceIdentityForUser(userId);
  if (existing) {
    if (options.allowUnusedIdentityUpdate && options.preferredHandle) {
      return updateUnusedAudienceIdentity(existing, options);
    }
    return existing;
  }

  const preferredHandle = normalizeAudienceHandleInput(options.preferredHandle);
  const handle = preferredHandle || await generateUniqueAudienceHandle(userId);
  if (!await isAudienceIdentityHandleAvailable(handle, userId)) {
    throw audienceIdentityError('fan_handle_taken', 'That audience identity handle is already taken.');
  }

  const payload = {
    user_id: userId,
    public_persona_id: null,
    handle,
    handle_normalized: normalizeHandle(handle),
    display_name: options.displayName || handle,
    avatar_url: options.avatarUrl || null,
    status: 'active',
    source: preferredHandle ? 'user_selected' : 'generated',
  };
  return insertAudienceIdentity(payload);
}

module.exports = {
  normalizeHandle,
  sanitizeHandle,
  displayNameFromUser,
  ensureLocalProfile,
  getLocalProfileByUserId,
  getLocalProfileByHandle,
  getActivePersonaForUser,
  getPersonaByHandle,
  getPersonaById,
  getPersonaMembershipForUser,
  getPersonaFollow,
  getViewerTierRankForPersona,
  getBridgeSetting,
  generateRandomFanHandle,
  generateUniqueAudienceHandle,
  getAudienceIdentityForUser,
  getAudienceIdentityById,
  getAudienceIdentityUsageCount,
  canEditAudienceIdentityForHandshake,
  getOrCreateAudienceIdentityForUser,
  syncAudienceIdentityFromPersona,
  syncAudienceIdentityMembershipSnapshots,
  audienceIdentityMembershipPayload,
  serializeAudienceIdentity,
  projectMembershipAsLegacyFollow,
};
