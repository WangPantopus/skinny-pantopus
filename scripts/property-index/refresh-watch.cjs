#!/usr/bin/env node
// The refresh watch, after every build run of .github/workflows/property-index.yml: what each source and county did, every
// county a source served that its build no longer gives (publish.cjs never sees those, so they'd go on serving unnoticed),
// every live county near the date its record stops being served (stale_after), and every scheduled source whose run never came
// (GitHub starts scheduled runs late, and drops some or replaces a waiting one). Its tables go in the run's summary. It ends
// the run red, so GitHub sends its usual failed-run email, when a live county is RED_DAYS or fewer from its date (or past it),
// when a scheduled source's run is overdue, or when a live county's source is on no schedule. Each source's last try is kept
// in refresh/attempts.json beside the releases. Counts and county names only: this repository's logs are public.
//
//   node scripts/property-index/refresh-watch.cjs --bucket <name> [--prefix index] --outcomes <dir> [--run <id>] [--red]
//   node scripts/property-index/refresh-watch.cjs --root <local index> ...   the same on a local copy
//   node scripts/property-index/refresh-watch.cjs --check-schedule   (pull requests) every scheduled list names connectors that exist, each once
//     --outcomes  the build loop's builds.tsv (source, build exit, publish exit) and publish.cjs's counties.jsonl (--outcomes)
//     --red  a scheduled run: what needs someone fails the run (a live county near its date or gone from its source's build, a
//            missed scheduled build, a live county's source on no schedule). A run started by hand says the same as warnings.
//     --now <time>  as if it were then (to check a local copy)
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { switchesPath } = require('../../backend/services/propertyRecords/format');

const WARN_DAYS = 30;
const RED_DAYS = 14;
// GitHub starts a scheduled run hours after its time, and a run can take most of a day with the ledger after it.
const GRACE_HOURS = 36;
const ATTEMPTS = 'refresh/attempts.json';
const WORKFLOW = path.join(__dirname, '../../.github/workflows/property-index.yml');
const DAY = 24 * 3600 * 1000;

function parseArgs(argv) {
  const opts = { prefix: 'index', workflow: WORKFLOW };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--bucket') opts.bucket = argv[++i];
    else if (argv[i] === '--root') opts.root = argv[++i];
    else if (argv[i] === '--prefix') opts.prefix = argv[++i];
    else if (argv[i] === '--outcomes') opts.outcomes = argv[++i];
    else if (argv[i] === '--run') opts.run = argv[++i];
    else if (argv[i] === '--now') opts.now = new Date(argv[++i]);
    else if (argv[i] === '--workflow') opts.workflow = argv[++i];
    else if (argv[i] === '--check-schedule') opts.checkSchedule = true;
    else if (argv[i] === '--red') opts.red = true;
    else throw new Error('Unknown argument');
  }
  if (!opts.checkSchedule && !opts.bucket && !opts.root) throw new Error('usage: see the top of refresh-watch.cjs');
  return opts;
}

