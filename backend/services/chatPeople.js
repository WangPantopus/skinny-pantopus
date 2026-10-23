/**
 * How a chat names the people in it: who wrote each message, who reacted, who is in the room.
 *
 * They go by the name the chat list gives them (routes/chats.js loadLocalIdentityMapForUsers): a
 * person by their Local Profile's name, handle and photo, the way neighbors see them on posts, tasks
 * and listings; a business, or anyone without a Local Profile, by the account as before. Only those
 * three change: `id` stays the account id the apps tell their own messages and profile links by, and
 * nothing else about the person (bio, locality, badges, counts) is added.
 *
 * Shared by routes/chats.js and socket/chatSocketio.js so the REST routes and the socket name people
 * the same way. Post comments (routes/posts.js) name their writers with it too, post and connection notices
 * (routes/posts.js, routes/relationships.js) the person who acted, and the Connections lists (routes/relationships.js)
 * and follower lists (routes/users.js, listedPerson below) the people in them.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { chosenUsernameOrNull } = require('../utils/personalUsername');
const {
  serializeLocalProfileForViewer,
  serializeUserAsLocalIdentity,
} = require('../serializers/identitySerializers');

// The people loadChatPeople named by their Local Profile; the rest go by the account (see reviewerRow).
const localProfilePeople = new WeakSet();

/**
 * The people with these account ids, by id, each as a local identity. People it can't read are
 * left out (a read error leaves them all out), and callers name them as before.
 *
 * @param {string[]} userIds
 * @returns {Promise<Map<string, object>>} user id → identity
 */
async function loadChatPeople(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  try {
    const [users, profiles] = await Promise.all([
      supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, middle_name, last_name, profile_picture_url, account_type')
        .in('id', ids),
      supabaseAdmin
        .from('LocalProfile')
        .select('user_id, handle, display_name, avatar_url')
        .in('user_id', ids),
    ]);
    if (users.error || profiles.error) throw users.error || profiles.error;
    const profilesByUserId = new Map((profiles.data || []).map((profile) => [String(profile.user_id), profile]));
    const people = new Map();
    for (const user of users.data || []) {
      const profile = user.account_type === 'business' ? null : profilesByUserId.get(String(user.id));
      const person = profile
        ? serializeLocalProfileForViewer({
          id: user.id,
          user_id: user.id,
          handle: profile.handle,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          user,
        })
        : serializeUserAsLocalIdentity(user);
      if (profile) localProfilePeople.add(person);
      people.set(String(user.id), person);
    }
    return people;
  } catch (error) {
    logger.warn('chat.people_lookup_error', { error: error.message });
    return new Map();
  }
}

/** A person as a raw row (id, username, name, profile_picture_url), named the same way. */
function chatPersonRow(user, people) {
  const person = user?.id ? people.get(String(user.id)) : null;
  if (!person) return user;
  return { ...user, username: person.handle || null, name: person.displayName, profile_picture_url: person.avatarUrl || null };
}

/**
 * A review's writer as the account row a review list reads (id, username, name, first_name, last_name,
 * profile_picture_url), named the same way: someone with a Local Profile gets its handle, name and photo and no first
 * or last name, which belong to the private account. A business, anyone without a Local Profile and anyone `people`
 * lacks keep the row as it is. `id` stays the account id.
 */
function reviewerRow(user, people) {
  const person = user?.id ? people.get(String(user.id)) : null;
  if (!person || !localProfilePeople.has(person)) return user;
  return {
    ...user,
    username: person.handle || null,
    name: person.displayName,
    first_name: null,
    last_name: null,
    profile_picture_url: person.avatarUrl || null,
  };
}

/**
 * The area each of these people's Local Profiles shows, by account id: its public city and state while their
 * Neighborhood setting shows them to everyone, otherwise none (the rule the Connections lists, the Local Profile overlay
 * on profiles and user search follow). Businesses go by the account and get no entry. Throws on a failed read, so a
 * list fails rather than show what a Local Profile hides.
 */
async function loadLocalProfileAreas(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from('LocalProfile')
    .select('user_id, public_city, public_state, show_neighborhood, owner:user_id (account_type)')
    .in('user_id', ids);
  if (error) throw new Error(error.message);
  return new Map((data || [])
    .filter((profile) => profile.owner?.account_type !== 'business')
    .map((profile) => {
      const shown = profile.show_neighborhood === true;
      return [String(profile.user_id), {
        city: shown ? (profile.public_city || null) : null,
        state: shown ? (profile.public_state || null) : null,
      }];
    }));
}

/** What a list of people needs to show them as neighbors see them: their names and their Local Profiles' areas. */
async function loadListedPeople(userIds) {
  const [people, areas] = await Promise.all([loadChatPeople(userIds), loadLocalProfileAreas(userIds)]);
  return { people, areas };
}

/**
 * A person in a list of people (an account row with id, username, name, first_name, last_name, profile_picture_url,
 * city, state), as neighbors see them. Someone with a Local Profile goes by it: its name, handle and photo, only the
 * area it shows, and no first or last name, which belong to the private account. A business, or anyone without one,
 * goes by the account. Only a username the person chose is kept (a made-up one can show part of an email address).
 * Anyone `listed` lacks keeps the account row. `id` stays the account id.
 */
function listedPerson(user, { people, areas }) {
  const named = chatPersonRow(user, people);
  const row = named ? { ...named, username: chosenUsernameOrNull(named.username) } : named;
  const area = row?.id ? areas.get(String(row.id)) : null;
  return area ? { ...row, first_name: null, last_name: null, city: area.city, state: area.state } : row;
}

module.exports = {
  loadChatPeople,
  chatPersonRow,
  reviewerRow,
  loadListedPeople,
  listedPerson,
};
