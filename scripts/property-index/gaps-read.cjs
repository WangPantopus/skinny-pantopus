#!/usr/bin/env node
// Lists one county's homes that miss a Property details field, from its missing-facts ledger in private storage
// (gaps.cjs writes it), for whoever researches those facts. It prints addresses, so it runs on your own terminal with
// the reader key and never in CI: nothing it prints goes in Git, a log, a PR or a chat.
//
//   node scripts/property-index/gaps-read.cjs <fips> <field> [--kind <kind>] [--research] [--limit <n>] [--env-file <file>]
//   node scripts/property-index/gaps-read.cjs --counts [<fips>]   the counts (no addresses): national by field, or one county's
//     <field>     a field id or its label, as in lib/gaps.cjs ("bedrooms", "Living area")
//     --kind      house, townhouse, mobile_home, home, condo_unit, small_multi_unit, building, condo_building
//     --research  leaves out homes where the county wrote zero, the next build fills the field from the record itself,
//                 or the unit's building record (at another address) holds it: none of those needs looking up
//     --env-file  a file holding PROPERTY_INDEX_AWS_ACCESS_KEY_ID and PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY, the reader key;
//                 never printed. Without it, aws uses your environment's credentials.
//     --bucket, --prefix  default $PROPERTY_INDEX_BUCKET or pantopus-property-index, and index
//     --root      a local copy of the index instead (gaps.cjs --root writes one)
// Output: id, parcel number, kind, address and a note, tab separated, one home a line; the totals go to stderr.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const path = require('node:path');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { execFileSync } = require('node:child_process');

function parseArgs(argv) {
  const opts = { prefix: 'index', bucket: process.env.PROPERTY_INDEX_BUCKET || 'pantopus-property-index', limit: Infinity, positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--kind') opts.kind = argv[++i];
    else if (argv[i] === '--research') opts.research = true;
    else if (argv[i] === '--limit') opts.limit = Number(argv[++i]);
    else if (argv[i] === '--env-file') opts.envFile = argv[++i];
    else if (argv[i] === '--bucket') opts.bucket = argv[++i];
    else if (argv[i] === '--prefix') opts.prefix = argv[++i];
    else if (argv[i] === '--root') opts.root = argv[++i];
    else if (argv[i] === '--counts') opts.counts = true;
    else if (argv[i].startsWith('--')) throw new Error('usage: see the top of gaps-read.cjs');
    else opts.positional.push(argv[i]);
  }
  [opts.fips, opts.field] = opts.positional;
  if (!opts.counts && (!opts.fips || !opts.field)) throw new Error('usage: see the top of gaps-read.cjs');
  return opts;
}

