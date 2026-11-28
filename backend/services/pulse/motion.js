'use strict';

// Pulse, reinvented, phase 5: a Live Photo's motion on a Moment (coord CONTRACT 10b, PHASE-5 piece C). The motion clip of
// a Live Photo (Android: a motion photo) is kept beside the Moment's photo: stored in the same private bucket, in the
// Moment's own folder (so the 7-day cleanup, Delete, Delete for good and a deleted account remove it with the photo, and
// a kept Moment keeps it), and handed out as the same short signed link, only while the photo's link is, and to nobody
// but its author until the clip's own frames have passed the picture check (a clip can show what its still does not).
// Its sound is kept as it came; the new viewers play it silently once and with sound on press and hold. A switched-off
// reader and the 2.1.6 apps never get it: the still.

const media = require('../moments/momentMedia');
const penName = require('../penName');
const { cleanUploadedPhoto, MediaNotCleanedError } = require('../photoMetadata');
const { removeVideoMetadata, UnreadableVideoError } = require('../videoMetadata');
const logger = require('../../utils/logger');

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_MS = 4000;
const TOLERANCE_MS = 250;
const TYPES = { 'video/quicktime': 'mov', 'video/mp4': 'mp4' };

// Required when used: momentStore requires this file for its answers.
// eslint-disable-next-line global-require
const momentStore = () => require('../moments/momentStore');

function invalid(message) {
  return momentStore().fail(400, 'MOTION_INVALID', message);
}

/** The clip's own pictures, checked as a video's frames are; refuses one the check flags (or can't check under a made-up name). */
async function checkFrames(row, frameFiles, store) {
  const frames = (frameFiles || []).slice(0, 2);
  if (!frames.length) throw invalid('Send one or two JPEG frames from the motion clip as "frames[]", as for a video.');
  const pictures = [];
  for (const frame of frames) {
    if (frame.size > media.MAX_STILL_BYTES) throw store.fail(413, 'MEDIA_TOO_LARGE', 'This picture is too large.');
    try {
      await cleanUploadedPhoto(frame);
    } catch (error) {
      if (error instanceof MediaNotCleanedError) throw store.fail(error.status, error.code, error.message);
      throw error;
    }
    if (frame.mimetype !== 'image/jpeg') throw invalid('The motion clip\'s frames are JPEG pictures.');
    pictures.push(await media.checkImage(frame.buffer));
  }
  // Required when used: momentCheck requires momentStore, which requires this file.
  // eslint-disable-next-line global-require
  const result = await require('../moments/momentCheck').checkPictures(pictures, { madeUpName: penName.isPenNameRow(row) });
  if (result.status === 'flagged' || (result.status === 'unchecked' && penName.isPenNameRow(row))) {
    throw store.fail(422, 'MOTION_REFUSED', "This motion can't be shown with the photo.");
  }
  return result.status;
}

/**
 * POST /moments/:id/motion — the motion clip of the author's own photo Moment (CONTRACT 10b), after its photo is up,
 * with one or two frames from it (checked as a video's are). The clip's metadata (its place, the phone's name) is taken
 * off before it is stored. The same file again answers as a success; a different clip once one is there is 409.
 */
async function upload(id, user, { file = null, frames = [] } = {}) {
  const store = momentStore();
  const row = await store.ownMoment(id, user.id);
  if (!row) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  if (store.momentState(row) === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
  const m = store.meta(row);
  if (m.kind !== 'photo') throw invalid('A Live Photo\'s motion goes with a photo.');
  if (!m.media?.key) throw invalid('Post the photo first.');
  if (!file?.buffer?.length) throw invalid('Send the motion clip as "file".');
  const type = String(file.mimetype || '').toLowerCase().split(';')[0];
  if (!TYPES[type]) throw invalid('Send the motion clip as a QuickTime or MP4 video.');
  if (file.buffer.length > MAX_BYTES) throw store.fail(413, 'MEDIA_TOO_LARGE', 'This motion clip is too large to post.');
  let durationMs;
  try {
    ({ durationMs } = media.videoFacts(file.buffer));
  } catch {
    throw invalid('This motion clip could not be read.');
  }
  if (!(durationMs > 0) || durationMs > MAX_MS + TOLERANCE_MS) throw invalid('A Live Photo\'s motion can be up to four seconds.');
  const digest = media.sha256(file.buffer);
  if (m.motion?.key) {
    if (m.motion.upload_sha256 === digest) return row;
    throw store.fail(409, 'MOTION_EXISTS', 'This Moment already has its motion. Take it off first.');
  }
  const checked = await checkFrames(row, frames, store);
  try {
    await removeVideoMetadata(file.buffer);
  } catch (error) {
    if (error instanceof UnreadableVideoError) throw invalid('This motion clip could not be read.');
    throw error;
  }
  const bucket = await media.privateBucket(m.media?.bucket);
  const key = media.keyFor(media.folderOwner(row), row.id, 'motion', digest, TYPES[type]);
  await media.put(bucket, key, file.buffer, type);
  const stored = { key, bucket, content_type: type, duration_ms: durationMs, upload_sha256: digest, check: checked };
  // Written against the Moment as it is then, so a sound or a mark saved at the same moment keeps its part.
  // (A change worked out as nothing leaves the row as it is: another clip got there first.)
  const updated = await store.changeMoment(row, (now) => (now.motion?.key ? null : { motion: stored }), { archived_at: null });
  if (!updated) throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
  if (store.meta(updated).motion?.upload_sha256 !== digest) {
    throw store.fail(409, 'MOTION_EXISTS', 'This Moment already has its motion. Take it off first.');
  }
  logger.info('moments.motion_added', { momentId: id, duration_ms: durationMs, bytes: file.buffer.length });
  return updated;
}

/** DELETE /moments/:id/motion — the author takes the motion off while the Moment is live; the photo stays. */
async function remove(id, user) {
  const store = momentStore();
  const row = await store.ownMoment(id, user.id);
  if (!row) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  if (store.momentState(row) === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
  const m = store.meta(row);
  if (!m.motion?.key) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment has no motion.');
  await store.updateMoment(row, { moment: { motion: null } });
  await media.removeKeys(m.motion.bucket, [m.motion.key]).catch((error) => logger.warn('moments.motion_remove_failed', { error: error.message }));
}

/** The motion clip's stored key, for signing beside the photo's. */
function motionKeys(m) {
  return [m?.motion?.key].filter(media.isMomentKey);
}

/**
 * A Moment's `motion` as a switch-on reader gets it (CONTRACT 10b): a link only while its photo's link is given, and to
 * anyone but its author only once the clip's own picture check has passed (`own`: the reader wrote it).
 */
function motionOf(m, links, show, own = false) {
  const motion = m?.motion;
  if (!motion?.key) return null;
  if (!own && motion.check !== 'passed') return null;
  return { url: show ? links.get(motion.key) || null : null, duration_ms: motion.duration_ms ?? null };
}

module.exports = { upload, remove, motionKeys, motionOf, MAX_BYTES, MAX_MS, TYPES };
