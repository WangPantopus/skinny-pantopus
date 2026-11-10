#!/usr/bin/env node
/**
 * Posts a text Moment as the Pantopus curator (the account the seeder posts as), for real local happenings the empty
 * map risk calls for: markets, road work, events (Moments proposal, "Risks"). It shows on the Moments map as the
 * Pantopus mark, takes reactions and reports, and no replies (the curator takes no messages).
 *
 * usage, from backend/ with the backend's environment:
 *   node scripts/post-curator-moment.js --text "Farmers market today 9-3" --lat 45.6265 --lng -122.6750
 *     [--hours 1|6|24|48 (24)] [--background teal|sky|green|amber|rose|slate (teal)] [--area] [--label "Esther Short Park"]
 *     [--confirm-remote]
 *   --area shows the approximate area (and the town's name) instead of the exact spot; --label names the spot
 *   yourself instead of looking it up (never a street address). A non-local stack needs --confirm-remote.
 */

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const die = (message) => { console.error(`post-curator-moment: ${message}`); process.exit(1); };

const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(process.env.SUPABASE_URL || '');
if (!local && !args.includes('--confirm-remote')) die('SUPABASE_URL is not a local stack; pass --confirm-remote to post there.');

const text = String(opt('--text') || '').trim();
const latitude = Number(opt('--lat'));
const longitude = Number(opt('--lng'));
const hours = Number(opt('--hours') || 24);
const background = opt('--background') || 'teal';
const showArea = args.includes('--area');
const label = opt('--label');

const store = require('../services/moments/momentStore');
const momentPlace = require('../services/moments/momentPlace');
const db = require('../config/supabaseAdmin');

if (!text || text.length > 200) die('--text is required, up to 200 characters.');
if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
  die('--lat and --lng are required.');
}
if (!store.HOURS.includes(hours)) die(`--hours must be one of ${store.HOURS.join(', ')}.`);
if (!store.BACKGROUNDS.includes(background)) die(`--background must be one of ${store.BACKGROUNDS.join(', ')}.`);
if (label && /^\s*\d+[a-z]?(?:-\d+)?\s+\S/i.test(label)) die('--label must name a place or a town, never a street address.');

async function main() {
  const { data: curator, error } = await db.from('User').select('id').eq('account_type', 'curator').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!curator) die('This stack has no Pantopus curator account (User.account_type = curator).');
  const labels = label ? { place_label: label, area_label: (await momentPlace.labelsAt(latitude, longitude)).area_label }
    : await momentPlace.labelsAt(latitude, longitude);
  const { row } = await store.insertMoment(store.newMomentRow({
    userId: curator.id,
    accountType: 'curator',
    kind: 'text',
    hours,
    audience: 'nearby',
    showArea,
    atHome: false,
    caption: null,
    text,
    background,
    location: { source: 'gps', latitude, longitude, fix_at: new Date().toISOString() },
    labels,
  }));
  console.log(`Posted Moment ${row.id} at ${row.location_name} until ${row.story_expires_at}`);
}

main().then(() => process.exit(0), (e) => die(e.message));
