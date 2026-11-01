/**
 * Preview as (PRF CONTRACT.md SRV-1): the owner of a profile reads it the way one audience would see it.
 *   anyone       a signed-out visitor (anyone with the link)
 *   neighbors    a signed-in person who isn't connected to them, doesn't live with them and has no block with them
 *   connections  one of their connections who doesn't live with them
 * The profile reads (routes/users.js) and the person's posts and pinned posts (routes/posts.js) take `?as=<audience>`.
 */

const PREVIEW_AUDIENCES = ['anyone', 'neighbors', 'connections'];

// Stands in for the previewing visitor where a read needs a viewer who isn't the owner (the Local Profile name, how
// precise a post's place is). No account has this id, so nothing is anyone's like, save or repost.
const PREVIEW_VIEWER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * The audience `?as=` asks for. `{ audience: null }` for an ordinary read; `{ refusal: { status, body } }` when the
 * value is unknown or the signed-in viewer isn't `ownerId` (only the owner may preview).
 */
function previewAudience(req, ownerId) {
  const as = req.query?.as;
  if (as === undefined) return { audience: null };
  if (typeof as !== 'string' || !PREVIEW_AUDIENCES.includes(as)) {
    return { refusal: { status: 400, body: {
      error: 'Preview your profile as anyone, neighbors or connections.', code: 'PREVIEW_AUDIENCE_INVALID',
    } } };
  }
  if (!req.user?.id || String(req.user.id) !== String(ownerId)) {
    return { refusal: { status: 403, body: { error: 'Only you can preview your profile.', code: 'PREVIEW_OWNER_ONLY' } } };
  }
  return { audience: as };
}

module.exports = { PREVIEW_AUDIENCES, PREVIEW_VIEWER_ID, previewAudience };
