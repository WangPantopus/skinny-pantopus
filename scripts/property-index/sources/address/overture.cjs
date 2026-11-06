'use strict';
// Overture Maps addresses, for the local governments' files it distributes and its licence per row: everything but its
// own copy of the National Address Database (nad.cjs reads the original) and anything rights.cjs doesn't allow. Overture's
// addresses theme has no OpenStreetMap data; a row's dataset says where it came from, so that stays checked here, too.
//
// Parquet, read with the DuckDB command-line tool (the workflow installs a pinned copy; DUCKDB names the binary).

const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { splitQuoted } = require('../../lib/tables.cjs');
const { log } = require('../../lib/log.cjs');
const { overtureRow } = require('./rights.cjs');

const RELEASE = process.env.OVERTURE_RELEASE || '2026-10-21.0';
const COUNTRIES = ['US', 'PR', 'VI', 'GU', 'AS', 'MP'];
const OSM = /openstreetmap|\bosm\b/i;

const query = () => `SET s3_region='us-west-2';
COPY (SELECT id, number, street, unit, postcode, postal_city, address_levels[1].value AS level1, country,
             bbox.xmin AS lng, bbox.ymin AS lat, sources[1].dataset AS dataset, sources[1].license AS license
      FROM read_parquet('s3://overturemaps-us-west-2/release/${RELEASE}/theme=addresses/type=address/*.parquet')
      WHERE country IN (${COUNTRIES.map((code) => `'${code}'`).join(',')}) AND sources[1].dataset <> 'NAD')
TO '/dev/stdout' (FORMAT CSV, HEADER);`;

const asOf = () => RELEASE.slice(0, 10);

/** Overture's bucket is public. The workflow's storage key isn't Overture's to see, and DuckDB would sign with it and be refused. */
function anonymous() {
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('AWS_')));
}

/** Yields the rows a county's connector would: see nad.cjs. */
async function* rows({ states = null }) {
  // Through a shell pipe: on Linux a child can't open /dev/stdout when it's the socket Node gives it. DuckDB's own errors name
  // files and SQL, not rows, so the first of them goes in the log.
  const duck = spawn('bash', ['-c', 'set -o pipefail; "$DUCKDB_BIN" -c "$DUCKDB_QUERY" | cat'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...anonymous(), DUCKDB_BIN: process.env.DUCKDB || 'duckdb', DUCKDB_QUERY: query() },
  });
  let complaint = '';
  duck.stderr.setEncoding('utf8');
  duck.stderr.on('data', (text) => { if (!complaint) complaint = text.split('\n')[0].slice(0, 200); });
  const exited = new Promise((resolve, reject) => {
    duck.on('error', reject);
    duck.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`DuckDB exited ${code}: ${complaint}`))));
  });
  duck.stdout.setEncoding('utf8');
  let header = null;
  let held = 0;
  let total = 0;
  for await (const line of readline.createInterface({ input: duck.stdout, crlfDelay: Infinity })) {
    const fields = splitQuoted(line, ',');
    if (!header) {
      header = Object.fromEntries(fields.map((name, i) => [name, i]));
      continue;
    }
    const dataset = fields[header.dataset];
    const license = fields[header.license];
    total += 1;
    if (!overtureRow(dataset, license) || OSM.test(dataset) || OSM.test(license)) {
      held += 1;
      continue;
    }
    const country = fields[header.country];
    const state = country === 'US' ? fields[header.level1] : country;
    if (states && !states.has(state)) continue;
    yield {
      source: `overture:${dataset}`,
      record: fields[header.id],
      state,
      number: fields[header.number],
      name: fields[header.street],
      unit: fields[header.unit],
      city: fields[header.postal_city],
      zip: fields[header.postcode],
      lng: Number(fields[header.lng]),
      lat: Number(fields[header.lat]),
      quality: 'unknown',
      use: '',
    };
  }
  await exited;
  log(`overture: ${total} rows read, ${held} held back by the rights register`);
}

module.exports = { id: 'overture', rows, asOf };