/** Which sources each scheduled build runs, read from the workflow's own SOURCES line. */
function readSchedule(file) {
  const text = fs.readFileSync(file, 'utf8');
  const crons = [...text.matchAll(/^\s*-\s*cron:\s*"([^"]+)"/gm)].map((match) => match[1]);
  const line = text.split('\n').find((row) => /^\s*SOURCES:/.test(row)) || '';
  const lists = new Map([...line.matchAll(/github\.event\.schedule == '([^']+)' && '([^']+)'/g)].map((match) => [match[1], match[2].split(/\s+/)]));
  const fallback = (line.match(/\|\| '([^']+)' \}\}\s*$/) || [])[1];
  // The build step's own condition names the crons that build nothing (FHFA's area trends).
  const buildIf = (text.match(/- name: Build and publish\n\s*if: (.*)/) || [])[1] || '';
  const noBuild = new Set([...buildIf.matchAll(/github\.event\.schedule != '([^']+)'/g)].map((match) => match[1]));
  return crons.filter((cron) => !noBuild.has(cron)).map((cron) => ({ cron, sources: lists.get(cron) || (fallback ? fallback.split(/\s+/) : []), fallback: !lists.has(cron) }));
}

function checkSchedule(file) {
  const schedule = readSchedule(file);
  const problems = [];
  const where = new Map();
  if (!schedule.length) problems.push('no scheduled build found');
  if (schedule.filter((entry) => entry.fallback).length > 1) problems.push(`${schedule.filter((entry) => entry.fallback).map((entry) => entry.cron).join(', ')} have no list in SOURCES`);
  for (const { cron, sources } of schedule) {
    if (!sources.length) problems.push(`${cron} builds nothing`);
    for (const source of sources) {
      if (!fs.existsSync(path.join(__dirname, 'sources', `${source}.cjs`))) problems.push(`${cron}: no connector ${source}`);
      if (where.has(source)) problems.push(`${source} is on ${where.get(source)} and ${cron}`);
      where.set(source, cron);
    }
    console.log(`${cron}: ${sources.length} sources`);
  }
  for (const problem of problems) console.log(`::error::Schedule: ${problem}`);
  console.log(`${where.size} sources on ${schedule.length} scheduled builds`);
  if (problems.length) process.exitCode = 1;
}

/** The last time a cron of the forms the workflow uses ("M H * * D", "M H D * *", "M H D M,M *") came, at or before `before`. */
function lastTime(cron, before) {
  const [minute, hour, dom, month, dow] = cron.split(/\s+/);
  const matches = (field, value) => field === '*' || field.split(',').map(Number).includes(value);
  for (let back = 0; back < 400; back += 1) {
    const day = new Date(Date.UTC(before.getUTCFullYear(), before.getUTCMonth(), before.getUTCDate() - back, Number(hour), Number(minute)));
    if (day > before) continue;
    if (matches(dom, day.getUTCDate()) && matches(month, day.getUTCMonth() + 1) && matches(dow, day.getUTCDay())) return day;
  }
  return null;
}

function createStore({ bucket, root, prefix }) {
  if (root) {
    const file = (name) => path.join(root, name);
    return {
      states: () => fs.readdirSync(file('states')).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(file(`states/${name}`), 'utf8'))),
      json: (name) => (fs.existsSync(file(name)) ? JSON.parse(fs.readFileSync(file(name), 'utf8')) : null),
      putJson: (name, data) => {
        fs.mkdirSync(path.dirname(file(name)), { recursive: true });
        fs.writeFileSync(`${file(name)}.tmp`, JSON.stringify(data));
        fs.renameSync(`${file(name)}.tmp`, file(name));
      },
    };
  }
  const url = (name) => `s3://${bucket}/${prefix}/${name}`;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-watch-'));
  return {
    states: () => {
      const dir = fs.mkdtempSync(path.join(scratch, 'states-'));
      execFileSync('aws', ['s3', 'cp', url('states/'), dir, '--recursive', '--exclude', '*', '--include', '*.json', '--only-show-errors'], { stdio: ['ignore', 'ignore', 'inherit'] });
      return fs.readdirSync(dir).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
    },
    json: (name) => {
      try {
        return JSON.parse(execFileSync('aws', ['s3', 'cp', url(name), '-', '--only-show-errors'], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
      } catch (_) {
        return null;
      }
    },
    putJson: (name, data) => {
      const file = path.join(scratch, 'write');
      fs.writeFileSync(file, JSON.stringify(data));
      execFileSync('aws', ['s3', 'cp', file, url(name), '--content-type', 'application/json', '--cache-control', 'no-cache', '--only-show-errors'], { stdio: ['ignore', 'ignore', 'inherit'] });
    },
  };
}

/** This run's builds (source, build exit, publish exit) and what publish.cjs did with each county. */
function readOutcomes(dir) {
  if (!dir) return { builds: [], counties: [] };
  const read = (name) => (fs.existsSync(path.join(dir, name)) ? fs.readFileSync(path.join(dir, name), 'utf8').split('\n').filter(Boolean) : []);
  const builds = read('builds.tsv').map((row) => {
    const [source, build, publish] = row.split('\t');
    return { source, build: Number(build), publish: Number(publish) };
  });
  return { builds, counties: read('counties.jsonl').map((row) => JSON.parse(row)) };
}

const day = (date) => date.toISOString().slice(0, 10);
const daysTo = (date, now) => Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${day(now)}T00:00:00Z`)) / DAY);
const table = (head, rows) => (rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`), ''] : []);

