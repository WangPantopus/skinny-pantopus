#!/usr/bin/env node
/**
 * SEEDMAP (founder, 2026-11-24): posts a folder of real photos and videos as real accounts' own Moments and Pulse
 * posts, each pinned where it was taken, so the Moments and Pulse maps have no bare spots around Portland and Clark
 * County. The people never post by hand and no password is used: the tool works with the server's own access, like
 * post-curator-moment.js.
 *
 * The folder holds one sub-folder per account, named by the account's email or username, with that person's photos
 * (JPEG, HEIC, PNG) and videos (MOV, MP4; HEVC is fine). `prepare` reads where, when and how high each was taken from
 * the file itself (the height shows on the Moment as "Show height" would, while `moment_heights` is on), makes the
 * upload copies the apps would make (.seedmap-ready/), a small preview to write the caption from (.seedmap-previews/),
 * and writes seedmap-manifest.json. Fill in each line's `caption`, `post_as` (moment | pulse |
 * both), `pulse_kind` (local_update | recommendation | neighborhood_win | visitor_guide: the kinds that stay up),
 * `moment_days` (1 to 60) and, for waves, `not_before` (a date). `run` is a dry run until --post: it prints what each
 * line would post and why any line is left out. Running again never posts the same file for the same account twice.
 * `undo` lists, and with --yes ends, the Moments and removes the Pulse posts this tool made, and nothing else.
 *
 * Moments go through the Moments services (services/moments: the posting rules, place names, the picture check,
 * storage); only this tool may make one last longer than 48 hours. Pulse posts go through the routes' own handlers,
 * POST /api/posts, POST /api/upload/post-media/:id and DELETE /api/posts/:id, run in this process with the account
 * set in place of a sign-in (everything else in those routes runs as it does for the apps). Nobody is notified: the
 * Moments are stamped as already handled for the connections' push, and the Pulse posts go to the place feed only
 * (no connections fan-out, so postCreationHooksService sends nothing).
 *
 * usage, from backend/ with the backend's environment (ffmpeg and ffprobe on the PATH for videos):
 *   node scripts/seedmap.js prepare <folder>
 *   node scripts/seedmap.js run <folder> [--post] [--account <email|username>] [--confirm-remote]
 *   node scripts/seedmap.js undo <folder> [--yes] [--account <email|username>] [--confirm-remote]
 *   A stack that isn't local (SUPABASE_URL not 127.0.0.1 or localhost) needs --confirm-remote to post or undo.
 *
 * Left out, with the reason printed, never posted: a file with no location, one taken within 60 m of a home its
 * account lives at (the Moments "at home" distance), an empty caption, a video longer than a Moment's 60 seconds or
 * larger than the routes take, and any line whose account is missing, banned, the curator or a business, hasn't
 * confirmed 18+, or (for a Moment) doesn't have Moments on.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [command, folderArg, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const die = (message) => { console.error(`seedmap: ${message}`); process.exit(1); };

if (!['prepare', 'run', 'undo'].includes(command) || !folderArg) {
  die('usage: seedmap.js prepare|run|undo <folder> [--post | --yes] [--account <name>] [--confirm-remote]');
}
const folder = path.resolve(folderArg);
if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) die(`${folder} is not a folder.`);
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(process.env.SUPABASE_URL || '');
const writing = (command === 'run' && flag('--post')) || (command === 'undo' && flag('--yes'));
if (writing && !local && !flag('--confirm-remote')) die('SUPABASE_URL is not a local stack; pass --confirm-remote to write there.');
const onlyAccount = opt('--account');

const db = require('../config/supabaseAdmin');
const store = require('../services/moments/momentStore');
const momentPlace = require('../services/moments/momentPlace');
const momentUpload = require('../services/moments/momentUpload');
const momentMedia = require('../services/moments/momentMedia');
const momentCheck = require('../services/moments/momentCheck');
const { adultStatus } = require('../services/adultAttestation');
const { isFeatureEnabled } = require('../services/featureFlagService');
const { STAYING_POST_TYPES } = require('../services/pulse/lifecycle');
const { timezoneFromCoordinates } = require('../utils/timezone');
const { readCapture } = require('./seedmap/capture');
const files = require('./seedmap/files');

const MANIFEST = path.join(folder, 'seedmap-manifest.json');
const READY = path.join(folder, '.seedmap-ready');
const PREVIEWS = path.join(folder, '.seedmap-previews');
// Pulse kinds a seeded post may be: the ones that stay up until removed (lifecycle.js), less the two that are refused
// for a place audience (a plain or personal update).
const PULSE_KINDS = STAYING_POST_TYPES.filter((kind) => !['general', 'personal_update'].includes(kind));
const POST_AS = ['moment', 'pulse', 'both'];
const MAX_DAYS = store.LONG_MAX_HOURS / 24;
const MOMENT_CAPTION_MAX = 100;
const PULSE_CAPTION_MAX = 5000;
// The Pulse route's own caps (20 writes a minute per person): one Pulse post every few seconds stays well under.
const PULSE_PAUSE_MS = 3500;
const NOTIFY_SKIPPED = { skipped: 'seeded' };

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/** A UUID made from `text`, the same every time (the routes take retry keys and ids as UUIDs). */
function stableUuid(text) {
  const hex = sha256(text);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const momentIdFor = (userId, fileSha) => stableUuid(`pantopus:seedmap:moment:v1:${userId}:${fileSha}`);
const pulseRequestIdFor = (userId, fileSha) => stableUuid(`pantopus:seedmap:pulse:v1:${userId}:${fileSha}`);
const pulsePostIdFor = (userId, fileSha) => require('../routes/posts').commandPostId(userId, pulseRequestIdFor(userId, fileSha));

// ─── The manifest ───────────────────────────────────────────

function readManifest() {
  if (!fs.existsSync(MANIFEST)) return null;
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (manifest?.v !== 1 || !Array.isArray(manifest.lines)) die(`${MANIFEST} is not a seedmap manifest.`);
  return manifest;
}

function writeManifest(manifest) {
  const temp = `${MANIFEST}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(temp, MANIFEST);
}

const lineName = (line) => `${line.account}/${line.file}`;

// ─── Accounts ───────────────────────────────────────────────

const accounts = new Map();

/** The account a sub-folder names, with why it can't post (`problem`) and whether Moments are on (`moments`). */
async function account(name) {
  if (accounts.has(name)) return accounts.get(name);
  const found = (async () => {
    const query = db.from('User').select('id, email, username, account_type, role').limit(2);
    // An email matches whatever its case; `_` and `%` in it are letters, not patterns.
    const { data, error } = await (name.includes('@') ? query.ilike('email', name.replace(/[\\%_]/g, '\\$&')) : query.eq('username', name));
    if (error) throw new Error(`Failed to read the account ${name}: ${error.message}`);
    if (!data?.length) return { name, problem: 'no account has this email or username' };
    if (data.length > 1) return { name, problem: 'more than one account matches this name' };
    const user = data[0];
    const out = { name, user: { id: user.id, email: user.email, role: user.role || 'user', accountType: user.account_type || 'individual', emailConfirmed: true } };
    if (user.account_type === 'curator') return { ...out, problem: 'this is the Pantopus curator account' };
    if (user.account_type === 'business') return { ...out, problem: 'this is a business account' };
    if (user.account_type === 'system') return { ...out, problem: 'this is a system account' };
    const { data: auth, error: authError } = await db.auth.admin.getUserById(user.id);
    if (authError || !auth?.user) return { ...out, problem: 'the account has no sign-in (it could not post from an app)' };
    if (auth.user.banned_until && Date.parse(auth.user.banned_until) > Date.now()) return { ...out, problem: 'the account is banned' };
    if (auth.user.deleted_at) return { ...out, problem: 'the account was deleted' };
    const adult = await adultStatus(user.id);
    if (adult.ineligible) return { ...out, problem: 'the date of birth on file is under 18' };
    if (!adult.attestedAt) return { ...out, problem: 'the account has not confirmed it is 18 or older (done once in the app)' };
    const moments = await isFeatureEnabled('moments', out.user);
    return { ...out, moments };
  })();
  accounts.set(name, found);
  return found;
}

// ─── prepare ────────────────────────────────────────────────

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : files.kindOf(entry.name) ? [full] : [];
  });
}

/** When it was taken, as an ISO time: the file's own time, or its clock time read in the zone of where it was. */
function takenTime(capture) {
  if (capture.capturedAt) return capture.capturedAt;
  if (!capture.localTime) return null;
  const { DateTime } = require('luxon');
  const zone = capture.latitude != null ? timezoneFromCoordinates(capture.latitude, capture.longitude, 'UTC') : 'UTC';
  const at = DateTime.fromISO(capture.localTime, { zone });
  return at.isValid ? at.toUTC().toISO() : null;
}

/** The upload copies for one file, made once into .seedmap-ready: { file, poster, frames, seconds }. */
function readyPaths(fileSha, kind) {
  const base = path.join(READY, fileSha.slice(0, 24));
  return kind === 'photo' ? { file: `${base}.jpg` }
    : { file: `${base}.mp4`, poster: `${base}-poster.jpg`, frames: [`${base}-frame1.jpg`, `${base}-frame2.jpg`] };
}

async function makeReady(source, fileSha, kind) {
  const paths = readyPaths(fileSha, kind);
  if (fs.existsSync(paths.file)) return paths;
  fs.mkdirSync(READY, { recursive: true });
  if (kind === 'photo') {
    fs.writeFileSync(paths.file, (await files.photoUpload(source)).buffer);
  } else {
    const made = await files.videoUpload(source);
    fs.writeFileSync(paths.poster, made.poster.buffer);
    made.frames.forEach((frame, i) => fs.writeFileSync(paths.frames[i], frame.buffer));
    fs.writeFileSync(paths.file, made.file.buffer);
  }
  return paths;
}

async function prepare() {
  const before = readManifest();
  const kept = new Map((before?.lines || []).map((line) => [`${line.account}\n${line.sha256}`, line]));
  const accountDirs = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && (!onlyAccount || entry.name === onlyAccount));
  const lines = [];
  for (const dir of accountDirs) {
    const who = await account(dir.name);
    for (const full of listFiles(path.join(folder, dir.name)).sort()) {
      const file = path.relative(path.join(folder, dir.name), full);
      const kind = files.kindOf(full);
      const fileSha = sha256(fs.readFileSync(full));
      const previous = kept.get(`${dir.name}\n${fileSha}`) || {};
      const capture = readCapture(full);
      const placed = capture.latitude != null && capture.longitude != null;
      const line = {
        account: dir.name,
        file,
        sha256: fileSha,
        kind,
        latitude: placed ? Number(capture.latitude.toFixed(6)) : null,
        longitude: placed ? Number(capture.longitude.toFixed(6)) : null,
        taken_at: takenTime(capture),
        // How high the file says it was taken (metres above sea level) and how fast it moved, for the Moment's height.
        altitude_m: placed && Number.isFinite(capture.altitudeM) ? Number(capture.altitudeM.toFixed(1)) : null,
        speed_mps: placed && Number.isFinite(capture.speedMps) ? Number(capture.speedMps.toFixed(1)) : null,
        place_label: null,
        town: null,
        seconds: null,
        preview: null,
        problems: [],
        caption: previous.caption ?? '',
        post_as: previous.post_as ?? '',
        pulse_kind: previous.pulse_kind ?? '',
        moment_days: previous.moment_days ?? null,
        not_before: previous.not_before ?? null,
        ...(previous.posted ? { posted: previous.posted } : {}),
        ...(previous.undone_at ? { undone_at: previous.undone_at } : {}),
      };
      if (!placed) line.problems.push('no location in the file');
      if (placed) {
        const labels = await momentPlace.labelsAt(line.latitude, line.longitude);
        line.place_label = labels.place_label;
        line.town = labels.area_label;
        if (who.user && await momentPlace.isAtHome(who.user.id, line.latitude, line.longitude, { onFailure: true })) {
          line.problems.push(`taken at the account's home (within ${momentPlace.AT_HOME_M} m)`);
        }
      }
      try {
        const ready = await makeReady(full, fileSha, kind);
        if (kind === 'video') line.seconds = Number((files.videoSeconds(full) || 0).toFixed(1));
        line.ready_bytes = fs.statSync(ready.file).size;
        line.preview = path.relative(folder, path.join(PREVIEWS, `${fileSha.slice(0, 24)}.jpg`));
        if (!fs.existsSync(path.join(folder, line.preview))) await files.writePreview(full, kind, path.join(folder, line.preview));
      } catch (error) {
        line.problems.push(`the file could not be read (${error.message.split('\n')[0]})`);
      }
      lines.push(line);
      console.log(`${lineName(line)}: ${line.kind}${placed ? ` at ${line.place_label}` : ''}${line.taken_at ? `, taken ${line.taken_at}` : ''}${line.altitude_m != null ? `, ${line.altitude_m} m up` : ''}${line.problems.length ? ` (left out: ${line.problems.join('; ')})` : ''}`);
    }
    if (who.problem) console.log(`${dir.name}: account left out: ${who.problem}`);
  }
  // Lines for other accounts (with --account) stay as they were.
  const others = (before?.lines || []).filter((line) => onlyAccount && line.account !== onlyAccount);
  writeManifest({
    v: 1,
    prepared_at: new Date().toISOString(),
    fields: {
      caption: `What the post says (a Moment's caption is at most ${MOMENT_CAPTION_MAX} characters).`,
      post_as: POST_AS.join(' | '),
      pulse_kind: PULSE_KINDS.join(' | '),
      moment_days: `1 to ${MAX_DAYS}`,
      not_before: 'optional: a date or time; the line waits until then',
    },
    lines: [...others, ...lines],
  });
  console.log(`\nWrote ${MANIFEST}: ${lines.length} files. Fill in caption, post_as, pulse_kind, moment_days (and not_before), then run.`);
}

