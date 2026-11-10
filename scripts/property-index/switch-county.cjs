#!/usr/bin/env node
// Moves counties between off, shadow and live for one environment, withholds some of their facts, or turns their owners'
// value estimates on or off, with one change:
// their lines in that environment's switch file, which that environment's servers follow within about a minute
// (backend/services/propertyRecords/router.js). No release and no restart. Run by hand through
// .github/workflows/property-index.yml, which holds the storage key; a local rig passes --root.
//
//   node scripts/property-index/switch-county.cjs --county 53011 --mode live --target production --bucket <name> [--prefix index]
//   node scripts/property-index/switch-county.cjs --county 53011,48113,12086 --mode live --target production --bucket <name>
//   node scripts/property-index/switch-county.cjs --county 53011 --mode off --target local --root <dir>
//     --withhold sale_price,sale_date   these facts stay off its screens (stored copies keep them); `none` brings them all back
//     --estimates on|off   a live county's owners see a Pantopus estimate, or don't (backend/services/propertyRecords/valueEstimate.js)
//   Leave out --mode to keep its mode.
//   node scripts/property-index/switch-county.cjs --shared-facts --county 17031 --mode live --target production --bucket <name>
//     --shared-facts with --mode live or off: an address with several homes on record in the county shows what all of
//     them agree on (year built, size, bedrooms, baths), or doesn't. Only the file's shared_facts list changes; the
//     county's own line stays as it is (backend/services/propertyRecords/identity.js and router.js).
//   node scripts/property-index/switch-county.cjs --similar-homes --county 53011 --mode live --target production --bucket <name>
//     --similar-homes with --mode live or off: a house's owner in the county sees its county value beside similar houses
//     on its street, or doesn't (backend/services/propertyRecords/similarHomes.js). Only the file's similar_homes list changes.
//
// A list changes every county in it or none: one refused county refuses the whole run, and the file is written once.
// Shadow and live take only a county whose release holds homes; off takes any county.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { statePath, releasePath, switchesPath } = require('../../backend/services/propertyRecords/format');
const { FACTS } = require('../../backend/services/propertyRecords/facts');
const { stateOfCounty } = require('../../backend/services/propertyRecords/addressKey');
const { log } = require('./lib/log.cjs');

const opt = (name) => { const i = process.argv.indexOf(name); return (i > 0 && process.argv[i + 1]) || ''; };
const refuse = (why) => { console.error(why); process.exit(2); };

const counties = [...new Set(opt('--county').split(',').map((code) => code.trim()).filter(Boolean))];
const mode = opt('--mode').trim();
const target = opt('--target').trim();
const withhold = opt('--withhold').trim();
const estimates = opt('--estimates').trim();
const sharedFacts = process.argv.includes('--shared-facts');
const similarHomes = process.argv.includes('--similar-homes');
// A list beside the counties' lines, changed by itself: [the file's key, what the log calls it].
const list = (sharedFacts && ['shared_facts', 'shared facts']) || (similarHomes && ['similar_homes', 'similar homes']) || null;
const root = opt('--root');
const remote = `s3://${opt('--bucket')}/${opt('--prefix') || 'index'}`;

if (!counties.length) refuse('A county is its five-digit FIPS code');
if (mode && !['off', 'shadow', 'live'].includes(mode)) refuse('A county is off, shadow or live');
if (!/^[a-z]+$/.test(target)) refuse('Name the environment: production or staging');
if (estimates && !['on', 'off'].includes(estimates)) refuse('Estimates are on or off');
if (sharedFacts && similarHomes) refuse('One list at a time: --shared-facts or --similar-homes');
if (list && !['live', 'off'].includes(mode)) refuse(`${list[1][0].toUpperCase()}${list[1].slice(1)} are live or off: pass --mode live or --mode off`);
if (list && (withhold || estimates)) refuse(`${list[1][0].toUpperCase()}${list[1].slice(1)} change by themselves: leave out --withhold and --estimates`);
if (!mode && !withhold && !estimates) refuse('Nothing to change: pass --mode, --withhold, --estimates or several');
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

const problems = [];
const known = counties.filter((county) => {
  if (!/^\d{5}$/.test(county)) problems.push(`${county} isn't a five-digit FIPS code`);
  else if (!stateOfCounty(county)) problems.push(`No state has county code ${county}`);
  else return true;
  return false;
});

