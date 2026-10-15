'use strict';

// Offer requests (S9, contract §2.8): "I'd like it", the giver's list and the giver's choice.
// The post's read check runs first; the locking functions then recheck its scope, moderation,
// blocks and state, so a stale screen grants nothing.
const db = require('../../config/supabaseAdmin');
const { SAFE_CREATOR_SELECT } = require('../../serializers/identitySerializers');
const conversation = require('./conversation');
const { distanceFormatter } = require('./distanceText');
const { UUID } = require('./feedCursor');
const notices = require('./notices');
const { offerState } = require('./offers');

const ERRORS = {
  POST_NOT_FOUND: [404, 'This conversation is not available.'],
  POST_CHANGED: [409, 'This conversation changed. Refresh it and try again.'],
  NOT_AN_OFFER: [400, 'Only offers take requests.'],
  OWN_OFFER: [400, "You can't ask for your own offer."],
  NOT_POST_AUTHOR: [403, 'Only the person who offered it can see requests and choose.'],
  CLAIM_NOT_FOUND: [404, 'This request is not available.'],
  OFFER_GONE: [409, 'Someone else got this one.', { claim: { id: null, status: 'gone' } }],
  ENOUGH_REQUESTS: [429, 'Enough requests already.', { claim: { id: null, status: 'enough_requests' } }],
  INVALID_NOTE: [400, 'Keep your note to 500 characters.'],
};
function refusal(code) {
  const [status, message, body] = ERRORS[code] || [503, "Couldn't save your request. Please try again."];
  return Object.assign(new Error(message), { status, code, ...(body ? { body } : {}) });
}
const RESOLVED = { state: 'resolved', resolution: 'claimed' };

async function scopeSnapshot(postId, viewerId) {
  if (!UUID.test(postId)) throw refusal('POST_NOT_FOUND');
  return conversation.contextFor(postId, viewerId);
}

async function request(postId, viewerId, input = {}) {
  const note = input.note == null || input.note === '' ? null : input.note;
  if (note != null && (typeof note !== 'string' || note.length > 500)) throw refusal('INVALID_NOTE');
  const { post } = await scopeSnapshot(postId, viewerId);
  if (post.post_type !== 'offer') throw refusal('NOT_AN_OFFER');
  const { data, error } = await db.rpc('pulse_offer_request', {
    p_post_id: post.id, p_user_id: viewerId, p_note: note,
    p_read_scope: post.read_scope, p_area_id: post.area_id,
  });
  if (error) throw error;
  if (data.code) throw refusal(data.code);
  if (data.created) {
    const first = data.status === 'chosen';
    await notices.notify({
      userId: data.giver_id, type: 'offer_request', postId: post.id, actorId: viewerId,
      title: first ? 'Your offer was claimed' : 'Someone asked for your offer',
      body: first ? 'A neighbor was first to ask. Message them to arrange pickup.'
        : 'A neighbor would like it. Choose who gets it.',
      metadata: { claim_id: data.claim_id }, key: `offer_request:${data.claim_id}`,
    });
  }
  return { claim: { id: data.claim_id, status: data.status },
    ...(data.status === 'chosen' ? { post_status: RESOLVED } : {}) };
}

async function list(postId, viewerId) {
  const context = await scopeSnapshot(postId, viewerId);
  const { post, blocked, homes } = context;
  if (post.user_id !== viewerId) throw refusal('NOT_POST_AUTHOR');
  if (post.post_type !== 'offer') throw refusal('NOT_AN_OFFER');
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('OfferClaim')
      .select(`id, claimer_id, status, note, created_at, author:claimer_id (${SAFE_CREATOR_SELECT})`)
      .eq('post_id', post.id).order('created_at').order('id').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  // Blocked people are left out and can't be chosen; the giver's own row can't exist.
  const visible = rows.filter(row => !blocked.has(row.claimer_id));
  const people = visible.map(row => ({ user_id: row.claimer_id, author: row.author }));
  const { authorFor } = await conversation.authorProjector(context, people,
    await distanceFormatter(viewerId, { homes }));
  return {
    claims: await Promise.all(visible.map(async row => ({ id: row.id, status: row.status,
      note: row.note, created_at: row.created_at, author: await authorFor({ user_id: row.claimer_id, author: row.author }) }))),
    offer: offerState(post, rows, viewerId),
  };
}

async function choose(postId, claimId, viewerId) {
  if (!UUID.test(claimId)) throw refusal('CLAIM_NOT_FOUND');
  const { post } = await scopeSnapshot(postId, viewerId);
  if (post.user_id !== viewerId) throw refusal('NOT_POST_AUTHOR');
  const { data, error } = await db.rpc('pulse_offer_choose', {
    p_post_id: post.id, p_claim_id: claimId, p_user_id: viewerId,
    p_read_scope: post.read_scope, p_area_id: post.area_id,
  });
  if (error) throw error;
  if (data.code) throw refusal(data.code);
  if (data.created) {
    await notices.notify({
      userId: data.claimer_id, type: 'offer_chosen', postId: post.id, actorId: viewerId,
      title: "It's yours", body: 'The neighbor chose you for their offer. Message them to arrange pickup.',
      metadata: { claim_id: data.claim_id }, key: `offer_chosen:${data.claim_id}`,
    });
    for (const other of data.gone || []) {
      await notices.notify({
        userId: other.claimer_id, type: 'offer_gone', postId: post.id, actorId: viewerId,
        title: 'This offer is gone', body: 'Someone else got this one.',
        metadata: { claim_id: other.claim_id }, key: `offer_gone:${other.claim_id}`,
      });
    }
  }
  return { claim: { id: data.claim_id, status: 'chosen' }, post_status: RESOLVED };
}

module.exports = { request, list, choose };
