#!/usr/bin/env node

/**
 * One-off: videos stored before uploads were cleaned (services/videoMetadata.js) can still say where they were taken.
 * That includes Live Photos: each is stored as a photo and a short video clip, and this counts the clip.
 *
 *   node backend/scripts/clean-stored-video-locations.js                reports how many do; changes nothing
 *   node backend/scripts/clean-stored-video-locations.js --rewrite      overwrites those, using the same cleaner
 *   node backend/scripts/clean-stored-video-locations.js --rewrite --limit=1      overwrites only the first, to try it
 *
 * It uses backend/.env, so it acts on whichever storage that points at. The report reads only each video's headers and
 * metadata, not the whole file. A rewrite keeps the object's key, type and length, so nothing that links to it changes.
 *
 * Videos it reports but won't rewrite: task completion proof and mail enclosures. Their storage key and row name a
 * hash of the file, which reads check, so changing the bytes would break them. Both are private.
 *
 * After a rewrite: the CDN and viewers' devices may keep the old bytes, because these objects are marked immutable for
 * a year. The script writes the rewritten keys to a file outside the repo. Download one through its public link, and if
 * the old bytes come back, purge those keys in the CDN behind AWS_CLOUDFRONT_URL, which need not be CloudFront.
 */

require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET, S3_STORAGE_NAMESPACE } = require('../config/aws');
const db = require('../config/supabaseAdmin');
const s3 = require('../services/s3Service');
const { UnreadableVideoError, inspectVideo, removeVideoMetadata } = require('../services/videoMetadata');

const args = process.argv.slice(2);
const rewrite = args.includes('--rewrite');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;
// A mistyped limit must not become a rewrite of everything.
if (args.some((arg) => arg !== '--rewrite' && arg !== limitArg) || (limitArg && !(Number.isInteger(limit) && limit > 0))) {
  console.error('Usage: clean-stored-video-locations.js [--rewrite [--limit=N]]');
  process.exit(2);
}

const bytesOf = (body) => body.transformToByteArray().then((array) => Buffer.from(array));

/** One stored video in the main bucket, which holds everything public and all chat files. */
function s3Video(key, head) {
  return {
    area: key.split('/')[0],
    name: key,
    size: head.ContentLength,
    versioned: Boolean(head.VersionId && head.VersionId !== 'null'),
    fetchRange: async (at, length) => {
      const { body, contentRange } = await s3.getObjectStream(key, S3_BUCKET, `bytes=${at}-${at + length - 1}`);
      const bytes = await bytesOf(body);
      return contentRange ? bytes : bytes.subarray(at, at + length);
    },
    download: async () => bytesOf((await s3.getObjectStream(key)).body),
    // uploadToS3 sets the cache rule for the key. Chat objects keep their ownership metadata, which cleanup checks.
    replace: async (buffer) => {
      await s3.uploadToS3(buffer, key, head.ContentType, head.Metadata);
      const after = await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      if (after.ContentLength !== buffer.length) throw new Error('The stored object has a different length');
    },
  };
}