/** How many houses and units a release's report counts: its other records are land, buildings and non-homes. Null with no report. */
function homesIn(county, release) {
  const report = read(`${releasePath(county, release)}/report.json`);
  if (!report) return null;
  return Object.entries(JSON.parse(report).fill || {}).filter(([group]) => /^(property|unit):/.test(group)).reduce((sum, [, { records }]) => sum + records, 0);
}

// A wrong code would quietly do nothing, so a county with no release can't be turned on. Nor can one whose release holds
// no homes, only parcels or other records: every lookup there would find no home.
const releases = new Map();
if (mode === 'shadow' || mode === 'live') {
  const stateFiles = new Map();
  for (const county of known) {
    const state = stateOfCounty(county);
    if (!stateFiles.has(state)) stateFiles.set(state, JSON.parse(read(statePath(state)) || '{}'));
    const entry = stateFiles.get(state).jurisdictions?.[county];
    const homes = entry && entry.status !== 'withdrawn' ? homesIn(county, entry.release) : null;
    if (!entry) problems.push(`${county} has no release in ${state}'s file`);
    else if (entry.status === 'withdrawn') problems.push(`${county}'s source was withdrawn`);
    else if (homes === null) problems.push(`${county}'s release ${entry.release} has no report to show it holds homes`);
    else if (!homes) problems.push(`${county}'s release ${entry.release} holds no homes, only parcels or other records`);
    else releases.set(county, entry);
  }
}

const name = switchesPath(target);
const text = read(name);
const file = text ? JSON.parse(text) : { v: 1, counties: {} };
if (file.v !== 1 || !file.counties) refuse('A switch file this tool can\'t read');

const changes = list ? [] : known.map((county) => {
  const before = file.counties[county] || { mode: 'off (not named)' };
  const next = { ...before, ...(mode ? { mode } : {}), ...(withheld ? { withheld } : {}), ...(estimates ? { estimates: estimates === 'on' } : {}) };
  if (!['off', 'shadow', 'live'].includes(next.mode)) problems.push(`${county} is named for the first time, so it needs --mode`);
  if (!next.withheld?.length) delete next.withheld;
  if (!next.estimates) delete next.estimates;
  return { county, before, next };
});

if (problems.length) {
  for (const problem of problems) console.error(problem);
  refuse(`Nothing changed: ${problems.length} of ${counties.length} refused`);
}

// The lists sit beside the counties' lines; a file without one has it off everywhere.
const named = new Set((list && file[list[0]]) || []);
const namedBefore = new Map(known.map((county) => [county, named.has(county) ? 'live' : 'off']));
if (list) {
  for (const county of known) {
    if (mode === 'live') named.add(county);
    else named.delete(county);
  }
  if (named.size) file[list[0]] = [...named].sort();
  else delete file[list[0]];
}
for (const { county, next } of changes) file.counties[county] = next;
file.updated_at = new Date().toISOString();
write(name, `${JSON.stringify(file, null, 1)}\n`);

const count = (wanted) => Object.values(file.counties).filter((entry) => entry.mode === wanted).length;
for (const { county, before, next } of changes) {
  const release = releases.get(county);
  log(`${target}: ${county} ${before.mode} -> ${next.mode}${release ? `, release ${release.release} as of ${release.as_of}` : ''}; withheld: ${(next.withheld || []).join(', ') || 'none'}; estimates: ${next.estimates ? (next.mode === 'live' ? 'on' : 'on once live') : 'off'}`);
}
if (list) {
  for (const county of known) {
    const line = file.counties[county]?.mode || 'off (not named)';
    log(`${target}: ${county} ${list[1]} ${namedBefore.get(county)} -> ${mode}; the county is ${line}${line === 'live' ? '' : ', so they show once it is live'}`);
  }
}
log(`${target} now names ${count('live')} live, ${count('shadow')} shadow, ${count('off')} off, estimates on in ${Object.values(file.counties).filter((entry) => entry.estimates).length}, shared facts in ${(file.shared_facts || []).length}, similar homes in ${(file.similar_homes || []).length}; servers follow within about a minute`);
