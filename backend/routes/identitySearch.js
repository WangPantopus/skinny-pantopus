const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { isPersonaEnabled, requireIdentityFirewallEnabled } = require('../utils/featureFlags');
const {
  getActivePersonaForUser,
  getBridgeSetting,
  getPersonaFollow,
  getLocalProfileByUserId,
} = require('../utils/identityProfiles');
const {
  serializeAudienceProfileForViewer,
  serializeLocalProfileForViewer,
} = require('../serializers/identitySerializers');
const {
  isConnected,
  isSearchable,
  isScopedBlocked,
} = require('../utils/visibilityPolicy');

router.use(requireIdentityFirewallEnabled);

const identitySearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many profile search requests. Please try again shortly.' },
});

const PROFILE_SEARCH_SCOPES = new Set(['all', 'local_profiles', 'public_profiles']);
const MAX_QUERY_LENGTH = 80;
const LOCAL_BASE_SEARCH_FIELDS = [
  'handle',
  'handle_normalized',
  'display_name',
  'tagline',
];
const LOCAL_SEARCH_FIELDS = [
  ...LOCAL_BASE_SEARCH_FIELDS,
  'public_city',
  'public_state',
  'public_neighborhood',
];
const PERSONA_SEARCH_FIELDS = [
  'handle',
  'handle_normalized',
  'display_name',
  'bio',
  'category',
  'audience_label',
];
const USER_NAME_SEARCH_FIELDS = [
  'name',
  'first_name',
  'middle_name',
  'last_name',
];
const USER_NAME_SEARCH_SELECT = [
  'id',
  ...USER_NAME_SEARCH_FIELDS,
].join(', ');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function tokenize(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean).slice(0, 6);
}

function ilikePattern(value) {
  const escaped = String(value || '').trim().replace(/[\\%_]/g, (match) => `\\${match}`);
  return `%${escaped}%`;
}

function uniqueById(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows || []) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    result.push(row);
  }
  return result;
}

async function searchTableFields({ table, fields, patterns, eq = {}, limit = 80 }) {
  const queries = [];
  for (const pattern of patterns) {
    for (const field of fields) {
      let query = supabaseAdmin.from(table).select('*').ilike(field, ilikePattern(pattern));
      for (const [key, value] of Object.entries(eq)) {
        query = query.eq(key, value);
      }
      queries.push(query.limit(limit));
    }
  }

  const settled = await Promise.allSettled(queries);
  const rows = [];
  for (const item of settled) {
    if (item.status !== 'fulfilled') continue;
    if (item.value?.error) {
      logger.warn('identity.search.field_query_error', { table, error: item.value.error.message });
      continue;
    }
    rows.push(...(item.value?.data || []));
  }
  return uniqueById(rows);
}

function searchableText(row, fields) {
  return fields.map((field) => row?.[field]).filter(Boolean).join(' ').toLowerCase();
}

function searchableUserNameText(user) {
  return USER_NAME_SEARCH_FIELDS.map((field) => user?.[field]).filter(Boolean).join(' ').toLowerCase();
}

function matchesTokens(row, fields, tokens) {
  const text = searchableText(row, fields);
  return tokens.every((token) => text.includes(token));
}

function scoreRow(row, fields, normalizedQuery, tokens) {
  const handle = normalizeText(row.handle_normalized || row.handle);
  const displayName = normalizeText(row.display_name);
  const joined = searchableText(row, fields);
  let score = 50;

  if (handle === normalizedQuery || displayName === normalizedQuery) score = 0;
  else if (handle.startsWith(normalizedQuery) || displayName.startsWith(normalizedQuery)) score = 5;
  else if (joined.includes(normalizedQuery)) score = 10;
  else if (tokens.every((token) => joined.includes(token))) score = 20;

  return score;
}

function getLocalProfileSearchFields(profile) {
  const fields = [...LOCAL_BASE_SEARCH_FIELDS];
  if (profile?.show_neighborhood !== false) {
    fields.push('public_city', 'public_state');
  }
  if (profile?.show_neighborhood === true) {
    fields.push('public_neighborhood');
  }
  return fields;
}

function getLocalProfileCandidateSearchFields(profile) {
  const fields = getLocalProfileSearchFields(profile);
  if (profile?.__name_search_text) fields.push('__name_search_text');
  return fields;
}

