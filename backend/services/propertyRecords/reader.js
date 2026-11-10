'use strict';

/**
 * Reads the property index from private storage (format.js has what's in it):
 * a state's file, a county release's manifest, and one block at a time with
 * range reads. Recently read blocks stay in memory; a release is never changed
 * once written, so they can't go out of date.
 *
 * A state's file is read again every few minutes, which is how a new release or
 * a rollback reaches this server, and the last good copy answers while it can't
 * be read. Reads have a deadline and one second try, and after repeated failures
 * storage is left alone for a moment, then one read finds out whether it's back: a
 * lookup that can't read answers at once (StorageUnavailable), so no screen waits on
 * a storage outage. Bytes that can't be parsed count the same as a failed read.
 */

const dns = require('dns');
const fs = require('fs');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const { fileURLToPath } = require('url');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../../utils/logger');
const config = require('../../config/propertyRecords');
const { FORMAT, SUPPRESSIONS_PATH, statePath, releasePath, switchesPath, findBlock } = require('./format');

const READ_TIMEOUT_MS = 3000;
// A first try that hasn't answered by now gets a second one beside it, and the first to answer wins: a stuck
// connection costs one more small read, not the deadline. One that fails sooner is tried again after a short, jittered pause.
const SECOND_TRY_AFTER_MS = 700;
const RETRY_PAUSE_MIN_MS = 50;
const RETRY_PAUSE_SPREAD_MS = 100;
const STATE_FRESH_MS = 5 * 60 * 1000;
const FAILURES_BEFORE_PAUSE = 5;
const PAUSE_MS = 5 * 1000;
// How long a resolver gets before the last address that worked is used.
const DNS_WAIT_MS = 250;
// Memory: the production server is small and shared. A block is ~32 KB of JSON.
const KEPT_BLOCKS = 300;
const KEPT_MANIFESTS = 12;
const KEPT_FILES = 6;

class StorageUnavailable extends Error {}

/**
 * Where storage is, for its connections only. Asked of the resolver directly, because the system's way of asking waits
 * its turn in a small thread pool shared with file reads, and the last good answer stands while the resolver is slow or down.
 */
function lastGoodLookup() {
  const known = new Map();
  return (host, options, callback) => {
    const asked = typeof options === 'function' ? {} : options;
    const answer = typeof options === 'function' ? options : callback;
    let timer = null;
    let answered = false;
    const give = (err, ...rest) => {
      if (answered) return;
      answered = true;
      clearTimeout(timer);
      answer(err, ...rest);
    };
    const giveKnown = (addresses) => (asked.all ? give(null, addresses.map((address) => ({ address, family: 4 }))) : give(null, addresses[0], 4));
    timer = setTimeout(() => { if (known.has(host)) giveKnown(known.get(host)); }, DNS_WAIT_MS);
    dns.resolve4(host, (err, addresses) => {
      if (!err && addresses.length) {
        known.set(host, addresses);
        giveKnown(addresses);
      } else if (known.has(host)) {
        giveKnown(known.get(host));
      } else {
        // Nothing known yet: the system's own way of asking, which also knows local names.
        dns.lookup(host, asked, give);
      }
    });
  };
}

function s3Storage(url, region = config.region) {
  const client = new S3Client({
    region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    maxAttempts: 1,
    requestHandler: { httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 50, lookup: lastGoodLookup() }) },
  });
  const bucket = url.hostname;
  const prefix = url.pathname.replace(/^\/+|\/+$/g, '');
  return async (name, { range, etag, signal } = {}) => {
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: prefix ? `${prefix}/${name}` : name,
        ...(range ? { Range: `bytes=${range[0]}-${range[0] + range[1] - 1}` } : {}),
        ...(etag ? { IfNoneMatch: etag } : {}),
      }), { abortSignal: signal ? AbortSignal.any([AbortSignal.timeout(READ_TIMEOUT_MS), signal]) : AbortSignal.timeout(READ_TIMEOUT_MS) });
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