function watch(opts) {
  const now = opts.now || new Date();
  const store = createStore(opts);
  const schedule = readSchedule(opts.workflow);
  const cronOf = new Map(schedule.flatMap(({ cron, sources }) => sources.map((source) => [source, cron])));
  const { builds, counties: outcomes } = readOutcomes(opts.outcomes);
  const counties = store.states().flatMap((state) => Object.values(state.jurisdictions || {}));
  const switches = store.json(switchesPath('production')) || { counties: {} };
  const live = new Set(Object.entries(switches.counties || {}).filter(([, county]) => county.mode === 'live').map(([fips]) => fips));
  // A county its source's build no longer gives at all (every row without an address, say): only sources that built and whose
  // publish said something, so a publish that failed outright isn't read as every county gone.
  const toldOf = new Set(outcomes.map((line) => line.fips));
  const spoke = new Set(outcomes.map((line) => line.source));
  const builtWhole = new Set(builds.filter(({ source, build }) => !build && spoke.has(source)).map(({ source }) => source));
  const notGiven = counties.filter((county) => county.status !== 'withdrawn' && builtWhole.has(county.source) && !toldOf.has(county.fips));
  const attempts = store.json(ATTEMPTS) || { sources: {} };
  const errors = [];
  const warnings = [];
  const summary = [`## Refresh watch, ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`, ''];

  // This run.
  const bySource = new Map();
  for (const line of outcomes) {
    if (!bySource.has(line.source)) bySource.set(line.source, []);
    bySource.get(line.source).push(line);
  }
  const ran = builds.map(({ source, build, publish }) => {
    const lines = bySource.get(source) || [];
    const count = (outcome) => lines.filter((line) => line.outcome === outcome).length;
    const result = build ? 'build failed' : publish ? 'publish failed or refused' : 'ok';
    const previous = attempts.sources[source] || {};
    attempts.sources[source] = {
      ...previous,
      first_seen: previous.first_seen || now.toISOString(),
      last_try: now.toISOString(),
      ...(result === 'ok' ? { last_ok: now.toISOString() } : {}),
      result,
      run: opts.run || null,
      refused: lines.filter((line) => line.outcome === 'refused').map((line) => line.fips),
      kept_back: lines.filter((line) => line.outcome === 'kept back').map((line) => line.fips),
      not_given: notGiven.filter((county) => county.source === source).map((county) => county.fips),
    };
    return [source, result, count('published'), count('unchanged'), count('kept back'), count('refused')];
  });
  if (ran.length) summary.push('### This run', '', ...table(['Source', 'Result', 'Published', 'Unchanged', 'Kept back', 'Refused'], ran));
  const refusals = outcomes.filter((line) => line.outcome === 'refused' || line.outcome === 'kept back');
  if (refusals.length) {
    summary.push(...table(['County', 'Source', 'What happened', 'Why'], refusals.map((line) => [`${line.name || line.fips} ${line.state} (${line.fips})${live.has(line.fips) ? ', live' : ''}`, line.source, line.outcome, line.why || ''])));
  }
  if (notGiven.length) {
    summary.push('### Counties this run\'s build no longer gives', '', 'Each keeps serving its older release until its date. Its source built without it: read why in the build\'s log.', '',
      ...table(['County', 'Source', 'Serving, dated', 'Stops serving'], notGiven.map((county) => [`${county.name} ${county.state} (${county.fips})${live.has(county.fips) ? ', live' : ''}`, county.source, county.as_of, county.stale_after])));
  }

  // Scheduled sources: when each scheduled build last came, and whether this source has been tried since.
  for (const source of cronOf.keys()) attempts.sources[source] = { first_seen: now.toISOString(), ...attempts.sources[source] };
  const overdue = [];
  const failing = [];
  for (const [source, cron] of cronOf) {
    const seen = attempts.sources[source];
    const due = lastTime(cron, new Date(now.getTime() - GRACE_HOURS * 3600 * 1000));
    const since = seen.last_try || seen.first_seen;
    if (due && Date.parse(since) < due.getTime()) overdue.push([source, cron, day(due), seen.last_try ? day(new Date(seen.last_try)) : 'none recorded']);
    else if (seen.last_try && (seen.result !== 'ok' || (seen.refused || []).length)) {
      failing.push([source, day(new Date(seen.last_try)), seen.result, (seen.refused || []).join(' ') || '']);
    }
  }
  const missed = new Map();
  for (const [source, cron, due] of overdue) missed.set(cron, { due, sources: [...(missed.get(cron)?.sources || []), source] });
  const missedLines = [...missed].map(([cron, { due, sources }]) => `the scheduled build at ${cron} (UTC) was due by ${due} and never came for ${sources.join(' ')}`);
  if (overdue.length) summary.push('### Scheduled builds that never came', '', ...table(['Source', 'Schedule (UTC)', 'Due by', 'Last try'], overdue));
  if (failing.length) summary.push('### Last try failed or refused counties', '', ...table(['Source', 'Last try', 'Result', 'Refused'], failing));

  // Live counties near their date, and stored sources on no schedule.
  const near = [];
  const unscheduled = new Map();
  for (const county of counties) {
    if (county.status === 'withdrawn') continue;
    const isLive = live.has(county.fips);
    if (county.source && !cronOf.has(county.source)) {
      if (!unscheduled.has(county.source)) unscheduled.set(county.source, { counties: 0, live: 0 });
      unscheduled.get(county.source).counties += 1;
      if (isLive) unscheduled.get(county.source).live += 1;
    }
    if (!isLive || !county.stale_after) continue;
    const left = daysTo(county.stale_after, now);
    if (left > WARN_DAYS) continue;
    near.push({ left, row: [`${county.name} ${county.state} (${county.fips})`, county.source, county.as_of, county.stale_after, left < 0 ? `past by ${-left}` : String(left), cronOf.get(county.source) || 'on no schedule'] });
    const line = `${county.name} ${county.state} (${county.fips}), live: ${left < 0 ? `past its date (${county.stale_after}) by ${-left} days` : `${left} days to its date (${county.stale_after})`}; ${county.source} dated ${county.as_of}`;
    if (left <= RED_DAYS) errors.push({ left, line });
    else warnings.push(`${line}${cronOf.has(county.source) ? '' : ', and its source is on no schedule'}`);
  }
  near.sort((a, b) => a.left - b.left);
  errors.sort((a, b) => a.left - b.left);
  summary.push(`### Live counties within ${WARN_DAYS} days of their date`, '');
  summary.push(...(near.length ? table(['County', 'Source', 'Dated', 'Stops serving', 'Days left', 'Schedule (UTC)'], near.map(({ row }) => row)) : ['None.', '']));
  for (const [source, { counties: count, live: liveCount }] of unscheduled) {
    const line = `${source} serves ${count} ${count === 1 ? 'county' : 'counties'}${liveCount ? ` (${liveCount} live)` : ''} and is on no schedule`;
    if (liveCount) errors.push({ line });
    else warnings.push(line);
  }
  for (const county of notGiven) {
    const line = `${county.name} ${county.state} (${county.fips})${live.has(county.fips) ? ', live,' : ''} is no longer in ${county.source}'s build; its ${county.as_of} release serves until ${county.stale_after}`;
    if (live.has(county.fips)) errors.push({ line });
    else warnings.push(line);
  }
  // GitHub shows the first ten of each kind on the run's page: the counties nearest their date first, then the missed builds.
  const red = [...errors.map(({ line }) => line), ...missedLines];
  if (unscheduled.size) summary.push('### Stored sources on no schedule', '', ...table(['Source', 'Counties', 'Live'], [...unscheduled].map(([source, value]) => [source, value.counties, value.live])));
  summary.push(`${live.size} live counties of ${counties.length} stored; ${cronOf.size} sources on ${schedule.length} scheduled builds.`, '');

  attempts.updated_at = now.toISOString();
  try {
    store.putJson(ATTEMPTS, attempts);
  } catch (_) {
    warnings.push(`could not write ${ATTEMPTS}; the next run checks against the last copy`);
  }
  for (const line of red) console.log(opts.red ? `::error::Refresh watch: ${line}` : `::warning::Refresh watch (fails a scheduled run): ${line}`);
  for (const line of warnings) console.log(`::warning::Refresh watch: ${line}`);
  const text = summary.join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  else console.log(text);
  console.log(`Refresh watch: ${builds.length} sources this run, ${near.length} live counties within ${WARN_DAYS} days, ${overdue.length} sources overdue, ${red.length} lines that fail a scheduled run`);
  if (red.length && opts.red) process.exitCode = 1;
}

const opts = parseArgs(process.argv.slice(2));
try {
  if (opts.checkSchedule) checkSchedule(opts.workflow);
  else watch(opts);
} catch (err) {
  console.error(`The refresh watch failed: ${err.constructor === Error ? err.message : err.name}`);
  process.exit(1);
}
