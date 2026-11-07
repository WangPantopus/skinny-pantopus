/**
 * How people react to a post (POST /api/posts/:id/like, one reaction per person, counted in Post.like_count), the same
 * on web, iPhone and Android and in the author's notice. On an event the reaction is Going ("2 going"). On every other
 * kind it is one of the emoji below, and each emoji's count shows under the post.
 */

const GOING_POST_TYPES = ['event'];
const CELEBRATE_POST_TYPES = ['neighborhood_win', 'progress_wins'];

/**
 * The emoji a post can get, in the order the apps offer them. The apps carry the same list
 * (frontend/packages/ui-utils/src/post-types.ts, iOS PostReactionRequest.swift, Android PostReactionRequest.kt).
 */
const POST_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉'];

/** A mark made before emoji reactions, or by an app that predates them, has no emoji and shows as this one. */
const DEFAULT_POST_REACTION = POST_REACTION_EMOJIS[0];

// U+FE0F only asks for the emoji presentation; "❤" and "❤️" are the same reaction.
const bare = (emoji) => emoji.replace(/️/g, '');
const BY_BARE_FORM = new Map(POST_REACTION_EMOJIS.map((emoji) => [bare(emoji), emoji]));

/** The emoji as stored, or null when it isn't one a post can get. */
function normalizePostReaction(value) {
  if (typeof value !== 'string') return null;
  return BY_BARE_FORM.get(bare(value.trim())) || null;
}

/** A stored reaction as the apps show it: a row without one (an older mark) is 👍. */
function shownReaction(stored) {
  return normalizePostReaction(stored) || DEFAULT_POST_REACTION;
}

/**
 * Rows of { reaction, count } (post_reaction_counts) as [{ reaction, count }]: one entry per emoji with its count, the
 * most used first, ties in the order the apps offer them.
 */
function reactionSummary(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const count = Number(row.count ?? row.reaction_count) || 0;
    if (count <= 0) continue;
    const reaction = shownReaction(row.reaction);
    counts.set(reaction, (counts.get(reaction) || 0) + count);
  }
  return [...counts.entries()]
    .map(([reaction, count]) => ({ reaction, count }))
    .sort((a, b) => b.count - a.count
      || POST_REACTION_EMOJIS.indexOf(a.reaction) - POST_REACTION_EMOJIS.indexOf(b.reaction));
}

/** 'going' for an event, 'emoji' for every other kind (an unknown or missing type takes emoji). */
function postReaction(postType) {
  return GOING_POST_TYPES.includes(postType) ? 'going' : 'emoji';
}

/**
 * The post types whose marks About's "Around the neighborhood" leaves out of its count (Going on an event, and a win's
 * marks, which were Celebrate before emoji reactions).
 */
const NOT_HELPFUL_POST_TYPES = [...GOING_POST_TYPES, ...CELEBRATE_POST_TYPES];

/** What the post's author is told when someone reacts: "Ben reacted ❤️ to your post", "Ben is going to your event". */
function reactionNotice(postType, name, reaction) {
  if (postReaction(postType) === 'going') return { title: `${name} is going to your event`, icon: '📅' };
  const emoji = shownReaction(reaction);
  return { title: `${name} reacted ${emoji} to your post`, icon: emoji };
}

module.exports = {
  POST_REACTION_EMOJIS,
  DEFAULT_POST_REACTION,
  normalizePostReaction,
  shownReaction,
  reactionSummary,
  postReaction,
  reactionNotice,
  NOT_HELPFUL_POST_TYPES,
};