async function searchNameDiscoverableLocalProfiles({ patterns, tokens, viewerId }) {
  const queries = [];
  for (const pattern of patterns) {
    for (const field of USER_NAME_SEARCH_FIELDS) {
      queries.push(
        supabaseAdmin
          .from('User')
          .select(USER_NAME_SEARCH_SELECT)
          .ilike(field, ilikePattern(pattern))
          .neq('id', viewerId)
          .limit(80),
      );
    }
  }

  const settled = await Promise.allSettled(queries);
  const userCandidates = [];
  for (const item of settled) {
    if (item.status !== 'fulfilled') continue;
    if (item.value?.error) {
      logger.warn('identity.search.name_query_error', { error: item.value.error.message });
      continue;
    }
    userCandidates.push(...(item.value?.data || []));
  }

  const nameMatchedUsers = uniqueById(userCandidates)
    .filter((user) => user?.id)
    .map((user) => ({ user, nameSearchText: searchableUserNameText(user) }))
    .filter(({ nameSearchText }) => tokens.every((token) => nameSearchText.includes(token)));

  if (!nameMatchedUsers.length) return [];

  const matchedUserIds = [...new Set(nameMatchedUsers.map(({ user }) => user.id))];
  const { data: privacyRows, error: privacyError } = await supabaseAdmin
    .from('UserPrivacySettings')
    .select('user_id, findable_by_name')
    .in('user_id', matchedUserIds)
    .eq('findable_by_name', true);

  if (privacyError) {
    logger.warn('identity.search.name_privacy_query_error', { error: privacyError.message });
    return [];
  }

  const findableUserIds = new Set((privacyRows || []).map((row) => row.user_id));
  const userById = new Map(
    nameMatchedUsers
      .filter(({ user }) => findableUserIds.has(user.id))
      .map(({ user, nameSearchText }) => [user.id, { user, nameSearchText }]),
  );
  if (!userById.size) return [];

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('LocalProfile')
    .select('*')
    .in('user_id', [...userById.keys()])
    .limit(80);

  if (profileError) {
    logger.warn('identity.search.name_local_profile_query_error', { error: profileError.message });
    return [];
  }

  return (profiles || [])
    .map((profile) => {
      const match = userById.get(profile.user_id);
      if (!match) return null;
      return {
        ...profile,
        __name_search_text: match.nameSearchText,
      };
    })
    .filter(Boolean);
}

async function getPersonaFollowState(personaId, viewerId) {
  if (!personaId || !viewerId) return null;
  return getPersonaFollow(personaId, viewerId);
}

async function canDiscoverLocalProfile(profile, viewerId) {
  if (!profile?.user_id || profile.user_id === viewerId) return false;
  if (profile.deleted_at || profile.archived_at) return false;
  if (profile.status && profile.status !== 'active') return false;
  if (!(await isSearchable(viewerId, profile.user_id))) return false;
  if (await isScopedBlocked(viewerId, profile.user_id, 'search_only')) return false;

  const searchVisibility = profile.search_visibility || 'everyone';
  if (searchVisibility === 'nobody') return false;
  if (searchVisibility === 'mutuals' && !(await isConnected(viewerId, profile.user_id))) {
    return false;
  }

  const profileVisibility = profile.profile_visibility || 'public';
  if (profileVisibility === 'private') return false;
  if (profileVisibility === 'connections' && !(await isConnected(viewerId, profile.user_id))) {
    return false;
  }
  // Legacy 'followers' value is treated as 'connections' after peer-follow removal.
  if (profileVisibility === 'followers' && !(await isConnected(viewerId, profile.user_id))) {
    return false;
  }

  return true;
}

async function canDiscoverPersona(persona, viewerId, followState = null) {
  if (!persona?.user_id || persona.user_id === viewerId) return false;
  if (persona.status !== 'active') return false;
  if (persona.deleted_at || persona.archived_at || persona.suspended_at) return false;
  if (persona.is_searchable === false) return false;
  if (['direct_link', 'nobody'].includes(persona.search_visibility)) return false;
  if (await isScopedBlocked(viewerId, persona.user_id, 'search_only')) return false;
  if ((followState || await getPersonaFollowState(persona.id, viewerId))?.status === 'blocked') return false;
  return true;
}

async function buildLinkedPublicProfile(localProfile) {
  if (!isPersonaEnabled()) return null;
  const persona = await getActivePersonaForUser(localProfile.user_id);
  if (!persona || persona.status !== 'active') return null;
  const bridge = await getBridgeSetting(localProfile.user_id, persona.id);
  if (!bridge?.show_persona_on_local) return null;
  const serialized = serializeAudienceProfileForViewer(persona);
  return serialized
    ? {
        type: 'public_profile',
        title: serialized.displayName,
        href: serialized.href,
      }
    : null;
}

async function buildLinkedLocalProfile(persona) {
  const bridge = await getBridgeSetting(persona.user_id, persona.id);
  if (!bridge?.show_local_on_persona) return null;
  const local = await getLocalProfileByUserId(persona.user_id);
  if (!local) return null;
  const serialized = serializeLocalProfileForViewer(local);
  return serialized
    ? {
        type: 'local_profile',
        title: serialized.displayName,
        href: serialized.href,
      }
    : null;
}

async function localProfileResult(profile) {
  const serialized = serializeLocalProfileForViewer(profile);
  if (!serialized?.id || !serialized?.href) return null;
  const locality = serialized?.locality || {};
  return {
    id: serialized.id,
    type: 'local_profile',
    title: serialized.displayName,
    subtitle: serialized.handle ? `/${serialized.handle}` : null,
    meta: [locality.city, locality.state].filter(Boolean).join(', ') || null,
    imageUrl: serialized.avatarUrl || null,
    href: serialized.href || `/${serialized.handle}`,
    badges: serialized.badges || [],
    action: { kind: 'open', label: 'Open' },
    linkedProfile: await buildLinkedPublicProfile(profile),
  };
}

