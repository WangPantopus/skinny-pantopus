const supabaseAdmin = require('../config/supabaseAdmin');

const LISTING_CREATOR_USER_SELECT = [
  'id',
  'username',
  'name',
  'first_name',
  'middle_name',
  'last_name',
  'profile_picture_url',
  'account_type',
  'verified',
  'bio',
  'review_count',
  'gigs_completed',
].join(', ');

const LISTING_CREATOR_LOCAL_PROFILE_SELECT = [
  'id',
  'user_id',
  'handle',
  'display_name',
  'avatar_url',
].join(', ');

function cleanIdentityText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function sameDisplayValue(a, b) {
  const left = cleanIdentityText(a);
  const right = cleanIdentityText(b);
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

function hasCustomLocalDisplayName(profile, user) {
  const displayName = cleanIdentityText(profile?.display_name);
  if (!displayName) return false;
  return !sameDisplayValue(displayName, profile?.handle)
    && !sameDisplayValue(displayName, user?.username);
}

async function hydrateListingCreatorIdentities(input) {
  const rows = Array.isArray(input) ? input.filter(Boolean) : (input ? [input] : []);
  const userIds = [...new Set(rows
    .map((row) => row.user_id || row.creator?.id)
    .filter(Boolean)
    .map(String))];

  if (userIds.length === 0) return input;

  const [userResult, localProfileResult] = await Promise.all([
    supabaseAdmin
      .from('User')
      .select(LISTING_CREATOR_USER_SELECT)
      .in('id', userIds),
    supabaseAdmin
      .from('LocalProfile')
      .select(LISTING_CREATOR_LOCAL_PROFILE_SELECT)
      .in('user_id', userIds),
  ]);

  const usersById = new Map((userResult.data || []).map((user) => [String(user.id), user]));
  const profilesByUserId = new Map((localProfileResult.data || []).map((profile) => [String(profile.user_id), profile]));

  for (const row of rows) {
    const userId = row.user_id || row.creator?.id;
    const user = usersById.get(String(userId || ''));
    if (!user) continue;

    const profile = profilesByUserId.get(String(user.id));
    const creator = {
      ...(row.creator || {}),
      ...user,
    };

    if (profile) {
      creator.local_profile_id = profile.id;
      creator.handle = profile.handle || creator.username;
      creator.avatar_url = profile.avatar_url || creator.profile_picture_url || null;
      if (hasCustomLocalDisplayName(profile, user)) {
        creator.display_name = profile.display_name;
      } else {
        delete creator.display_name;
      }
    }

    row.creator = creator;
  }

  return input;
}

module.exports = {
  LISTING_CREATOR_USER_SELECT,
  hydrateListingCreatorIdentities,
};
