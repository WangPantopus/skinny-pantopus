const supabaseAdmin = require('../config/supabaseAdmin');
const { serializeUserIdentityForViewer } = require('../serializers/identitySerializers');

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

// Tasks name their poster as listings name their seller: a person by their Local Profile (the name, handle and photo
// they show neighbors), a business as the business. Only identity fields are passed on, so a task says no more about
// its poster than before (no bio or counts), and `id` stays the account id the web follows and connects by.
function serializeTaskPoster(creator) {
  if (!creator) return null;
  const { id, username, name, first_name, middle_name, last_name, profile_picture_url, account_type } = creator;
  const account = { id, username, name, first_name, middle_name, last_name, profile_picture_url, account_type };
  if (account_type === 'business') return serializeUserIdentityForViewer(account);
  const { handle, display_name, avatar_url } = creator;
  return serializeUserIdentityForViewer({ ...account, handle, display_name, avatar_url });
}

// The flat poster fields of task list rows, from each row's user_id: the poster as serializeTaskPoster names them,
// read in one batch. A poster whose account can't be read is 'Anonymous', as before.
async function loadTaskPosterFields(rows) {
  const holders = [...new Set((rows || []).map((row) => row?.user_id).filter(Boolean).map(String))]
    .map((userId) => ({ user_id: userId }));
  await hydrateListingCreatorIdentities(holders);
  const fieldsByUserId = new Map(holders.map((holder) => {
    const poster = serializeTaskPoster(holder.creator);
    return [holder.user_id, poster && {
      poster_display_name: poster.displayName,
      poster_username: poster.handle || null,
      poster_profile_picture_url: poster.avatarUrl || null,
    }];
  }));
  return (row) => fieldsByUserId.get(String(row?.user_id)) || {
    poster_display_name: 'Anonymous',
    poster_username: null,
    poster_profile_picture_url: null,
  };
}

// The task RPCs also return each poster's account name, username and photo. Rows are sent without them: a task names
// its poster only as above.
function withoutAccountPoster({ creator_name, creator_username, profile_picture_url, ...row }) {
  return row;
}

module.exports = {
  LISTING_CREATOR_USER_SELECT,
  hydrateListingCreatorIdentities,
  loadTaskPosterFields,
  serializeTaskPoster,
  withoutAccountPoster,
};