// ─── Deciding what a line posts ─────────────────────────────

const momentsToday = new Map();
async function momentsPostedToday(userId) {
  if (!momentsToday.has(userId)) {
    const { data, error } = await db.from('Post').select('id, series:post_metadata->moment->series')
      .eq('user_id', userId).eq('is_story', true)
      .gte('created_at', new Date(Date.now() - 24 * store.HOUR_MS).toISOString()).limit(store.DAILY_LIMIT * store.MAX_PARTS + 1);
    if (error) throw new Error(`Failed to count Moments: ${error.message}`);
    momentsToday.set(userId, (data || []).filter((post) => !(Number(post.series?.index) > 1)).length);
  }
  return momentsToday.get(userId);
}

/** Why a line posts nothing at all, or null. */
function lineProblem(line, who) {
  if (who.problem) return `account: ${who.problem}`;
  if (line.problems?.length) return line.problems.join('; ');
  if (line.undone_at) return `undone on ${line.undone_at}; an undone file isn't posted again`;
  if (!String(line.caption || '').trim()) return 'no caption';
  if (!POST_AS.includes(line.post_as)) return `post_as must be ${POST_AS.join(', ')}`;
  if (line.not_before) {
    const at = Date.parse(line.not_before);
    if (!Number.isFinite(at)) return `not_before "${line.not_before}" is not a date`;
    if (at > Date.now()) return `waits until ${new Date(at).toISOString()} (not_before)`;
  }
  return null;
}

