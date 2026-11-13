#!/usr/bin/env node
// What changed at each address since the release serving: the registry's lineage events. An ID names what an address is, so
// a renumbered house gets a new ID, linked here to the old one when both sit on the same point. Written beside each new
// release as lineage.json.gz, before publishing. Identity is always worked out from the address asked about, so nothing
// private follows an ID; this is the record of what became what. Prints counts only.
//   node scripts/property-index/registry-lineage.cjs --out <dir> --state ST --bucket <name> [--republish]
//     --republish  the run publishes counties whose sources haven't changed, too (publish.cjs's flag), so they need lineage
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { releasePath, statePath } = require('../../backend/services/propertyRecords/format');
const { registryId } = require('../../backend/services/propertyRecords/registryFormat');
const { log } = require('./lib/log.cjs');
const { sameSources } = require('./lib/registry.cjs');

const SAME_POINT_METERS = 10;
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];

function subjects(dir, fips) {
  const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'manifest.json.gz'))).toString('utf8'));
  const data = fs.readFileSync(path.join(dir, 'data.bin'));
  const found = new Map();
  let at = 0;
  for (const length of manifest.lengths) {
    for (const record of JSON.parse(zlib.gunzipSync(data.subarray(at, at + length)).toString('utf8'))) {
      if (record.kind !== 'unit' && record.point) found.set(registryId(fips, record.kind, record.address), record.point);
    }
    at += length;
  }
  return found;
}

/** Old ID to new, for subjects gone from one release and new in the next at the same point. The rest are retired or new. */
function compare(before, after) {
  const gone = [...before.keys()].filter((id) => !after.has(id));
  const fresh = [...after.keys()].filter((id) => !before.has(id));
  const cell = ([lng, lat]) => `${Math.round(lng * 5000)},${Math.round(lat * 5000)}`;
  const byCell = new Map();
  for (const id of fresh) {
    const key = cell(after.get(id));
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(id);
  }
  const events = [];
  let retired = 0;
  const linked = new Set();
  for (const id of gone) {
    const point = before.get(id);
    const near = (byCell.get(cell(point)) || []).find((candidate) => {
      if (linked.has(candidate)) return false;
      const other = after.get(candidate);
      return Math.hypot((point[0] - other[0]) * Math.cos((point[1] * Math.PI) / 180) * 111320, (point[1] - other[1]) * 110540) <= SAME_POINT_METERS;
    });
    if (near) {
      linked.add(near);
      events.push({ type: 'replaced', from: id, to: near });
    } else retired += 1;
  }
  return { events, retired, added: fresh.length - linked.size, kept: before.size - gone.length };
}

function main() {
  const out = arg('--out');
  const state = arg('--state');
  const bucket = arg('--bucket');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lineage-'));
  const stateFile = path.join(scratch, 'state.json');
  const copy = (name, file) => execFileSync('aws', ['s3', 'cp', `s3://${bucket}/index/registry/${name}`, file, '--only-show-errors'], { stdio: ['ignore', 'ignore', 'ignore'] });
  try {
    copy(statePath(state), stateFile);
  } catch (_) {
    log(`${state}: no release serving, so no lineage yet`);
    return;
  }
  const serving = JSON.parse(fs.readFileSync(stateFile, 'utf8')).jurisdictions;
  const republish = process.argv.includes('--republish');
  const totals = { counties: 0, kept: 0, replaced: 0, retired: 0, added: 0, unchanged: 0 };
  for (const name of fs.readdirSync(path.join(out, 'counties'))) {
    const entry = JSON.parse(fs.readFileSync(path.join(out, 'counties', name), 'utf8'));
    const previous = serving[entry.fips];
    if (!previous) continue;
    // publish.cjs leaves a county whose sources haven't changed (same date, same rows from each) as it serves, so its new build is
    // never published: reading the release serving (a whole county from storage) would be for nothing.
    if (!republish && previous.as_of === entry.as_of && previous.status === 'active' && sameSources(previous, entry)) {
      totals.unchanged += 1;
      continue;
    }
    const dir = path.join(scratch, entry.fips);
    fs.mkdirSync(dir, { recursive: true });
    copy(`${releasePath(entry.fips, previous.release)}/manifest.json.gz`, path.join(dir, 'manifest.json.gz'));
    copy(`${releasePath(entry.fips, previous.release)}/data.bin`, path.join(dir, 'data.bin'));
    const release = path.join(out, releasePath(entry.fips, entry.release));
    const { events, retired, added, kept } = compare(subjects(dir, entry.fips), subjects(release, entry.fips));
    fs.writeFileSync(path.join(release, 'lineage.json.gz'), zlib.gzipSync(JSON.stringify({ from: previous.release, to: entry.release, events, retired, added, kept })));
    fs.rmSync(dir, { recursive: true, force: true });
    totals.counties += 1;
    totals.kept += kept;
    totals.replaced += events.length;
    totals.retired += retired;
    totals.added += added;
  }
  log(`${state} lineage: ${Object.entries(totals).map(([field, n]) => `${field} ${n}`).join(', ')}`);
}

try {
  main();
} catch (err) {
  // The record of what changed mustn't stop a release: the retention check does that.
  console.log(`Lineage failed: ${err.constructor === Error ? err.message : err.name}`);
}
