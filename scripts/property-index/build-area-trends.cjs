#!/usr/bin/env node
// Builds the area's price change for the value card (sources/us-fhfa.cjs): one small file per state, read as it is by
// backend/services/propertyRecords/areaTrend.js from <root>/area-trends. A failed or refused build writes nothing. Prints counts only.
//
//   node scripts/property-index/build-area-trends.cjs --out <dir> [--work <dir>]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { buildAreaTrends } = require('./sources/us-fhfa.cjs');
const { log } = require('./lib/log.cjs');

async function main() {
  const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const out = opt('--out');
  if (!out) throw new Error('usage: see the top of build-area-trends.cjs');
  const work = opt('--work') || path.join(out, 'work');
  const states = await buildAreaTrends({ work });
  const dir = path.join(out, 'area-trends');
  fs.mkdirSync(dir, { recursive: true });
  let bytes = 0;
  for (const [state, file] of states) {
    const data = zlib.gzipSync(JSON.stringify(file));
    fs.writeFileSync(path.join(dir, `${state}.json.gz`), data);
    bytes += data.length;
  }
  log(`Wrote ${states.size} files, ${bytes} bytes`);
}

main().catch((err) => {
  const ours = err.constructor === Error && !/JSON|Unexpected/.test(err.message);
  console.error(`The build failed: ${ours ? err.message : err.name}`);
  process.exit(1);
});
