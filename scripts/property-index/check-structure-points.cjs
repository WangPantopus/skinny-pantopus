#!/usr/bin/env node
// How often the floor by location picks the wrong building, measured on a state whose FEMA file does have addresses: each
// registry address is looked up from its point, with FEMA's addresses held out, and the building it picks is compared to
// FEMA's house number. Prints counts only. It works from local files, and takes a while on a large state.
//
//   node scripts/property-index/check-structure-points.cjs --fema <unzipped FEMA folder> --nsi <gpkg> --state RI --registry <s3://bucket/prefix or dir> --work <dir>
//
// Rows: the check as it runs; the same point moved up to 5, 10 and 20 m (another source's point, not the registry's); only
// part of the registry present (a thin state: each kept address is its own and its neighbors' only evidence); no registry
// at all (a state with none); and the last row split by what kind of building and how far from the next house.
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { femaTable, readInventory } = require('./sources/us-structures.cjs');
const { readStructures, countInventory, readRegistry, addClaims, measure, wrongRate } = require('./sources/us-structure-points.cjs');
const points = require('../../backend/services/propertyRecords/structurePoints');

const opt = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

function rowsOf({ split }) {
  const rows = {};
  for (const [key, n] of Object.entries(split || {})) {
    const [name, result] = key.split('|');
    (rows[name] ||= { right: 0, wrong: 0 })[result] = n;
  }
  for (const name of Object.keys(rows).sort()) console.log(`   ${name.padEnd(22)} right ${String(rows[name].right).padStart(7)}  wrong ${String(rows[name].wrong).padStart(6)}  ${wrongRate(rows[name]).padStart(7)}`);
}

function main() {
  const state = opt('--state');
  const work = opt('--work') || path.join(process.env.TMPDIR || '/tmp', 'structure-points');
  const noInventory = readInventory(opt('--nsi'));
  const data = readStructures(femaTable(opt('--fema'), state), noInventory);
  countInventory(data, noInventory);
  const registry = readRegistry(opt('--registry'), state, work);
  const show = (label, m) => console.log(`${label.padEnd(34)} asked ${String(m.points).padStart(8)}  found ${String(m.accepted).padStart(8)} ${String(Math.round((100 * m.accepted) / Math.max(m.points, 1))).padStart(3)}%  inside ${String(m.inside).padStart(8)}  right ${String(m.right).padStart(8)}  wrong ${String(m.wrong).padStart(7)}  ${wrongRate(m).padStart(7)}  next door ${String(m.wrong_next_door).padStart(6)} same street ${String(m.wrong_same_street).padStart(6)} another street ${String(m.wrong_other_street).padStart(6)}`);
  console.log(`${state}: ${data.count} structures, ${data.counts.addressed} homes with an address, ${registry.count} registry points`);
  addClaims(data, noInventory, registry);
  const all = measure(data, noInventory, registry, { splits: ({ structure, how }, quality) => `${structure.use} ${how} ${process.argv.includes('--quick') ? `homes ${Math.min(structure.homes || 1, 3)}` : quality}` });
  show('the check', all);
  console.log(`   refused ${JSON.stringify(all.refused)}`);
  rowsOf(all);
  for (const jitter of process.argv.includes('--quick') ? [] : [5, 10, 20]) show(`point moved up to ${jitter} m`, measure(data, noInventory, registry, { jitter }));
  for (const share of process.argv.includes('--quick') ? [] : [0.5, 0.25, 0.1]) {
    const keep = (p) => ((p * 2654435761) >>> 0) / 4294967296 < share;
    addClaims(data, noInventory, registry, { keep });
    const kept = { ...registry };
    kept.order = registry.order.filter(keep);
    kept.count = kept.order.length;
    show(`only ${Math.round(share * 100)}% of the registry`, measure(data, noInventory, kept));
  }
  addClaims(data, noInventory, { ...registry, count: 0 });
  const geometry = measure(data, noInventory, registry, {
    splits: ({ structure, nextHouse }) => {
      const size = structure.facts.footprint_sqft;
      return `${nextHouse < 40 ? 'next<40' : 'next40+'} ${size < 1500 ? '<1500' : size < 2500 ? '<2500' : '<3000'} homes ${structure.homes || '0-1'}`.replace(/homes ([3-9]|\d\d+)/, 'homes 3+');
    },
  });
  show('no registry evidence at all', geometry);
  rowsOf(geometry);
  for (const jitter of process.argv.includes('--quick') ? [] : [5, 10]) show(`  and moved up to ${jitter} m`, measure(data, noInventory, registry, { jitter }));
}

main();
