// A Moment's upload (CONTRACT POST /api/moments/:id/media), shared by the route and the test seed
// (scripts/seed-moments.js): the files checked against the limits, cleaned of their metadata (location, camera, time
// taken; photoMetadata.js and videoMetadata.js), measured, and stored privately with a thumbnail (momentMedia.js).

const store = require('./momentStore');
const media = require('./momentMedia');
const { cleanUploadedPhoto, MediaNotCleanedError } = require('../photoMetadata');
const { removeVideoMetadata, UnreadableVideoError } = require('../videoMetadata');

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov' };

// A JPEG still from the app (a poster or a frame), without its metadata, and its size.
async function cleanStill(file) {
  if (!file) return null;
  if (file.size > media.MAX_STILL_BYTES) throw store.fail(413, 'MEDIA_TOO_LARGE', 'This picture is too large.');
  await cleanUploadedPhoto(file);
  if (file.mimetype !== 'image/jpeg') throw store.fail(415, 'PHOTO_UNREADABLE', "A video's poster and frames are JPEG pictures.");
  return { buffer: file.buffer, ...(await media.jpegFacts(file.buffer)) };
}

/**
 * The upload's files (multer-shaped: { buffer, mimetype, size, originalname }) checked, cleaned and measured:
 * { uploadSha, file: { buffer, mimetype, width, height, durationMs }, poster, frames }. Throws the codes the apps handle.
 */
async function prepareFiles(kind, { file, poster: posterFile = null, frames: frameFiles = [] }) {
  if (!file) throw store.fail(400, 'MOMENT_INVALID', 'Send the photo or video as "file".');
  const uploadSha = media.sha256(file.buffer);
  try {
    if (kind === 'photo') {
      if (!media.PHOTO_TYPES.includes(file.mimetype)) throw store.fail(415, 'PHOTO_UNREADABLE', 'Send a JPEG, HEIC or PNG photo.');
      if (file.size > media.MAX_PHOTO_BYTES) throw store.fail(413, 'MEDIA_TOO_LARGE', 'This photo is too large to post.');
      await cleanUploadedPhoto(file);
      return {
        uploadSha,
        file: { buffer: file.buffer, mimetype: file.mimetype, ...(await media.photoFacts(file.buffer)), durationMs: null },
        poster: null,
        frames: [],
      };
    }
    if (!media.VIDEO_TYPES.includes(file.mimetype)) throw store.fail(415, 'VIDEO_UNREADABLE', 'Send an MP4 or QuickTime video.');
    if (file.size > media.MAX_VIDEO_BYTES) throw store.fail(413, 'MEDIA_TOO_LARGE', 'This video is too large to post.');
    if (!posterFile) throw store.fail(400, 'MOMENT_POSTER_REQUIRED', 'Send the video with its poster picture.');
    const facts = media.videoFacts(file.buffer);
    if (facts.durationMs > media.MAX_VIDEO_MS + media.VIDEO_MS_TOLERANCE) {
      throw store.fail(422, 'MEDIA_TOO_LONG', 'Videos can be up to 30 seconds.');
    }
    await removeVideoMetadata(file.buffer);
    const poster = await cleanStill(posterFile);
    const frames = [];
    for (const frame of frameFiles.slice(0, 2)) frames.push(await cleanStill(frame));
    return {
      uploadSha,
      file: {
        buffer: file.buffer, mimetype: file.mimetype,
        width: poster.width || facts.width, height: poster.height || facts.height, durationMs: facts.durationMs,
      },
      poster,
      frames,
    };
  } catch (error) {
    if (error instanceof MediaNotCleanedError) throw store.fail(error.status, error.code, error.message);
    if (error instanceof UnreadableVideoError) {
      throw store.fail(415, 'VIDEO_UNREADABLE', "We couldn't read this video, so we didn't save it. Try saving it as an MP4 and upload it again.");
    }
    throw error;
  }
}

/** Stores the prepared files privately; answers what the row records about them (post_metadata.moment.media). */
async function storeFiles(row, prepared) {
  const bucket = await media.privateBucket();
  const { file, poster, frames } = prepared;
  const record = {
    contract: media.STORAGE_CONTRACT,
    bucket,
    upload_sha256: prepared.uploadSha,
    key: media.keyFor(row.user_id, row.id, 'file', media.sha256(file.buffer), EXTENSIONS[file.mimetype] || 'bin'),
    content_type: file.mimetype,
    bytes: file.buffer.length,
    width: file.width || null,
    height: file.height || null,
    duration_ms: file.durationMs ?? null,
    poster_key: null,
    frame_keys: [],
    thumb_key: null,
  };
  await media.put(bucket, record.key, file.buffer, file.mimetype);
  if (poster) {
    record.poster_key = media.keyFor(row.user_id, row.id, 'poster', media.sha256(poster.buffer), 'jpg');
    await media.put(bucket, record.poster_key, poster.buffer, 'image/jpeg');
  }
  for (const [index, frame] of frames.entries()) {
    const key = media.keyFor(row.user_id, row.id, `frame${index}`, media.sha256(frame.buffer), 'jpg');
    await media.put(bucket, key, frame.buffer, 'image/jpeg');
    record.frame_keys.push(key);
  }
  const thumb = await media.thumbnail(poster ? poster.buffer : file.buffer);
  if (thumb) {
    record.thumb_key = media.keyFor(row.user_id, row.id, 'thumb', media.sha256(thumb), 'jpg');
    await media.put(bucket, record.thumb_key, thumb, 'image/jpeg');
  }
  return record;
}

/** The pictures the picture check reads from a prepared upload: the photo, or a video's poster and frames. */
function checkSources(kind, prepared) {
  return kind === 'video' ? [prepared.poster, ...prepared.frames].map((p) => p.buffer) : [prepared.file.buffer];
}

module.exports = { prepareFiles, storeFiles, checkSources };
