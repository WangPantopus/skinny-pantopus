#!/usr/bin/env node
/**
 * Test Moments on a local stack (Moments build, 2026-11-08): six people and the Pantopus curator around downtown
 * Vancouver, WA, with all three kinds (photo, video, text card), a crowded spot at Esther Short Park, one person at two
 * spots, one Moment shown as an area and one for connections only. Rows and files go through the Moments services
 * (services/moments), so they are what the routes make; their picture check is marked skipped (test pictures).
 *
 * Local stacks only: refuses unless SUPABASE_URL is 127.0.0.1 or localhost. The people are test accounts
 * (qa-moments-<role>-<random>@example.com, 18+ confirmed, a Local Profile, two with a photo) made once and reused;
 * the Moments an earlier run made are ended and reposted on every run (others, like the curator tool's, are left).
 * Their sign-ins go to --accounts-file (mode 600) when given.
 *
 * usage, from backend/ with the backend's environment (a kit launcher's):
 *   node scripts/seed-moments.js [--media-dir <dir>] [--accounts-file <path>] [--viewers <id,id>] [--clear]
 *     --media-dir      photos (*.jpg|*.png) and videos (*.mp4|*.mov, poster <name>-poster.jpg or <name>.jpg beside it,
 *                      frames <name>-frame1.jpg …); without it, photos are drawn and the video Moments are skipped
 *     --viewers        user ids that get the `moments` flag and have already watched two of the Moments (gray rings)
 *     --clear          only end the Moments earlier runs made
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const url = process.env.SUPABASE_URL || '';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
  console.error('seed-moments: SUPABASE_URL is not a local stack; refusing (test data only).');
  process.exit(1);
}

const db = require('../config/supabaseAdmin');
const store = require('../services/moments/momentStore');
const upload = require('../services/moments/momentUpload');
const s3 = require('../services/s3Service');

const AREA = 'Vancouver, WA';
const SPOTS = {
  park: { latitude: 45.62648, longitude: -122.674977, label: 'Esther Short Park' },
  library: { latitude: 45.62849, longitude: -122.668826, label: 'Vancouver Community Library' },
  pier: { latitude: 45.623703, longitude: -122.681125, label: 'Grant Street Pier' },
  thirteenth: { latitude: 45.63175, longitude: -122.67385, label: 'West 13th Street' },
  kiggins: { latitude: 45.629286, longitude: -122.671296, label: 'Kiggins Theatre' },
  cityHall: { latitude: 45.625376, longitude: -122.675506, label: 'Vancouver City Hall' },
};
// Sample people (not the boards' names, which MOMLEAD's accounts use). `photo` gets a drawn profile picture.
const PEOPLE = [
  { role: 'grace', first: 'Grace', last: 'Kim', photo: '#0EA5E9' },
  { role: 'owen', first: 'Owen', last: 'Park' },
  { role: 'lena', first: 'Lena', last: 'Ortiz', photo: '#F59E0B' },
  { role: 'theo', first: 'Theo', last: 'Brooks' },
  { role: 'maya', first: 'Maya', last: 'Chen' },
  { role: 'sam', first: 'Sam', last: 'Rivera' },
];
// [who, spot, kind, minutes ago, hours, extra]
const MOMENTS = [
  ['grace', 'park', 'photo', 120, 24, { caption: 'Farmers market colors', media: 'photo' }],
  ['owen', 'park', 'text', 35, 6, { text: 'The farmers market is packed today! Fresh peaches at the north end.', background: 'amber' }],
  ['lena', 'park', 'video', 60, 24, { caption: 'Live music by the bell tower', media: 'video' }],
  ['theo', 'park', 'text', 10, 1, { text: 'Free face painting by the playground until 2.', background: 'rose' }],
  ['owen', 'park', 'photo', 20, 6, { caption: 'Line for kettle corn', media: 'photo' }],
  ['maya', 'library', 'photo', 120, 24, { caption: 'View from the library terrace', media: 'photo' }],
  ['sam', 'pier', 'video', 35, 6, { caption: 'Walk on the Grant Street Pier', media: 'video' }],
  ['grace', 'thirteenth', 'text', 60, 24, { text: "Lost a blue mitten by the 13th Street bus stop. If you see it, I'd love it back!", background: 'sky' }],
  ['owen', 'kiggins', 'photo', 180, 48, { caption: 'Double feature tonight', media: 'photo', showArea: true }],
  ['maya', 'park', 'text', 15, 24, { text: 'Book club picnic on the north lawn at 4. Connections only!', background: 'green', audience: 'connections' }],
  ['curator', 'cityHall', 'text', 45, 24, { text: 'Road work on West 8th Street near City Hall through Friday. Expect one lane each way.', background: 'slate' }],
];

function readMedia(dir) {
  if (!dir) return { photos: [], videos: [] };
  const files = fs.readdirSync(dir).map((name) => path.join(dir, name));
  const isStill = (f) => /\.(jpe?g|png)$/i.test(f) && !/-(poster|frame\d)\.jpe?g$/i.test(f) && !/(^|\/)photo-old/i.test(f);
  const videos = files.filter((f) => /\.(mp4|mov)$/i.test(f) && !/long/i.test(f)).map((f) => {
    const base = f.replace(/\.(mp4|mov)$/i, '');
    const poster = [`${base}-poster.jpg`, `${base}.jpg`].find((p) => fs.existsSync(p));
    const frames = [1, 2].map((n) => `${base}-frame${n}.jpg`).filter((p) => fs.existsSync(p));
    return { path: f, poster, frames };
  }).filter((v) => v.poster);
  return { photos: files.filter(isStill), videos };
}

// A drawn test photo (a gradient with a label) when no media folder is given.
function drawnPhoto(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0F172A"/></linearGradient></defs>
    <rect width="1080" height="1920" fill="url(#g)"/>
    <text x="540" y="960" font-family="Helvetica" font-size="72" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

function avatar(initials, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/>
    <text x="200" y="250" font-family="Helvetica" font-size="160" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function findCurator() {
  const rows = await checked(db.from('User').select('id').eq('account_type', 'curator').limit(1));
  return rows[0]?.id || null;
}

// A test account for `role` (reused when one with that email prefix exists).
async function person({ role, first, last, photo }, accounts) {
  const prefix = `qa-moments-${role}-`;
  const existing = await checked(db.from('User').select('id, email').ilike('email', `${prefix}%@example.com`).limit(1));
  if (existing[0]) return existing[0].id;
  const suffix = crypto.randomBytes(3).toString('hex');
  const email = `${prefix}${suffix}@example.com`;
  const password = `Mo-${crypto.randomBytes(12).toString('base64url')}9!`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { qa: 'moments' } });
  if (error) throw new Error(`create ${role}: ${error.message}`);
  const id = data.user.id;
  const now = new Date().toISOString();
  await checked(db.from('User').insert({
    id, email, username: `qa_moments_${role}_${suffix}`, first_name: first, last_name: last, name: `${first} ${last}`,
    city: 'Vancouver', state: 'WA', onboarding_completed_at: now, adult_attested_at: now, role: 'user',
  }));
  let avatarUrl = null;
  if (photo) {
    const uploaded = await s3.uploadProfilePicture(await avatar(`${first[0]}${last[0]}`, photo), `${role}.png`, id, 'image/png');
    avatarUrl = uploaded.url;
    await checked(db.from('User').update({ profile_picture_url: avatarUrl }).eq('id', id));
  }
  await checked(db.from('LocalProfile').insert({
    user_id: id, handle: `moments_${role}_${suffix}`, handle_normalized: `moments_${role}_${suffix}`,
    display_name: `${first} ${last[0]}.`, avatar_url: avatarUrl,
  }));
  if (accounts) fs.appendFileSync(accounts, `MOMENTS_${role.toUpperCase()}_USER_ID=${id}\nMOMENTS_${role.toUpperCase()}_EMAIL=${email}\nMOMENTS_${role.toUpperCase()}_PASSWORD=${password}\n`, { mode: 0o600 });
  console.log(`made ${first} ${last}`);
  return id;
}

// Ends the Moments an earlier run made (tagged seed: true), never one posted another way (the curator tool's).
async function endMoments(userIds) {
  const rows = await checked(db.from('Post').select(store.MOMENT_SELECT).eq('is_story', true).in('user_id', userIds)
    .is('archived_at', null).eq('post_metadata->moment->>seed', 'true'));
  for (const row of rows) await store.deleteMoment(row);
  return rows.length;
}

async function addFlagUsers(ids) {
  const flag = (await checked(db.from('FeatureFlag').select('beta_user_ids').eq('flag_name', 'moments').limit(1)))[0];
  if (!flag) throw new Error('No `moments` feature flag row (migration 20261108210000).');
  const merged = [...new Set([...(flag.beta_user_ids || []), ...ids])];
  await checked(db.from('FeatureFlag').update({ beta_user_ids: merged, updated_at: new Date().toISOString() }).eq('flag_name', 'moments'));
}

async function main() {
  const accounts = opt('--accounts-file');
  const ids = {};
  for (const p of PEOPLE) ids[p.role] = await person(p, accounts);
  ids.curator = await findCurator();
  if (!ids.curator) console.log('No Pantopus curator account on this stack: its Moment is skipped.');
  const authorIds = Object.values(ids).filter(Boolean);
  console.log(`ended ${await endMoments(authorIds)} earlier test Moments`);
  if (args.includes('--clear')) return;
  await addFlagUsers(authorIds);
  // Mark Maya connected to Grace, so the connections-only card shows for Grace and nobody else seeded.
  const linked = await checked(db.from('Relationship').select('id').eq('status', 'accepted')
    .or(`and(requester_id.eq.${ids.maya},addressee_id.eq.${ids.grace}),and(requester_id.eq.${ids.grace},addressee_id.eq.${ids.maya})`));
  if (!linked.length) await checked(db.from('Relationship').insert({ requester_id: ids.maya, addressee_id: ids.grace, status: 'accepted', responded_at: new Date().toISOString(), accepted_at: new Date().toISOString() }));

  const library = readMedia(opt('--media-dir'));
  let photoTurn = 0;
  let videoTurn = 0;
  const made = [];
  for (const [who, spotName, kind, ago, hours, extra] of MOMENTS) {
    const userId = ids[who];
    if (!userId) continue;
    let files = null;
    if (extra.media === 'video') {
      const video = library.videos[videoTurn++ % Math.max(library.videos.length, 1)];
      if (!video) { console.log(`no video in --media-dir: skipped ${who}'s video`); continue; }
      const file = (p, type) => { const buffer = fs.readFileSync(p); return { buffer, mimetype: type, size: buffer.length, originalname: path.basename(p) }; };
      files = {
        file: file(video.path, /\.mov$/i.test(video.path) ? 'video/quicktime' : 'video/mp4'),
        poster: file(video.poster, 'image/jpeg'),
        frames: video.frames.map((f) => file(f, 'image/jpeg')),
      };
    } else if (extra.media === 'photo') {
      const source = library.photos[photoTurn++ % Math.max(library.photos.length, 1)];
      const buffer = source ? fs.readFileSync(source) : await drawnPhoto(extra.caption, ['#0369A1', '#16A34A', '#E11D48'][photoTurn % 3]);
      files = { file: { buffer, mimetype: source && /\.png$/i.test(source) ? 'image/png' : 'image/jpeg', size: buffer.length, originalname: 'photo.jpg' } };
    }
    const spot = SPOTS[spotName];
    const createdAt = new Date(Date.now() - ago * 60 * 1000);
    const row = store.newMomentRow({
      userId,
      accountType: who === 'curator' ? 'curator' : 'user',
      kind,
      hours,
      audience: extra.audience || 'nearby',
      showArea: Boolean(extra.showArea),
      atHome: false,
      caption: extra.caption || null,
      text: extra.text || null,
      background: extra.background || 'teal',
      location: { source: 'gps', latitude: spot.latitude, longitude: spot.longitude, fix_at: createdAt.toISOString() },
      labels: { place_label: spot.label, area_label: AREA },
      createdAt,
    });
    row.post_metadata.moment.seed = true;
    const { row: saved } = await store.insertMoment(row);
    if (files) {
      const prepared = await upload.prepareFiles(kind, files);
      const media = await upload.storeFiles(saved, prepared);
      // Live since it was posted (the seed stands in for an upload that finished then).
      await store.updateMoment(saved, {
        story_expires_at: new Date(createdAt.getTime() + hours * store.HOUR_MS).toISOString(),
        moment: { media, state: 'live', check: { status: 'skipped', reasons: [], checked_at: new Date().toISOString(), attempts: 0 } },
      });
    }
    made.push(saved.id);
    console.log(`${who}: ${kind} at ${spot.label}${extra.showArea ? ' (area)' : ''}${extra.audience === 'connections' ? ' (connections)' : ''}`);
  }

  const viewers = (opt('--viewers') || '').split(',').map((v) => v.trim()).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (viewers.length) {
    await addFlagUsers(viewers);
    for (const viewer of viewers) {
      for (const id of made.slice(0, 2)) await db.rpc('record_post_unique_view', { p_post_id: id, p_user_id: viewer });
    }
    console.log(`${viewers.length} viewer(s) watched the first two`);
  }
  console.log(`seeded ${made.length} Moments`);
}

main().then(() => process.exit(0), (error) => { console.error(`seed-moments: ${error.message}`); process.exit(1); });