function storageAt(root, region) {
  const url = new URL(root);
  return url.protocol === 's3:' ? s3Storage(url, region) : fileStorage(url);
}

/** The index at a root, with its replica in the second region beside it when one is set (PROPERTY_RECORDS_FALLBACK_URL). */
function createStorage(root = config.manifestUrl) {
  if (!root) return null;
  const storage = storageAt(root);
  const base = config.manifestUrl.replace(/\/+$/, '');
  if (config.fallbackUrl && base && root.startsWith(base)) {
    storage.fallback = storageAt(`${config.fallbackUrl.replace(/\/+$/, '')}${root.slice(base.length)}`, config.fallbackRegion);
  }
  return storage;
}

// Refused or not found: a second try gets the same answer.
const lasting = (err) => {
  const status = err.$metadata?.httpStatusCode;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
};

/** One read with at most two tries: the first answer wins and the other try is let go. The second goes to the replica when there is one. */
function firstAnswer(storage, name, options) {
  const letGo = new AbortController();
  return new Promise((resolve, reject) => {
    let tries = 0;
    let running = 0;
    let timer = null;
    let settled = false;
    const start = () => {
      timer = null;
      tries += 1;
      running += 1;
      (tries > 1 && storage.fallback ? storage.fallback : storage)(name, { ...options, signal: letGo.signal }).then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
        letGo.abort();
      }, (err) => {
        running -= 1;
        if (settled) return;
        const again = tries < 2 && !lasting(err);
        if (again) {
          clearTimeout(timer);
          timer = setTimeout(start, RETRY_PAUSE_MIN_MS + Math.random() * RETRY_PAUSE_SPREAD_MS);
        } else if (!running || lasting(err)) {
          settled = true;
          clearTimeout(timer);
          reject(err);
          letGo.abort();
        }
      });
    };
    start();
    timer = setTimeout(start, SECOND_TRY_AFTER_MS);
  });
}

