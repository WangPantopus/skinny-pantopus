/**
 * A post's one reaction (POST /api/posts/:id/like, counted in Post.like_count), named for what it means on that kind
 * of post, the same on web, iPhone and Android: Going on an event, Celebrate on a win, Helpful on every other kind.
 */

const GOING_POST_TYPES = ['event'];
const CELEBRATE_POST_TYPES = ['neighborhood_win', 'progress_wins'];

/** 'going', 'celebrate' or 'helpful' for a post type (an unknown or missing type is 'helpful'). */
function postReaction(postType) {
  if (GOING_POST_TYPES.includes(postType)) return 'going';
  if (CELEBRATE_POST_TYPES.includes(postType)) return 'celebrate';
  return 'helpful';
}

/** The post types whose reaction isn't Helpful (About's "marked … helpful" leaves them out). */
const NOT_HELPFUL_POST_TYPES = [...GOING_POST_TYPES, ...CELEBRATE_POST_TYPES];

/** What the post's author is told when someone reacts: "Ben found your post helpful". */
function reactionNotice(postType, name) {
  switch (postReaction(postType)) {
    case 'going': return { title: `${name} is going to your event`, icon: '📅' };
    case 'celebrate': return { title: `${name} celebrated your win`, icon: '🎉' };
    default: return { title: `${name} found your post helpful`, icon: '💡' };
  }
}

module.exports = { postReaction, reactionNotice, NOT_HELPFUL_POST_TYPES };
