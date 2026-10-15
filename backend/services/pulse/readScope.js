'use strict';

// Narrower conversation audiences (S9, contract §2.13): the author moves a post toward a
// smaller audience, never a wider or a different one. The shared read wall then revokes
// every path for readers outside it at once; replies and follows stay with the post.
const db = require('../../config/supabaseAdmin');
const { homeAreaContext, myAreas, openAreas, AREA_SELECT } = require('./areas');
const { canReadPost, postScopeAccess, POST_READ_SELECT } = require('./readAccess');
const conversation = require('./conversation');
const { UUID } = require('./feedCursor');

const WIDTH = { public: 0, verified_town: 1, verified_area: 2 };
const ERRORS = {
  POST_NOT_FOUND: [404, 'This conversation is not available.'],
  NOT_POST_AUTHOR: [403, 'Only the person who posted can change who can read it.'],
  INVALID_SCOPE: [400, 'Choose who can read this post.'],
  NEEDS_AREA: [400, 'Choose the street or neighborhood.'],
  CANNOT_WIDEN: [409, "Who can read a post can only get narrower. Delete it to start over."],
  NEEDS_VERIFIED_ADDRESS: [403, 'A verified address in this area is needed.'],
  AUDIENCE_NOT_ALLOWED: [403, "Who can read this post can't be changed."],
  POST_CHANGED: [409, 'This conversation changed. Refresh it and try again.'],
};
function refusal(code) {
  const [status, message] = ERRORS[code];
  return Object.assign(new Error(message), { status, code: code === 'NEEDS_AREA' ? 'INVALID_SCOPE' : code });
}
async function checked(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
const townOf = async areaId => (areaId ? checked(db.rpc('pulse_area_town_id', { p_area_id: areaId })) : null);

async function changeTo(post, readScope, areaId) {
  let query = db.from('Post').update({ read_scope: readScope, area_id: areaId, allow_external_share: false })
    .eq('id', post.id).eq('user_id', post.user_id);
  query = post.read_scope == null ? query.is('read_scope', null) : query.eq('read_scope', post.read_scope);
  query = post.area_id == null ? query.is('area_id', null) : query.eq('area_id', post.area_id);
  // Another tap or device changed it a moment ago; the caller refreshes and decides again.
  if (!(await checked(query.select('id'))).length) throw refusal('POST_CHANGED');
}

async function narrow(postId, viewerId, input = {}) {
  const { readScope, areaId } = input;
  if (!Object.hasOwn(WIDTH, readScope) || (areaId != null && (typeof areaId !== 'string' || !UUID.test(areaId)))) {
    throw refusal('INVALID_SCOPE');
  }
  if (!UUID.test(postId)) throw refusal('POST_NOT_FOUND');
  const post = await checked(db.from('Post').select(`${POST_READ_SELECT}, post_as`).eq('id', postId).maybeSingle());
  if (!post) throw refusal('POST_NOT_FOUND');
  const homes = await homeAreaContext(viewerId);
  if (post.user_id !== viewerId) {
    throw refusal(await canReadPost(post, viewerId, await postScopeAccess(viewerId, homes)) ? 'NOT_POST_AUTHOR' : 'POST_NOT_FOUND');
  }
  if (!post.distribution_targets?.includes('place') || post.audience === 'household'
      || ['home', 'persona'].includes(post.identity_context_type) || ['home', 'persona'].includes(post.post_as)) {
    throw refusal('AUDIENCE_NOT_ALLOWED');
  }

  // The post's town: from its area for Pulse rows; for older rows (no scope), only an
  // audience that was public, inside the town of the author's primary home.
  let townId;
  if (post.read_scope == null) {
    if (post.visibility !== 'public' && post.audience !== 'public') throw refusal('AUDIENCE_NOT_ALLOWED');
    townId = (await myAreas(viewerId, homes)).town?.id || null;
  } else {
    if (!Object.hasOwn(WIDTH, post.read_scope)) throw refusal('AUDIENCE_NOT_ALLOWED');
    townId = await townOf(post.area_id);
  }
  if (!townId) throw refusal('AUDIENCE_NOT_ALLOWED');

  const current = post.read_scope ?? 'public';
  if (WIDTH[readScope] < WIDTH[current]) throw refusal('CANNOT_WIDEN');
  const reference = post.area_id
    ? await checked(db.from('PulseArea').select(AREA_SELECT).eq('id', post.area_id).maybeSingle()) : null;

  if (readScope === 'verified_area') {
    const named = ['street', 'neighborhood'].includes(reference?.kind) ? reference.id : null;
    const wanted = areaId || named;
    if (!wanted) throw refusal('NEEDS_AREA');
    if (current === 'verified_area') {
      // The same street again is fine; another one would admit different readers.
      if (wanted !== post.area_id) throw refusal('CANNOT_WIDEN');
    } else {
      const area = await checked(openAreas(db.from('PulseArea').select(AREA_SELECT)).eq('id', wanted).maybeSingle());
      if (!area) throw refusal('NEEDS_VERIFIED_ADDRESS');
      if (!['street', 'neighborhood'].includes(area.kind)) throw refusal('AUDIENCE_NOT_ALLOWED');
      if (await townOf(area.id) !== townId) throw refusal('CANNOT_WIDEN');
      const primaryInside = homes.primary?.verified === true && homes.matches.some(match =>
        match.home_id === homes.primary.id && match.area_id === area.id && match.inside === true);
      if (!primaryInside) throw refusal('NEEDS_VERIFIED_ADDRESS');
      await changeTo(post, readScope, area.id);
    }
  } else if (readScope !== current) {
    // Public → verified neighbors of the town: keep the post's area (its town ancestry is
    // the wall); an older row gets its author's town.
    await changeTo(post, readScope, post.area_id || townId);
  }
  return { post: (await conversation.read(post.id, viewerId)).post };
}

module.exports = { narrow };
