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
 * the people in them.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const {
  serializeLocalProfileForViewer,
  serializeUserAsLocalIdentity,
} = require('../serializers/identitySerializers');

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
      people.set(String(user.id), profile
        ? serializeLocalProfileForViewer({
          id: user.id,
          user_id: user.id,
          handle: profile.handle,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          user,
        })
        : serializeUserAsLocalIdentity(user));
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

module.exports = {
  loadChatPeople,
  chatPersonRow,
};