function createReader(storage = createStorage(), { keptFiles = KEPT_FILES } = {}) {
  let failures = 0;
  let pausedSince = 0;
  let pausedUntil = 0;
  let checking = false;
  let answeredAt = 0;

  function failed(err, wasChecking) {
    failures += 1;
    if (wasChecking || failures >= FAILURES_BEFORE_PAUSE) {
      if (!pausedSince) {
        pausedSince = Date.now();
        logger.warn('property_records.storage_paused', { error: err.name });
      }
      pausedUntil = Date.now() + PAUSE_MS;
      failures = 0;
    }
  }

  async function read(name, options) {
    const now = Date.now();
    // Paused: nobody reads. Once the pause is over, one read finds out whether storage is back, and the rest answer at once until it has.
    if (!storage || now < pausedUntil || (pausedSince && checking)) throw new StorageUnavailable('The property index can\'t be read just now');
    const isCheck = Boolean(pausedSince);
    if (isCheck) checking = true;
    try {
      const result = await firstAnswer(storage, name, options);
      failures = 0;
      answeredAt = Date.now();
      if (pausedSince) logger.info('property_records.storage_back', { ms: Date.now() - pausedSince });
      pausedSince = 0;
      pausedUntil = 0;
      return result;
    } catch (err) {
      failed(err, isCheck);
      throw new StorageUnavailable(err.name);
    } finally {
      if (isCheck) checking = false;
    }
  }

  // What came back isn't what was written. Storage answered, and the file itself may be the problem, so it counts as a failed read and is named in the log.
  function badBytes(what) {
    failed(Object.assign(new Error(what), { name: 'BadBytes' }), false);
    logger.warn('property_records.bad_bytes', { what });
    return new StorageUnavailable('A file in the property index can\'t be read');
  }

  // A small file that changes now and then: read again when due, in the background once one copy is held.
  function refreshed(name, parse, freshMs = STATE_FRESH_MS) {
    let held = null;
    let heldAt = 0;
    let etag = null;
    let job = null;
    const get = async () => {
      const now = Date.now();
      if (!job && (heldAt === 0 || now - heldAt >= freshMs)) {
        job = read(name, { etag })
          .then((result) => {
            if (!result) {
              held = null;
              etag = null;
            } else if (!result.notModified) {
              held = parse(result.bytes);
              etag = result.etag;
            }
            heldAt = Date.now();
          })
          .catch((err) => {
            logger.warn('property_records.refresh_failed', { error: err.message });
            if (held === null) throw err instanceof StorageUnavailable ? err : badBytes(name.split('/')[0]);
            // Keep the last good copy; ask again in a minute.
            heldAt = Date.now() - freshMs + 60 * 1000;
          })
          .finally(() => { job = null; });
        // Whoever is waiting hears of a first read's failure; in the background it's only logged.
        job.catch(() => {});
      }
      if (heldAt === 0 && job) await job;
      return held;
    };
    get.held = () => held;
    return get;
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

  /** A state's file as held now, without waiting: null until it has been read once. A read that's due starts behind it. */
  function heldStateFile(state) {
    if (!/^[A-Z]{2}$/.test(state || '')) return null;
    stateFile(state).catch(() => {});
    return states.get(state).held();
  }

  const suppressionsFile = refreshed(SUPPRESSIONS_PATH, (bytes) => JSON.parse(bytes.toString('utf8')));

  const switchesFile = (name, parse, freshMs) => refreshed(switchesPath(name), parse, freshMs);

  const manifests = new Map();
  function manifest(fips, release) {
    const name = `${releasePath(fips, release)}/manifest.json.gz`;
    let job = manifests.get(name);
    if (job) {
      manifests.delete(name);
    } else {
      job = read(name).then((result) => {
        if (!result) throw new StorageUnavailable('A release named by its state file is missing');
        let data;
        try {
          data = JSON.parse(zlib.gunzipSync(result.bytes).toString('utf8'));
        } catch (_) {
          throw badBytes('manifest');
        }
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
          try {
            return JSON.parse(zlib.gunzipSync(result.bytes).toString('utf8'));
          } catch (_) {
            throw badBytes('block');
          }
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

  /**
   * The records a county's release holds on one street name, around a house number: that number's block, and the block
   * on each side when the street runs into it. Three small reads at most, however long the street is.
   */
  async function recordsNear(fips, release, sortKey) {
    const current = await manifest(fips, release);
    const index = findBlock(current.keys, sortKey);
    if (index < 0) return [];
    const street = sortKey.slice(0, sortKey.indexOf('\u0000') + 1);
    // A block's first key says where it starts: the one before holds this street only when this block starts on it.
    const wanted = [index];
    if (index > 0 && current.keys[index].startsWith(street)) wanted.unshift(index - 1);
    if (index + 1 < current.keys.length && current.keys[index + 1].startsWith(street)) wanted.push(index + 1);
    const read = await Promise.all(wanted.map((at) => block(fips, release, current, at)));
    return read.flat().filter((record) => record.key.startsWith(street));
  }

  // Any other small file under this root, re-read as a state's file is. The oldest goes when too many are held.
  const files = new Map();
  function file(name, parse) {
    if (!files.has(name)) {
      files.set(name, refreshed(name, parse));
      if (files.size > keptFiles) files.delete(files.keys().next().value);
    }
    return files.get(name)();
  }

  /** For /health: whether storage is paused, and how long since it last answered. */
  const health = () => ({ paused: Boolean(pausedSince), answered_ms_ago: answeredAt ? Date.now() - answeredAt : null });

  return { stateFile, heldStateFile, recordsAt, recordsNear, suppressions: suppressionsFile, switchesFile, file, health };
}

const shared = createReader();

module.exports = { stateFile: shared.stateFile, heldStateFile: shared.heldStateFile, health: shared.health, recordsAt: shared.recordsAt, recordsNear: shared.recordsNear, suppressions: shared.suppressions, switchesFile: shared.switchesFile, createReader, createStorage, StorageUnavailable };