let videoLimitBytes = null;

/** The Moment half: { skip } with the reason, or { days }. */
async function momentPlan(line, who, existing) {
  if (!['moment', 'both'].includes(line.post_as)) return null;
  // One an earlier run made but stopped before its file went up is finished, at the length it was made with.
  if (existing && !store.meta(existing).media && store.momentState(existing) === 'uploading') {
    return { days: store.storedHours(existing) / 24, resume: true };
  }
  if (existing) return { skip: `already posted (Moment ${existing.id}, ${store.momentState(existing)})`, done: true };
  if (!who.moments) return { skip: 'Moments are not on for this account' };
  const days = Number(line.moment_days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { skip: `moment_days must be a whole number from 1 to ${MAX_DAYS}` };
  if (String(line.caption).trim().length > MOMENT_CAPTION_MAX) return { skip: `the caption is longer than a Moment's ${MOMENT_CAPTION_MAX} characters` };
  if (line.kind === 'video') {
    if (line.seconds * 1000 > momentMedia.MAX_VIDEO_MS + momentMedia.VIDEO_MS_TOLERANCE) {
      return { skip: `the video is ${line.seconds} s; a Moment's video is at most ${momentMedia.MAX_VIDEO_MS / 1000} s (never cut)` };
    }
    if (videoLimitBytes == null) videoLimitBytes = await momentMedia.maxVideoBytes();
    if (line.ready_bytes > videoLimitBytes) return { skip: `the video is ${(line.ready_bytes / 1e6).toFixed(1)} MB once made ready; a Moment takes ${(videoLimitBytes / 1e6).toFixed(0)} MB` };
  } else if (line.ready_bytes > momentMedia.MAX_PHOTO_BYTES) {
    return { skip: 'the photo is too large for a Moment' };
  }
  const today = await momentsPostedToday(who.user.id);
  // (a resumed one was counted when it was made)
  if (today >= store.DAILY_LIMIT) return { skip: `${store.DAILY_LIMIT} Moments already posted for this account in the last 24 hours; a later run posts it` };
  momentsToday.set(who.user.id, today + 1);
  return { days };
}

/** The Pulse half: { skip } with the reason, or { kind }. */
function pulsePlan(line, existing) {
  if (!['pulse', 'both'].includes(line.post_as)) return null;
  if (existing) {
    return existing.archived_at
      ? { skip: `already posted and removed (post ${existing.id})`, done: true }
      : { skip: `already posted (post ${existing.id})`, done: true, needsMedia: !(existing.media_urls || []).length };
  }
  if (!PULSE_KINDS.includes(line.pulse_kind)) {
    return { skip: `pulse_kind "${line.pulse_kind || ''}" isn't one that stays up; use ${PULSE_KINDS.join(', ')}` };
  }
  if (String(line.caption).trim().length > PULSE_CAPTION_MAX) return { skip: 'the caption is too long for a post' };
  const { MAX_FILE_SIZES } = require('../services/s3Service');
  if (line.ready_bytes > MAX_FILE_SIZES[line.kind === 'video' ? 'video' : 'image']) return { skip: 'the file is too large for a post' };
  return { kind: line.pulse_kind };
}

/** The place a Pulse post is tagged with, as the apps' place picker would offer it near the photo. */
async function pulseTag(line) {
  const venues = require('../services/geo/venues');
  try {
    const { places } = await venues.venuesNear({ latitude: line.latitude, longitude: line.longitude, limit: 12, waitMs: momentPlace.VENUE_WAIT_MS });
    const venue = momentPlace.namingVenue((places || []).filter((place) => place?.name));
    if (venue?.place_id) return { name: String(venue.name).slice(0, 255), placeId: String(venue.place_id), kind: venue.kind || 'poi' };
  } catch (_) {
    // No venue list here: the town's tag below.
  }
  try {
    const town = await require('../services/geo').localityAt(line.latitude, line.longitude);
    if (town?.place_id) {
      return { name: await momentPlace.townAt(line.latitude, line.longitude), placeId: String(town.place_id), kind: town.kind || 'place' };
    }
  } catch (_) {
    // Nothing to tag.
  }
  return null;
}

async function existingMoment(userId, line) {
  const row = await store.loadMoment(momentIdFor(userId, line.sha256));
  return row && row.user_id === userId ? row : null;
}

async function existingPulse(userId, line) {
  const { data, error } = await db.from('Post').select('id, user_id, archived_at, media_urls')
    .eq('id', pulsePostIdFor(userId, line.sha256)).maybeSingle();
  if (error) throw new Error(`Failed to read a post: ${error.message}`);
  return data && data.user_id === userId ? data : null;
}

// ─── The routes, in this process ────────────────────────────

let routes = null;

/**
 * The Pulse routes' own handlers, mounted on a server in this process that only this process reaches (127.0.0.1, a
 * port the system picks). The one step replaced is verifyToken: the account a line names is the request's person.
 */
async function pulseRoutes() {
  if (routes) return routes;
  const express = require('express');
  const verifyToken = require('../middleware/verifyToken');
  const handlers = (router, method, routePath) => {
    const layer = router.stack.find((l) => l.route?.path === routePath && l.route.methods[method]);
    const stack = layer?.route.stack.map((l) => l.handle) || [];
    if (!stack.includes(verifyToken)) throw new Error(`${method.toUpperCase()} ${routePath} changed: its sign-in step wasn't found`);
    return stack.filter((handle) => handle !== verifyToken);
  };
  const posts = require('../routes/posts');
  const upload = require('../routes/upload');
  const people = new Map();
  const asPerson = (req, res, next) => {
    const user = people.get(req.get('x-seedmap-person'));
    if (!user) return res.status(401).json({ error: 'No person' });
    req.user = { ...user };
    return next();
  };
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/posts', asPerson, ...handlers(posts, 'post', '/'));
  app.delete('/posts/:id', asPerson, ...handlers(posts, 'delete', '/:id'));
  app.post('/upload/post-media/:postId', asPerson, ...handlers(upload, 'post', '/post-media/:postId'));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (user, method, url, body) => {
    const key = crypto.randomUUID();
    people.set(key, user);
    try {
      const response = await fetch(`${base}${url}`, {
        method,
        headers: { 'x-seedmap-person': key, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) { /* not JSON */ }
      return { status: response.status, body: json || { error: text } };
    } finally {
      people.delete(key);
    }
  };
  routes = { call, close: () => server.close() };
  return routes;
}

// ─── Posting ────────────────────────────────────────────────

const readFile = (p) => ({ buffer: fs.readFileSync(p), size: fs.statSync(p).size });

async function postMoment(line, who, days, resume = false) {
  const user = who.user;
  const location = { source: 'capture', latitude: line.latitude, longitude: line.longitude, taken_at: line.taken_at || new Date().toISOString() };
  // The route's own rules for this account: 18+ and the 20 a day (a resumed Moment was counted when it was made).
  if (!resume) await store.checkPostingRules(user, { kind: line.kind, location });
  if (await momentPlace.isAtHome(user.id, line.latitude, line.longitude, { onFailure: true })) {
    throw new Error(`taken at the account's home (within ${momentPlace.AT_HOME_M} m)`);
  }
  const labels = await momentPlace.labelsAt(line.latitude, line.longitude);
  const altitude = await momentHeight(line, user);
  const row = store.newMomentRow({
    userId: user.id,
    accountType: user.accountType,
    kind: line.kind,
    hours: days * 24,
    audience: 'nearby',
    showArea: false,
    atHome: false,
    caption: String(line.caption).trim(),
    text: null,
    background: 'teal',
    location,
    labels,
    labelKind: momentPlace.labelKind(labels, labels.place_label),
    // Founder, 2026-11-28: a seeded post never shows when its picture was taken (no "Taken Sept 23" line).
    takenAt: null,
    altitude,
  });
  // Already handled for the connections' push (momentNotify.notifyConnections leaves a Moment with `notify` alone).
  row.post_metadata.moment.notify = NOTIFY_SKIPPED;
  const { row: saved } = await store.insertMoment(row, momentIdFor(user.id, line.sha256));
  // The upload, as POST /api/moments/:id/media makes it.
  const ready = readyPaths(line.sha256, line.kind);
  const multer = (p, mimetype, name) => ({ ...readFile(p), mimetype, originalname: name });
  const prepared = await momentUpload.prepareFiles(line.kind, line.kind === 'photo'
    ? { file: multer(ready.file, 'image/jpeg', 'photo.jpg') }
    : { file: multer(ready.file, 'video/mp4', 'video.mp4'), poster: multer(ready.poster, 'image/jpeg', 'poster.jpg'),
      frames: ready.frames.map((f) => multer(f, 'image/jpeg', 'frame.jpg')) });
  const record = await momentUpload.storeFiles(saved, prepared);
  const checking = await store.updateMoment(saved, {
    moment: { media: record, state: 'checking', checking_since: new Date().toISOString() },
  }, { 'post_metadata->moment->>media': null, archived_at: null });
  if (!checking) throw new Error('the Moment already has its file');
  const pictures = await Promise.all(momentUpload.checkSources(line.kind, prepared).map((buffer) => momentMedia.checkImage(buffer)));
  const done = await momentCheck.finishUpload(checking, await momentCheck.checkPictures(pictures));
  return { id: saved.id, state: done ? store.momentState(done) : 'checking', check: store.meta(done || checking).check?.status || null };
}

async function uploadPulseMedia(user, postId, line) {
  const { call } = await pulseRoutes();
  const ready = readyPaths(line.sha256, line.kind);
  const form = new FormData();
  const mimetype = line.kind === 'photo' ? 'image/jpeg' : 'video/mp4';
  form.append('files', new Blob([fs.readFileSync(ready.file)], { type: mimetype }), path.basename(ready.file));
  const answer = await call(user, 'POST', `/upload/post-media/${postId}`, form);
  if (answer.status !== 200) throw new Error(`the photo upload was refused (${answer.status}: ${answer.body?.error || 'no reason'})`);
}

async function postPulse(line, who, kind) {
  const user = who.user;
  if (await momentPlace.isAtHome(user.id, line.latitude, line.longitude, { onFailure: true })) {
    throw new Error(`taken at the account's home (within ${momentPlace.AT_HOME_M} m)`);
  }
  const tag = await pulseTag(line);
  if (!tag) throw new Error('no place could be named for where it was taken');
  const { call } = await pulseRoutes();
  const answer = await call(user, 'POST', '/posts', {
    clientRequestId: pulseRequestIdFor(user.id, line.sha256),
    content: String(line.caption).trim(),
    postType: kind,
    postAs: 'personal',
    audience: 'nearby',
    // Pinned where the photo was taken, named by the place that names that spot (or its town).
    latitude: line.latitude,
    longitude: line.longitude,
    locationName: tag.name,
    geocodeProvider: 'mapbox',
    geocodeAccuracy: tag.kind,
    geocodePlaceId: tag.placeId,
    mediaLocations: [{ latitude: line.latitude, longitude: line.longitude, capturedAt: null }],
  });
  if (answer.status !== 201 || !answer.body?.post?.id) {
    throw new Error(`the post was refused (${answer.status}: ${answer.body?.error || 'no reason'})`);
  }
  const postId = answer.body.post.id;
  await uploadPulseMedia(user, postId, line);
  return { id: postId, tag: tag.name };
}

/**
 * The height a Moment keeps from its file, as the route keeps one an app sent with "Show height" on: only while heights
 * are on for the account (the `moment_heights` flag), at an exact pin away from home, rounded to 10 ft.
 */
async function momentHeight(line, user) {
  if (line.altitude_m == null) return null;
  const shown = store.shownAltitude({ meters: line.altitude_m, speed_mps: line.speed_mps ?? null });
  return shown && (await store.heightsOn(user)) ? shown : null;
}

async function describeMoment(line, plan, user) {
  const height = await momentHeight(line, user);
  // A manifest prepared before heights were read has no altitude_m at all: preparing again reads it, keeping captions.
  const shows = height ? `, ${height.altitude_ft.toLocaleString('en-US')} ft up`
    : !('altitude_m' in line) ? ', no height (run prepare again to read it from the file)'
      : line.altitude_m == null ? ', no height in the file' : ', no height (heights are off for this account)';
  return `Moment for ${plan.days} day${plan.days === 1 ? '' : 's'} at ${line.place_label}${shows}`;
}

async function run() {
  const manifest = readManifest();
  if (!manifest) die(`no manifest yet: run "prepare ${folderArg}" first.`);
  const post = flag('--post');
  console.log(post ? `Posting on ${local ? 'the local stack' : process.env.SUPABASE_URL}.` : 'Dry run: nothing is posted (add --post to post).');
  const totals = { moments: 0, pulse: 0, already: 0, left: 0, failed: 0 };
  for (const line of manifest.lines) {
    if (onlyAccount && line.account !== onlyAccount) continue;
    const who = await account(line.account);
    const problem = lineProblem(line, who);
    if (problem) {
      console.log(`  left out   ${lineName(line)}: ${problem}`);
      totals.left += 1;
      continue;
    }
    const [mExisting, pExisting] = await Promise.all([existingMoment(who.user.id, line), existingPulse(who.user.id, line)]);
    const moment = await momentPlan(line, who, mExisting);
    const pulse = pulsePlan(line, pExisting);
    const parts = [];
    const half = (name, plan, words) => (!plan.skip ? words : plan.done ? `${name} ${plan.skip}` : `${name} left out: ${plan.skip}`);
    if (moment) parts.push(half('Moment', moment, moment.skip ? '' : await describeMoment(line, moment, who.user)));
    if (pulse) parts.push(half('Pulse', pulse, `Pulse ${pulse.kind} pinned where it was taken ("Photo taken here")`));
    const postsSomething = (moment && !moment.skip) || (pulse && !pulse.skip) || pulse?.needsMedia;
    const allDone = [moment, pulse].filter(Boolean).every((half) => half.done);
    if (allDone) totals.already += 1; else if (!postsSomething) totals.left += 1;
    console.log(`  ${postsSomething ? (post ? 'posting   ' : 'would post') : allDone ? 'already   ' : 'left out  '} ${lineName(line)}: ${parts.join('; ')}`);
    if (!post || !postsSomething) continue;
    line.posted = line.posted || {};
    if (moment && !moment.skip) {
      try {
        const made = await postMoment(line, who, moment.days, Boolean(moment.resume));
        Object.assign(line.posted, { moment_id: made.id, moment_at: new Date().toISOString() });
        totals.moments += 1;
        console.log(`             Moment ${made.id}: ${made.state}${made.check ? ` (picture check: ${made.check})` : ''}`);
      } catch (error) {
        totals.failed += 1;
        console.log(`             Moment not posted: ${error.message}`);
      }
      writeManifest(manifest);
    }
    if (pulse?.needsMedia) {
      try {
        await uploadPulseMedia(who.user, pExisting.id, line);
        console.log(`             post ${pExisting.id}: its photo attached`);
      } catch (error) {
        totals.failed += 1;
        console.log(`             post ${pExisting.id}: ${error.message}`);
      }
    } else if (pulse && !pulse.skip) {
      try {
        const made = await postPulse(line, who, pulse.kind);
        Object.assign(line.posted, { pulse_post_id: made.id, pulse_at: new Date().toISOString() });
        totals.pulse += 1;
        console.log(`             post ${made.id} at ${made.tag}`);
      } catch (error) {
        totals.failed += 1;
        console.log(`             post not made: ${error.message}`);
      }
      writeManifest(manifest);
      await sleep(PULSE_PAUSE_MS);
    }
  }
  console.log(post
    ? `\nPosted ${totals.moments} Moments and ${totals.pulse} Pulse posts; ${totals.already} lines were already posted, ${totals.left} left out, ${totals.failed} failed.`
    : `\n${totals.already} lines already posted, ${totals.left} left out. Add --post to post the rest.`);
}

// ─── undo ───────────────────────────────────────────────────

async function undo() {
  const manifest = readManifest();
  if (!manifest) die('no manifest in this folder.');
  const yes = flag('--yes');
  console.log(yes ? 'Ending this tool\'s Moments and removing its Pulse posts.' : 'Dry run: nothing changes (add --yes).');
  let count = 0;
  for (const line of manifest.lines) {
    if (onlyAccount && line.account !== onlyAccount) continue;
    const who = await account(line.account);
    if (!who.user) continue;
    // Only the ids this tool gives (from the account and the file), so nothing else is ever touched.
    const moment = await existingMoment(who.user.id, line);
    const pulse = await existingPulse(who.user.id, line);
    const live = moment && store.momentState(moment) !== 'ended';
    const up = pulse && !pulse.archived_at;
    if (!live && !up) continue;
    count += 1;
    console.log(`  ${yes ? 'undoing ' : 'would undo'} ${lineName(line)}:${live ? ` Moment ${moment.id}` : ''}${up ? ` post ${pulse.id}` : ''}`);
    if (!yes) continue;
    if (live) await store.deleteMoment(moment);
    if (up) {
      const { call } = await pulseRoutes();
      const answer = await call(who.user, 'DELETE', `/posts/${pulse.id}`);
      if (answer.status !== 200) console.log(`             post ${pulse.id} not removed (${answer.status}: ${answer.body?.error || 'no reason'})`);
    }
    line.undone_at = new Date().toISOString();
    writeManifest(manifest);
  }
  console.log(`\n${count} lines ${yes ? 'undone' : 'would be undone'}.`);
}

const main = { prepare, run, undo }[command];
main().then(() => {
  if (routes) routes.close();
  process.exit(0);
}, (error) => die(error.stack || error.message));
