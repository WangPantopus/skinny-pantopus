#!/usr/bin/env node
// Prints how a made-up tower's floor-plan sheet answers, through the real build (build-floor-plans.cjs) and the lookup the
// server uses (floorPlanLookup.js): every unit it names gets its own plan, and nothing else gets any unit's. No real
// building, no network, nothing kept. Exits 1 if a wrong answer turns up.
//
//   node scripts/property-index/check-floor-plans.cjs
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { answerFor } = require('../../backend/services/propertyRecords/floorPlanLookup');
const { suppressionHash } = require('../../backend/services/propertyRecords/registryLookup');
const { parse } = require('../../backend/services/propertyRecords/addressKey');
const { statePath, sheetPath, planFacts } = require('../../backend/services/propertyRecords/floorPlanFormat');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'floor-plan-check-'));
const FIPS = '53011';
const place = (n) => ({ line1: `${n} Example Trust Lane`, city: 'Vancouver', state: 'WA', zip: '98660' });
const lookupAt = (n, unit, read) => answerFor({ ...place(n), unit }, read);
const stacks = (names, from, to, skip = []) => names.map((stack) => ({ stack, floors: { from, to, skip } }));
const permission = { role: 'building_manager', scope: 'facts', granted_at: '2026-10-02' };

// 690 units on 30 floors of 23, the size of a real downtown tower, with four plans.
const STACK_NAMES = Array.from({ length: 23 }, (_, i) => String(i + 1).padStart(2, '0'));
const sheets = {
  tower: { building: { addresses: [place(5901)] }, as_of: '2026-10-02', permission, plans: [
    { name: 'S', bedrooms: 0, bathrooms: 1, sq_ft: 480, stacks: stacks(STACK_NAMES.slice(0, 8), 2, 31) },
    { name: 'A', bedrooms: 1, bathrooms: 1, sq_ft: 742, stacks: stacks(STACK_NAMES.slice(8, 18), 2, 31) },
    { name: 'B', bedrooms: 2, bathrooms: 2, sq_ft: 1105, stacks: stacks(STACK_NAMES.slice(18, 22), 2, 31) },
    { name: 'C', bedrooms: 3, bathrooms: 2.5, sq_ft: 1540, stacks: stacks(STACK_NAMES.slice(22), 2, 31) },
  ] },
  unmapped: { building: { addresses: [place(5902)] }, as_of: '2026-10-02', permission, plans: [
    { name: 'S', bedrooms: 0, bathrooms: 1, sq_ft: 480 }, { name: 'A', bedrooms: 1, bathrooms: 1, sq_ft: 650 }, { name: 'A2', bedrooms: 1, bathrooms: 1, sq_ft: 780 },
  ] },
  sameAddressOne: { building: { addresses: [place(5903)] }, as_of: '2026-10-02', permission, plans: [{ name: 'A', bedrooms: 1, sq_ft: 700, units: ['101'] }] },
  // Both of these reach 5904.
  bothEntrances: { building: { addresses: [place(5905), place(5904)] }, as_of: '2026-10-02', permission, plans: [{ name: 'A', bedrooms: 1, sq_ft: 700, units: ['101'] }] },
  oneEntrance: { building: { addresses: [place(5904)] }, as_of: '2026-10-02', permission, plans: [{ name: 'B', bedrooms: 2, sq_ft: 900, units: ['101'] }] },
};

function publish(name, sheet) {
  const file = path.join(root, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(sheet));
  execFileSync(process.execPath, [path.join(__dirname, 'build-floor-plans.cjs'), '--sheet', file, '--fips', FIPS, '--to', root], { stdio: 'ignore' });
}

const read = {
  stateFile: async (state) => (fs.existsSync(path.join(root, statePath(state))) ? JSON.parse(fs.readFileSync(path.join(root, statePath(state)), 'utf8')) : null),
  sheetFile: async (id, release) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, sheetPath(id, release)))).toString('utf8')),
};

function quantile(sorted, share) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

