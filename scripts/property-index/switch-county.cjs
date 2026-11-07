#!/usr/bin/env node
// Moves one county between off, shadow and live for one environment, or withholds some of its facts, with one change:
// its line in that environment's switch file, which that environment's servers follow within about a minute
// (backend/services/propertyRecords/router.js). No release and no restart. Run by hand through
// .github/workflows/property-index.yml, which holds the storage key; a local rig passes --root.
//
//   node scripts/property-index/switch-county.cjs --county 53011 --mode live --target production --bucket <name> [--prefix index]
//   node scripts/property-index/switch-county.cjs --county 53011 --mode off --target local --root <dir>
//     --withhold sale_price,sale_date   these facts stay off its screens (stored copies keep them); `none` brings them all back
//   Leave out --mode to keep its mode.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { statePath, switchesPath } = require('../../backend/services/propertyRecords/format');
const { FACTS } = require('../../backend/services/propertyRecords/facts');
const { stateOfCounty } = require('../../backend/services/propertyRecords/addressKey');
const { log } = require('./lib/log.cjs');

const opt = (name) => { const i = process.argv.indexOf(name); return (i > 0 && process.argv[i + 1]) || ''; };
const refuse = (why) => { console.error(why); process.exit(2); };

const county = opt('--county').trim();
const mode = opt('--mode').trim();
const target = opt('--target').trim();
const withhold = opt('--withhold').trim();
const root = opt('--root');
const remote = `s3://${opt('--bucket')}/${opt('--prefix') || 'index'}`;

if (!/^\d{5}$/.test(county)) refuse('A county is its five-digit FIPS code');
if (!stateOfCounty(county)) refuse('No state has that county code');
if (mode && !['off', 'shadow', 'live'].includes(mode)) refuse('A county is off, shadow or live');
if (!/^[a-z]+$/.test(target)) refuse('Name the environment: production or staging');
if (!mode && !withhold) refuse('Nothing to change: pass --mode, --withhold or both');
if (!root && !opt('--bucket')) refuse('Pass --bucket, or --root for a local rig');

function read(name) {
  if (root) return fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name), 'utf8') : null;
  try {
    return execFileSync('aws', ['s3', 'cp', `${remote}/${name}`, '-', '--only-show-errors'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    // Only an absent file reads as nothing: any other failure must not write over the other counties' lines.
    if (String(err.stderr).includes('(404)')) return null;
    throw err;
  }
}

function write(name, text) {
  const file = root ? path.join(root, name) : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'switch-')), 'switches.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
  if (!root) execFileSync('aws', ['s3', 'cp', file, `${remote}/${name}`, '--only-show-errors', '--content-type', 'application/json', '--cache-control', 'no-cache'], { stdio: 'inherit' });
}

const withheld = withhold === 'none' ? [] : withhold ? withhold.split(',').map((name) => name.trim()).filter(Boolean) : null;
for (const name of withheld || []) if (!FACTS[name]) refuse(`No fact is called ${name}`);

// A wrong code would quietly do nothing, so a county with no release can't be turned on.
if (mode === 'shadow' || mode === 'live') {
  const state = stateOfCounty(county);
  const stateText = read(statePath(state));
  const entry = stateText && JSON.parse(stateText).jurisdictions?.[county];
  if (!entry) refuse(`${county} has no release in ${state}'s file`);
  if (entry.status === 'withdrawn') refuse(`${county}'s source was withdrawn`);
  log(`${county} serves release ${entry.release}, as of ${entry.as_of}`);
}

const name = switchesPath(target);
const text = read(name);
const file = text ? JSON.parse(text) : { v: 1, counties: {} };
if (file.v !== 1 || !file.counties) refuse('A switch file this tool can\'t read');
const before = file.counties[county] || { mode: 'off (not named)' };
const next = { ...before, ...(mode ? { mode } : {}), ...(withheld ? { withheld } : {}) };
if (!['off', 'shadow', 'live'].includes(next.mode)) refuse('A county named for the first time needs --mode');
if (!next.withheld?.length) delete next.withheld;
file.counties[county] = next;
file.updated_at = new Date().toISOString();
write(name, `${JSON.stringify(file, null, 1)}\n`);

const count = (wanted) => Object.values(file.counties).filter((entry) => entry.mode === wanted).length;
log(`${target}: ${county} ${before.mode} -> ${next.mode}; withheld: ${(next.withheld || []).join(', ') || 'none'}`);
log(`${target} now names ${count('live')} live, ${count('shadow')} shadow, ${count('off')} off; servers follow within about a minute`);