/** The environment aws runs in: the reader key from its file, if one is named. */
function awsEnv(envFile) {
  const env = { ...process.env, AWS_DEFAULT_REGION: process.env.PROPERTY_INDEX_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2' };
  if (!envFile) return env;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const at = line.indexOf('=');
    const name = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim().replace(/^["']|["']$/g, '');
    if (name === 'PROPERTY_INDEX_AWS_ACCESS_KEY_ID') env.AWS_ACCESS_KEY_ID = value;
    if (name === 'PROPERTY_INDEX_AWS_SECRET_ACCESS_KEY') env.AWS_SECRET_ACCESS_KEY = value;
  }
  return env;
}

/** lib/gaps.cjs takedownsId: which takedown list a ledger was written against, null for none. */
function takedownsId(suppressions) {
  if (!suppressions?.hashes?.length) return null;
  return crypto.createHash('sha256').update(JSON.stringify([suppressions.salt, [...suppressions.hashes].sort()])).digest('hex').slice(0, 16);
}

const sum = (table) => Object.values(table || {}).reduce((total, n) => total + n, 0);
const fieldTotals = (county, table) => {
  const totals = {};
  for (const fields of Object.values(county[table] || {})) for (const [id, n] of Object.entries(fields)) totals[id] = (totals[id] || 0) + n;
  return totals;
};

function printCounts(national, fips) {
  const counties = fips ? [national.counties[fips]].filter(Boolean) : Object.values(national.counties);
  if (!counties.length) throw new Error(`No ledger for ${fips}`);
  const labels = Object.fromEntries(national.rule.fields);
  const homes = counties.reduce((total, county) => total + sum(county.homes), 0);
  const kinds = {};
  for (const county of counties) for (const [kind, n] of Object.entries(county.homes)) kinds[kind] = (kinds[kind] || 0) + n;
  const add = (table) => {
    const totals = {};
    for (const county of counties) for (const [id, n] of Object.entries(fieldTotals(county, table))) totals[id] = (totals[id] || 0) + n;
    return totals;
  };
  const [missing, zero, next, building] = ['missing', 'zero', 'next_build', 'on_building_record'].map(add);
  // Of the homes each field applies to: a field doesn't apply to every kind (lib/gaps.cjs).
  const applies = (id) => Object.entries(kinds).reduce((total, [kind, n]) => total + (national.rule.kinds[kind]?.fields.includes(id) ? n : 0), 0);
  console.log(`${fips ? `${counties[0].name}, ${counties[0].state} (${fips}), release ${counties[0].release}` : `${counties.length} counties`}: ${homes} homes`);
  console.log(['field', 'homes it applies to', 'missing', 'share', 'county wrote 0', 'next build fills', 'on building record', 'to look up'].join('\t'));
  for (const [id, n] of Object.entries(missing).sort((a, b) => b[1] - a[1])) {
    const research = n - (zero[id] || 0) - (next[id] || 0) - (building[id] || 0);
    console.log([labels[id] || id, applies(id), n, `${((100 * n) / (applies(id) || 1)).toFixed(1)}%`, zero[id] || 0, next[id] || 0, building[id] || 0, research].join('\t'));
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (process.env.CI || process.env.GITHUB_ACTIONS) throw new Error('This prints addresses: run it on your own terminal, never in CI');
  const env = awsEnv(opts.envFile);
  const url = (name) => `s3://${opts.bucket}/${opts.prefix}/${name}`;
  const copy = (name, file) => (opts.root
    ? fs.copyFileSync(path.join(opts.root, name), file)
    : execFileSync('aws', ['s3', 'cp', url(name), file, '--only-show-errors'], { env, stdio: ['ignore', 'ignore', 'inherit'] }));
  const read = (name) => {
    if (opts.root) return fs.existsSync(path.join(opts.root, name)) ? fs.readFileSync(path.join(opts.root, name), 'utf8') : null;
    try {
      return execFileSync('aws', ['s3', 'cp', url(name), '-', '--only-show-errors'], { env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
    } catch (err) {
      // Only "not there" means none: a takedown list that can't be read stops here rather than count as empty.
      if (/\(404\)/.test(String(err.stderr))) return null;
      throw new Error(`Could not read ${name} from storage`);
    }
  };
  const national = JSON.parse(read('gaps/counts.json') || 'null');
  if (!national) throw new Error('No missing-facts ledger there yet (gaps/counts.json)');
  if (opts.counts) {
    printCounts(national, opts.fips);
    return;
  }
  const county = national.counties[opts.fips];
  if (!county) throw new Error(`No ledger for ${opts.fips}`);
  const wanted = opts.field.toLowerCase();
  const field = national.rule.fields.find(([id, label]) => id === wanted || label.toLowerCase() === wanted);
  if (!field) throw new Error(`No field ${opts.field}; the fields are ${national.rule.fields.map(([id]) => id).join(', ')}`);
  const [id, label] = field;
  if (opts.kind && !national.rule.kinds[opts.kind]) throw new Error(`No kind ${opts.kind}; the kinds are ${Object.keys(national.rule.kinds).join(', ')}`);
  // Addresses taken down since the ledger was written may still be in it: the next publish writes it again.
  if ((county.takedowns ?? null) !== takedownsId(JSON.parse(read('suppressions.json') || 'null'))) {
    throw new Error(`${county.name}'s ledger is from before the latest takedown; it lists homes again once a publish rewrites it`);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gaps-read-'));
  const file = path.join(dir, 'ledger.jsonl.gz');
  try {
    copy(`gaps/${opts.fips}/${county.release}.jsonl.gz`, file);
    fs.chmodSync(file, 0o600);
    let found = 0;
    let shownCount = 0;
    let skipped = 0;
    const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      const row = JSON.parse(line);
      if (row.ledger || !row.missing.includes(id) || (opts.kind && row.kind !== opts.kind)) continue;
      found += 1;
      const note = [row.zero?.includes(id) && 'county wrote 0', row.next_build?.includes(id) && 'next build fills it', row.on_building_record?.includes(id) && 'its building record has it'].filter(Boolean).join('; ');
      if (opts.research && note) {
        skipped += 1;
        continue;
      }
      if (shownCount < opts.limit) {
        shownCount += 1;
        console.log([row.id, row.apn || '', row.kind, row.address, note].join('\t'));
      }
    }
    console.error(`${county.name}, ${county.state} (${opts.fips}), release ${county.release}: ${found} homes${opts.kind ? ` (${opts.kind})` : ''} miss ${label}${opts.research ? `, ${skipped} need no lookup` : ''}; ${shownCount} listed`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.constructor === Error ? err.message : err.name);
  process.exit(1);
});