(async () => {
  for (const [name, sheet] of Object.entries(sheets)) publish(name, sheet);
  const wrong = [];
  let right = 0;
  const times = [];
  const towerUnits = [];
  for (const plan of sheets.tower.plans) {
    for (const stack of plan.stacks) {
      for (let floor = stack.floors.from; floor <= stack.floors.to; floor += 1) towerUnits.push([`${floor}${stack.stack}`, plan]);
    }
  }
  for (const [unit, plan] of towerUnits) {
    const started = process.hrtime.bigint();
    const copy = await lookupAt(5901, unit, read);
    times.push(Number(process.hrtime.bigint() - started) / 1e6);
    if (copy?.match === 'exact' && copy.plan.name === plan.name && copy.plan.sq_ft === plan.sq_ft) right += 1;
    else wrong.push('named unit');
  }
  console.log(`Named units: ${right} of ${towerUnits.length} got their own plan, from one sheet of ${sheets.tower.plans.length} plans.`);

  const named = new Set(towerUnits.map(([unit]) => unit));
  // What people type that isn't on the sheet: floors it doesn't cover, stacks it doesn't have, leading zeros, letters, made-up numbers.
  const others = [];
  for (let floor = 0; floor <= 40; floor += 1) for (const stack of ['00', ...STACK_NAMES, '24', '25', 'A']) others.push(`${floor}${stack}`);
  for (const [unit] of towerUnits.slice(0, 200)) others.push(`0${unit}`, `${unit}A`, `${unit}0`);
  for (let n = 1; n <= 500; n += 1) others.push(`X${n}`);
  const tried = others.filter((unit) => !named.has(unit));
  let unitFacts = 0;
  for (const unit of tried) {
    const copy = await lookupAt(5901, unit, read);
    if (copy?.match !== 'building_only' || Object.keys(planFacts(copy)).length) unitFacts += 1;
  }
  console.log(`Units not on the sheet: ${tried.length} tried, ${unitFacts} got a unit's plan or anything but the building's ranges.`);
  if (unitFacts) wrong.push('unit not on the sheet');

  const none = await lookupAt(5901, '', read);
  console.log(`No unit given: ${none.match}, reason ${none.reason}, unit facts ${Object.keys(planFacts(none)).length}.`);
  if (none.match !== 'building_only' || Object.keys(planFacts(none)).length) wrong.push('no unit');

  const unmapped = await lookupAt(5902, '101', read);
  console.log(`Sheet with no unit mapping, unit 101: ${unmapped.match}, unit facts ${Object.keys(planFacts(unmapped)).length}, ranges ${JSON.stringify(unmapped.ranges.map(({ bedrooms, sq_ft_min: min, sq_ft_max: max }) => [bedrooms, min, max]))}.`);
  if (unmapped.match !== 'building_only' || Object.keys(planFacts(unmapped)).length) wrong.push('unmapped');

  const otherStreet = await answerFor({ line1: '5901 Example Trust Court', unit: '205', city: 'Vancouver', state: 'WA', zip: '98660' }, read);
  const otherZip = await answerFor({ ...place(5901), unit: '205', zip: '98661' }, read);
  console.log(`Same number on another street type: ${otherStreet ? 'answered' : 'nothing'}. Same line in another ZIP: ${otherZip ? 'answered' : 'nothing'}.`);
  if (otherStreet || otherZip) wrong.push('wrong building');

  // Two sheets reaching one address: which is right isn't for us to guess.
  const twoSheets = await lookupAt(5904, '101', read);
  console.log(`Two sheets at one address: ${twoSheets ? 'answered' : 'nothing'}.`);
  if (twoSheets) wrong.push('two sheets');

  // A protected address answers nothing, whatever the sheet says.
  const parsed = parse(place(5901).line1, '205', { state: 'WA', zip: '98660' });
  const hidden = await answerFor({ ...place(5901), unit: '205' }, { ...read, suppressions: async () => ({ salt: 's', hashes: [suppressionHash('s', FIPS, parsed)] }) });
  console.log(`A protected unit: ${hidden ? 'answered' : 'nothing'}.`);
  if (hidden) wrong.push('protected');

  // A new sheet replaces the old as a new release; going back and withdrawing take one step each.
  const small = sheets.sameAddressOne;
  const smallId = async () => (await lookupAt(5903, '101', read)).sheet;
  const before = (await lookupAt(5903, '101', read)).plan.sq_ft;
  publish('sameAddressNew', { ...small, as_of: '2026-11-01', plans: [{ ...small.plans[0], sq_ft: 725 }] });
  const after = (await lookupAt(5903, '101', read)).plan.sq_ft;
  execFileSync(process.execPath, [path.join(__dirname, 'build-floor-plans.cjs'), '--rollback', await smallId(), '--state', 'WA', '--to', root], { stdio: 'ignore' });
  const back = (await lookupAt(5903, '101', read)).plan.sq_ft;
  execFileSync(process.execPath, [path.join(__dirname, 'build-floor-plans.cjs'), '--withdraw', await smallId(), '--state', 'WA', '--to', root], { stdio: 'ignore' });
  const gone = await lookupAt(5903, '101', read);
  console.log(`A new release: ${before} sq ft became ${after}. Rolled back: ${back}. Withdrawn: ${gone ? 'answered' : 'nothing'}.`);
  if (after !== 725 || back !== before || gone) wrong.push('release moves');

  times.sort((a, b) => a - b);
  console.log(`Time per lookup with the sheet in memory: median ${quantile(times, 0.5).toFixed(2)} ms, 95th percentile ${quantile(times, 0.95).toFixed(2)} ms.`);
  fs.rmSync(root, { recursive: true, force: true });
  if (wrong.length) {
    console.error(`WRONG: ${[...new Set(wrong)].join(', ')}`);
    process.exit(1);
  }
  console.log('No wrong answers.');
})().catch((err) => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(`The check failed: ${err.name}: ${err.message}`);
  process.exit(1);
});