async function* s3Videos() {
  let token;
  do {
    const page = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, ContinuationToken: token }));
    // Every object, because a key's extension comes from the name the client sent.
    for (const { Key: key } of page.Contents || []) {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      if (head.ContentType?.startsWith('video/')) yield s3Video(key, head);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

/** One stored video in Supabase Storage. `replaceable` is false for one whose key and row name a hash of its bytes. */
function storageVideo(area, bucket, key, size, contentType, replaceable) {
  const objects = db.storage.from(bucket);
  let signedUrl;
  // Through a signed link, because a plain download from a bucket named "public" reaches Storage's public-file route.
  const get = async (headers) => {
    if (!signedUrl) {
      const { data, error } = await objects.createSignedUrl(key, 60 * 60);
      if (error) throw new Error(`No link to read it: ${error.message}`);
      signedUrl = data.signedUrl;
    }
    const response = await fetch(signedUrl, { headers });
    if (!response.ok) throw new Error(`Read failed: ${response.status}`);
    return response;
  };
  return {
    area,
    name: `${bucket}/${key}`,
    size,
    fetchRange: async (at, length) => {
      const response = await get({ Range: `bytes=${at}-${at + length - 1}` });
      const bytes = Buffer.from(await response.arrayBuffer());
      return response.status === 206 ? bytes : bytes.subarray(at, at + length);
    },
    download: async () => Buffer.from(await (await get({})).arrayBuffer()),
    replace: replaceable ? async (buffer) => {
      const { error } = await objects.update(key, buffer, { contentType, upsert: true });
      if (error) throw new Error(`Upload failed: ${error.message}`);
    } : null,
  };
}

/** Videos in Supabase Storage that have File rows: Home files, task completion proof, business verification. */
async function* fileRowVideos() {
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('File').select('id, file_path, file_size, mime_type, visibility, metadata')
      .like('mime_type', 'video/%').eq('is_deleted', false).order('id').range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not read File rows: ${error.message}`);
    for (const row of data) {
      const contract = row.metadata?.storage_contract;
      const bucket = row.metadata?.storage_bucket;
      const video = (area, from, replaceable) => storageVideo(area, from, row.file_path, Number(row.file_size),
        row.mime_type, replaceable);
      if (contract === 'gig_completion_v1') yield video('task-completion', bucket, false);
      else if (contract === 'business_verification_v1') yield video('business-verification', bucket, true);
      else if (row.file_path?.startsWith('homes/')) {
        yield video('homes', row.visibility === 'public' ? 'public' : 'private', true);
      }
      // Anything else lives in the main bucket, which s3Videos lists.
    }
    if (data.length < pageSize) return;
  }
}

/** Videos enclosed with letters. They have no File rows: the private bucket's listing is the only inventory. */
async function* mailEnclosureVideos() {
  const bucket = (process.env.HOME_DOCUMENTS_BUCKET || '').trim();
  if (!bucket) return;
  const objects = db.storage.from(bucket);
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data: folders, error } = await objects.list('mail-enclosures', { limit: pageSize, offset });
    if (error) throw new Error(`Could not list mail enclosures: ${error.message}`);
    for (const folder of folders) {
      const { data: files, error: listError } = await objects.list(`mail-enclosures/${folder.name}`);
      if (listError) throw new Error(`Could not list mail enclosures: ${listError.message}`);
      for (const file of files) {
        if (file.metadata?.mimetype?.startsWith('video/')) {
          const key = `mail-enclosures/${folder.name}/${file.name}`;
          yield storageVideo('mail-enclosures', bucket, key, file.metadata.size, file.metadata.mimetype, false);
        }
      }
    }
    if (folders.length < pageSize) return;
  }
}

function tally(counts, name, area) {
  counts[name] ||= {};
  counts[name][area] = (counts[name][area] || 0) + 1;
}

function line(label, counts) {
  const areas = Object.entries(counts || {}).sort(([a], [b]) => a.localeCompare(b));
  const total = areas.reduce((sum, [, count]) => sum + count, 0);
  const breakdown = areas.length ? `  (${areas.map(([area, count]) => `${area} ${count}`).join(', ')})` : '';
  console.log(`  ${label.padEnd(30)}${String(total).padStart(6)}${breakdown}`);
}

async function main() {
  console.log(`Main bucket: ${S3_BUCKET} at ${S3_STORAGE_NAMESPACE}. Supabase: ${process.env.SUPABASE_URL}.`);
  console.log(rewrite ? 'Rewriting videos that carry a location.\n' : 'Report only: nothing will change.\n');

  const counts = {};
  const rewritten = [];
  let attempted = 0;
  let versioned = 0;
  for (const source of [s3Videos, fileRowVideos, mailEnclosureVideos]) {
    for await (const video of source()) {
      try {
        const { metadata, location } = await inspectVideo(video.fetchRange, video.size);
        if (video.versioned) versioned += 1;
        tally(counts, location ? 'location' : metadata ? 'metadata' : 'clean', video.area);
        if (!location) continue;
        if (!video.replace) {
          tally(counts, 'not rewritable', video.area);
        } else if (rewrite && attempted < limit) {
          attempted += 1;
          const buffer = await video.download();
          if (buffer.length !== video.size) throw new Error('The download has a different length');
          await removeVideoMetadata(buffer);
          const after = await inspectVideo(async (at, length) => buffer.subarray(at, at + length), buffer.length);
          if (after.metadata) throw new Error('Cleaning left metadata behind');
          await video.replace(buffer);
          tally(counts, 'rewritten', video.area);
          rewritten.push(video.name);
        }
      } catch (error) {
        if (error instanceof UnreadableVideoError) {
          tally(counts, 'unreadable', video.area);
        } else {
          tally(counts, 'failed', video.area);
          console.error(`Failed on ${video.name}: ${error.message}`);
        }
      }
    }
  }

  console.log('Stored videos, including Live Photo clips:');
  line('carry a location', counts.location);
  line('other metadata only', counts.metadata);
  line('already clean', counts.clean);
  line("can't be read", counts.unreadable);
  line('failed to check or rewrite', counts.failed);
  line("of those, private: can't rewrite", counts['not rewritable']);
  if (rewrite) line('rewritten', counts.rewritten);
  if (versioned) {
    console.log(`\nWarning: ${versioned} videos are in a versioned bucket. A rewrite leaves the old bytes in its history.`);
  }

  if (rewritten.length) {
    const list = path.join(os.tmpdir(), `video-location-rewrites-${Date.now()}.txt`);
    fs.writeFileSync(list, `${rewritten.join('\n')}\n`, { mode: 0o600 });
    console.log(`\nRewritten keys are in ${list}.`);
    console.log('The CDN may still serve the old bytes: download one through its public link, and purge these keys if it does.');
  } else if (!rewrite) {
    console.log('\nNothing changed. Run with --rewrite to overwrite the videos that carry a location.');
  }
  process.exitCode = counts.failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