async function publicProfileResult(persona, followState) {
  const serialized = serializeAudienceProfileForViewer(persona, {
    isFollowing: followState?.status === 'active',
    relationshipType: followState?.relationship_type || null,
    notificationLevel: followState?.notification_level || 'none',
    followStatus: followState?.status || 'none',
  });
  if (!serialized?.id || !serialized?.href) return null;
  const count = Number(serialized.followerCount || 0);
  const audienceLabel = serialized.audienceLabel || 'followers';
  const label = followState?.status === 'active'
    ? 'Following'
    : followState?.status === 'pending'
      ? 'Requested'
      : persona.audience_mode === 'approval_required'
        ? 'Request follow'
        : persona.audience_mode === 'invite_only'
          ? 'Open'
          : 'Follow';

  return {
    id: serialized.id,
    type: 'public_profile',
    title: serialized.displayName,
    subtitle: serialized.handle ? `@${serialized.handle}` : null,
    meta: `${count.toLocaleString()} ${audienceLabel}`,
    imageUrl: serialized.avatarUrl || null,
    href: serialized.href || `/@${serialized.handle}`,
    badges: serialized.credential?.status === 'verified' ? ['verified'] : [],
    action: { kind: 'follow_public_profile', label, state: followState?.status || 'none' },
    linkedProfile: await buildLinkedLocalProfile(persona),
  };
}

function sortResults(results) {
  return results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.title.localeCompare(b.title);
  });
}

router.get('/search', verifyToken, identitySearchLimiter, async (req, res) => {
  try {
    const queryText = String(req.query.q || '').trim().slice(0, MAX_QUERY_LENGTH);
    const scope = String(req.query.scope || 'all');
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
    if (queryText.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    if (!PROFILE_SEARCH_SCOPES.has(scope)) {
      return res.status(400).json({ error: 'scope must be one of: all, local_profiles, public_profiles' });
    }

    const viewerId = req.user.id;
    const tokens = tokenize(queryText);
    const normalizedQuery = normalizeText(queryText);
    const patterns = Array.from(new Set([queryText, tokens[0]].filter(Boolean)));
    const results = [];

    if (scope === 'all' || scope === 'local_profiles') {
      const localCandidates = await searchTableFields({
        table: 'LocalProfile',
        fields: LOCAL_SEARCH_FIELDS,
        patterns,
      });
      const localCandidateById = new Map(localCandidates.map((profile) => [profile.id, profile]));
      const nameCandidates = await searchNameDiscoverableLocalProfiles({ patterns, tokens, viewerId });
      for (const profile of nameCandidates) {
        const existing = localCandidateById.get(profile.id);
        if (existing) {
          existing.__name_search_text = profile.__name_search_text;
        } else {
          localCandidateById.set(profile.id, profile);
        }
      }

      for (const profile of localCandidateById.values()) {
        const localSearchFields = getLocalProfileCandidateSearchFields(profile);
        if (!matchesTokens(profile, localSearchFields, tokens)) continue;
        if (!(await canDiscoverLocalProfile(profile, viewerId))) continue;
        const result = await localProfileResult(profile);
        if (!result) continue;
        results.push({
          ...result,
          score: scoreRow(profile, localSearchFields, normalizedQuery, tokens),
        });
      }
    }

    if ((scope === 'all' || scope === 'public_profiles') && isPersonaEnabled()) {
      const personaCandidates = await searchTableFields({
        table: 'PublicPersona',
        fields: PERSONA_SEARCH_FIELDS,
        patterns,
        eq: { status: 'active' },
      });
      for (const persona of personaCandidates) {
        if (!matchesTokens(persona, PERSONA_SEARCH_FIELDS, tokens)) continue;
        const followState = await getPersonaFollowState(persona.id, viewerId);
        if (!(await canDiscoverPersona(persona, viewerId, followState))) continue;
        const result = await publicProfileResult(persona, followState);
        if (!result) continue;
        results.push({
          ...result,
          score: scoreRow(persona, PERSONA_SEARCH_FIELDS, normalizedQuery, tokens)
            - Math.min(10, Math.floor(Number(persona.follower_count || 0) / 1000)),
        });
      }
    }

    const sorted = sortResults(results)
      .slice(0, limit)
      .map(({ score: _score, ...result }) => result);

    res.json({
      results: sorted,
      counts: sorted.reduce((acc, result) => {
        const key = result.type === 'local_profile'
          ? 'local_profiles'
          : result.type === 'public_profile'
            ? 'public_profiles'
            : result.type;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, { local_profiles: 0, public_profiles: 0 }),
    });
  } catch (err) {
    logger.error('identity.search.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
