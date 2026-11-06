'use strict';
// OpenAddresses: local governments' address files, one source at a time, for what the National Address Database and
// Overture don't have. Only the sources openaddresses-rights.json clears are read (rights.cjs says how it's kept).
// One line of GeoJSON per address: https://batch.openaddresses.io

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { download, USER_AGENT } = require('../../lib/tables.cjs');
const { log } = require('../../lib/log.cjs');
const cleared = require('./openaddresses-rights.json');

const LIST_URL = 'https://batch.openaddresses.io/api/data?layer=addresses';
const fileUrl = (job) => `https://v2.openaddresses.io/batch-prod/job/${job}/source.geojson.gz`;

/** A source's state, from its name: us/wa/clark is WA; vi/statewide is its own. */
function stateOf(name) {
  const [country, state] = name.split('/');
  return (country === 'us' ? state : country).toUpperCase();
}

async function* rows({ work, states = null }) {
  const response = await fetch(LIST_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`OpenAddresses's list answered ${response.status}`);
  const jobs = new Map();
  for (const entry of await response.json()) {
    if (entry.job && entry.output?.output && !jobs.has(entry.source)) jobs.set(entry.source, entry.job);
  }
  let missing = 0;
  let read = 0;
  for (const [name, about] of Object.entries(cleared.sources)) {
    if (!about.use) continue;
    const state = stateOf(name);
    if (states && !states.has(state)) continue;
    const job = jobs.get(name);
    if (!job) {
      missing += 1;
      continue;
    }
    const file = path.join(work, 'openaddresses', `${name.replace(/\//g, '-')}.geojson.gz`);
    try {
      download(fileUrl(job), file);
    } catch (err) {
      missing += 1;
      continue;
    }
    const input = fs.createReadStream(file).pipe(zlib.createGunzip());
    for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
      if (!line) continue;
      const { properties: address, geometry } = JSON.parse(line);
      if (geometry?.type !== 'Point') continue;
      yield {
        source: `openaddresses:${name}`,
        record: address.hash || '',
        state,
        number: address.number,
        name: address.street,
        unit: address.unit,
        city: address.city,
        zip: address.postcode,
        lng: geometry.coordinates[0],
        lat: geometry.coordinates[1],
        quality: 'unknown',
        use: '',
      };
    }
    read += 1;
    fs.rmSync(file, { force: true });
  }
  log(`openaddresses: ${read} sources read, ${missing} not available`);
}

module.exports = { id: 'openaddresses', rows, asOf: () => new Date().toISOString().slice(0, 10) };
