'use strict';

/**
 * Reads the property index from private storage (format.js has what's in it):
 * a state's file, a county release's manifest, and one block at a time with
 * range reads. Recently read blocks stay in memory; a release is never changed
 * once written, so they can't go out of date.
 *
 * A state's file is read again every few minutes, which is how a new release or
 * a rollback reaches this server, and the last good copy answers while it can't
 * be read. Reads have a deadline, and after repeated failures storage is left
 * alone for a moment: a lookup that can't read answers at once
 * (StorageUnavailable), so no screen waits on a storage outage.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { fileURLToPath } = require('url');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const { FORMAT, SUPPRESSIONS_PATH, statePath, releasePath, findBlock } = require('./format');

const READ_TIMEOUT_MS = 3000;
const STATE_FRESH_MS = 5 * 60 * 1000;
const FAILURES_BEFORE_PAUSE = 5;
const PAUSE_MS = 30 * 1000;
// Memory: the production server is small and shared. A block is ~32 KB of JSON.
const KEPT_BLOCKS = 300;
const KEPT_MANIFESTS = 12;
const KEPT_FILES = 6;

class StorageUnavailable extends Error {}

function s3Storage(url) {
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    maxAttempts: 1,
  });
  const bucket = url.hostname;
  const prefix = url.pathname.replace(/^\/+|\/+$/g, '');
  return async (name, { range, etag } = {}) => {
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: prefix ? `${prefix}/${name}` : name,
        ...(range ? { Range: `bytes=${range[0]}-${range[0] + range[1] - 1}` } : {}),
        ...(etag ? { IfNoneMatch: etag } : {}),
      }), { abortSignal: AbortSignal.timeout(READ_TIMEOUT_MS) });
      return { bytes: Buffer.from(await response.Body.transformToByteArray()), etag: response.ETag || null };
    } catch (err) {
      if (err.$metadata?.httpStatusCode === 304) return { notModified: true };
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  };
}

function fileStorage(url) {
  const root = fileURLToPath(url);
  return async (name, { range } = {}) => {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) return null;
    if (!range) return { bytes: fs.readFileSync(file), etag: null };
    const bytes = Buffer.alloc(range[1]);
    const fd = fs.openSync(file, 'r');
    try {
      fs.readSync(fd, bytes, 0, range[1], range[0]);
    } finally {
      fs.closeSync(fd);
    }
    return { bytes, etag: null };
  };
}

function createStorage(manifestUrl = config.manifestUrl) {
  if (!manifestUrl) return null;
  const url = new URL(manifestUrl);
  return url.protocol === 's3:' ? s3Storage(url) : fileStorage(url);
}

function createReader(storage = createStorage()) {
  let failures = 0;
  let pausedUntil = 0;

  async function read(name, options) {
    if (!storage || Date.now() < pausedUntil) throw new StorageUnavailable('The property index can\'t be read just now');
    try {
      const result = await storage(name, options);
      failures = 0;
      return result;
    } catch (err) {
      failures += 1;
      if (failures >= FAILURES_BEFORE_PAUSE) {
        pausedUntil = Date.now() + PAUSE_MS;
        failures = 0;
        logger.warn('property_records.storage_paused', { error: err.name });
      }
      throw new StorageUnavailable(err.name);
    }
  }

  // A small file that changes now and then: read again when due, in the background once one copy is held.
  function refreshed(name, parse, freshMs = STATE_FRESH_MS) {
    let held = null;
    let heldAt = 0;
    let etag = null;
    let job = null;
    return async () => {
      const now = Date.now();
      if (!job && (heldAt === 0 || now - heldAt >= freshMs)) {
        job = read(name, { etag })
          .then((result) => {
            heldAt = Date.now();
            if (!result) {
              held = null;
              etag = null;
            } else if (!result.notModified) {
              held = parse(result.bytes);
              etag = result.etag;
            }
          }, (err) => {
            logger.warn('property_records.refresh_failed', { error: err.message });
            if (held === null) throw err;
            // Keep the last good copy; ask again in a minute.
            heldAt = Date.now() - freshMs + 60 * 1000;
          })
          .finally(() => { job = null; });
      }
      if (heldAt === 0 && job) await job;
      return held;
    };
  }

  function parseState(bytes) {
    const data = JSON.parse(bytes.toString('utf8'));
    if (data?.v !== FORMAT || !data.jurisdictions) throw new Error('A state file this server can\'t read');
    return data;
  }

  const states = new Map();
  function stateFile(state) {
    if (!/^[A-Z]{2}$/.test(state || '')) return Promise.resolve(null);
    if (!states.has(state)) states.set(state, refreshed(statePath(state), parseState));
    return states.get(state)();
  }

  const suppressionsFile = refreshed(SUPPRESSIONS_PATH, (bytes) => JSON.parse(bytes.toString('utf8')));

  const manifests = new Map();
  function manifest(fips, release) {
    const name = `${releasePath(fips, release)}/manifest.json.gz`;
    let job = manifests.get(name);
    if (job) {
      manifests.delete(name);
    } else {
      job = read(name).then((result) => {
        if (!result) throw new StorageUnavailable('A release named by its state file is missing');
        const data = JSON.parse(zlib.gunzipSync(result.bytes).toString('utf8'));
        if (data?.v !== FORMAT) throw new StorageUnavailable('A release this server can\'t read');
        // Offsets from the lengths: the file is the blocks back to back.
        const offsets = new Array(data.lengths.length);
        let at = 0;
        data.lengths.forEach((length, i) => {
          offsets[i] = at;
          at += length;
        });
        return { ...data, offsets };
      });
      job.catch(() => manifests.delete(name));
    }
    manifests.set(name, job);
    while (manifests.size > KEPT_MANIFESTS) manifests.delete(manifests.keys().next().value);
    return job;
  }

  const blocks = new Map();
  function block(fips, release, current, index) {
    const key = `${fips}:${release}:${index}`;
    let job = blocks.get(key);
    if (job) {
      blocks.delete(key);
    } else {
      job = read(`${releasePath(fips, release)}/data.bin`, { range: [current.offsets[index], current.lengths[index]] })
        .then((result) => {
          if (!result || result.bytes.length !== current.lengths[index]) throw new StorageUnavailable('A short read');
          return JSON.parse(zlib.gunzipSync(result.bytes).toString('utf8'));
        });
      job.catch(() => blocks.delete(key));
    }
    blocks.set(key, job);
    while (blocks.size > KEPT_BLOCKS) blocks.delete(blocks.keys().next().value);
    return job;
  }

  /** Every record a county's release holds under one sort key: they are always in one block. */
  async function recordsAt(fips, release, sortKey) {
    const current = await manifest(fips, release);
    const index = findBlock(current.keys, sortKey);
    if (index < 0) return [];
    const records = await block(fips, release, current, index);
    return records.filter((record) => record.key === sortKey);
  }

  // Any other small file under this root, re-read as a state's file is. The oldest goes when too many are held.
  const files = new Map();
  function file(name, parse) {
    if (!files.has(name)) {
      files.set(name, refreshed(name, parse));
      if (files.size > KEPT_FILES) files.delete(files.keys().next().value);
    }
    return files.get(name)();
  }

  return { stateFile, recordsAt, suppressions: suppressionsFile, file };
}

const shared = createReader();

module.exports = { stateFile: shared.stateFile, recordsAt: shared.recordsAt, suppressions: shared.suppressions, createReader, createStorage, StorageUnavailable };
