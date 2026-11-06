'use strict';

/**
 * What the daily report adds up (report.js): per county, how lookups were answered, what
 * shadow would have answered, and per vendor, how many calls went out. Counts only: no
 * address, Home, account or ZIP leaves this file. Each address counts once a day per
 * outcome, so a page read again and again is one person asking; which addresses were seen
 * is held in memory only, as hashes, for the day.
 *
 * Each process keeps its own day and writes it as one row of the shared PlaceSectionCache
 * every few minutes and as it stops, so a release loses at most those minutes, and the
 * report adds up the rows. Storage trouble here is only logged: no lookup waits on counting.
 */

const os = require('os');
const logger = require('../../utils/logger');
const router = require('./router');
const { zip5, stateCode } = require('./addressKey');
const { countyOfZip } = require('./zipCounty');

const SECTION = '_property_record_counts';
const FLUSH_EVERY_MS = 5 * 60 * 1000;
const KEEP_DAYS = 45;
const MAX_SEEN = 50000;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayOf = (date = new Date()) => date.toISOString().slice(0, 10);
// Loaded when first needed: the lookup tools in scripts/eval read the index with no database.
const database = () => require('../../config/supabaseAdmin');

let processId = null;
let role = null;
const days = new Map();
let seen = { day: null, marks: new Set() };
let flushing = null;

function today() {
  const day = dayOf();
  if (!days.has(day)) days.set(day, { lookups: {}, shadow: {}, vendors: {}, attom_by_county: {}, dirty: false });
  return days.get(day);
}

function add(group, key, by = 1) {
  group[key] = (group[key] || 0) + by;
}

function firstToday(mark) {
  const day = dayOf();
  if (seen.day !== day) seen = { day, marks: new Set() };
  if (seen.marks.has(mark)) return false;
  if (seen.marks.size < MAX_SEEN) seen.marks.add(mark);
  return true;
}

/**
 * One lookup a person's screen made.
 * @param {'add_home'|'home'} surface
 * @param {{ mark: string|null, zip: string, state: string }} address `mark` tells repeats of an address apart
 * @param {'answered'|'off'|'no_record'|'ambiguous'|'waiting'} outcome
 * @param {string} [jurisdiction] The county that answered, when one did
 */
function noteLookup(surface, { mark, zip, state }, outcome, jurisdiction) {
  const place = jurisdiction || countyOfZip(zip5(zip)) || stateCode(state);
  if (!place || !mark || !firstToday(`${mark}:${outcome}`)) return;
  const day = today();
  day.lookups[place] ??= {};
  day.lookups[place][surface] ??= {};
  add(day.lookups[place][surface], outcome);
  day.dirty = true;
}

function noteShadow(fips, match) {
  const day = today();
  day.shadow[fips] ??= {};
  add(day.shadow[fips], match);
  day.dirty = true;
}

function vendorCall(vendor, fips) {
  const day = today();
  add(day.vendors, vendor);
  if (vendor === 'attom') add(day.attom_by_county, fips || 'unknown');
  day.dirty = true;
}

/** Calls this process has made today, per vendor. */
const vendorsToday = () => ({ ...today().vendors });

// Every process writes at least once a day and soon after it follows a switch, so the report can tell when servers disagree.
function noteSwitches() {
  const { hash } = router.summary();
  const day = today();
  if (day.switches_hash !== hash) {
    day.switches_hash = hash;
    day.dirty = true;
  }
}

async function writeDays() {
  noteSwitches();
  const now = new Date();
  for (const [day, counted] of days) {
    if (counted.dirty) {
      counted.dirty = false;
      const { lookups, shadow, vendors, attom_by_county } = counted;
      const { error } = await database().from('PlaceSectionCache').upsert({
        cache_key: `counts:${day}:${processId}`,
        section_id: SECTION,
        payload: { day, role, switches: router.summary(), written_at: now.toISOString(), lookups, shadow, vendors, attom_by_county },
        fetched_at: now.toISOString(),
        expires_at: new Date(now.getTime() + KEEP_DAYS * DAY_MS).toISOString(),
      }, { onConflict: 'cache_key,section_id' });
      if (error) {
        counted.dirty = true;
        logger.warn('property_records.counts_write_failed', { error: error.message });
      }
    }
    if (day !== dayOf(now) && !counted.dirty) days.delete(day);
  }
}

/** Writes what's new, in a process that started counting (a report run by hand writes nothing). Never throws. */
function flush() {
  if (!role) return Promise.resolve();
  flushing ??= writeDays()
    .catch((err) => logger.warn('property_records.counts_write_failed', { error: err.message }))
    .finally(() => { flushing = null; });
  return flushing;
}

/** Starts writing this process's counts. `who` is 'api' or 'worker'. */
function start(who) {
  role = who;
  processId = `${who}-${os.hostname()}-${Date.now().toString(36)}`;
  setInterval(flush, FLUSH_EVERY_MS).unref();
}

/** Every process's counts for these days, oldest first. */
async function rowsBetween(from, to) {
  const rows = [];
  for (let at = 0; ; at += 1000) {
    const { data, error } = await database().from('PlaceSectionCache')
      .select('payload')
      .eq('section_id', SECTION)
      .gte('cache_key', `counts:${from}`)
      .lte('cache_key', `counts:${to}~`)
      .order('cache_key', { ascending: true })
      .range(at, at + 999);
    if (error) throw new Error(error.message);
    rows.push(...data.map((row) => row.payload));
    if (data.length < 1000) return rows;
  }
}

/** Removes counts past their keeping time. */
async function prune() {
  const { error } = await database().from('PlaceSectionCache').delete()
    .eq('section_id', SECTION)
    .lt('cache_key', `counts:${dayOf(new Date(Date.now() - KEEP_DAYS * DAY_MS))}`);
  if (error) logger.warn('property_records.counts_prune_failed', { error: error.message });
}

module.exports = { noteLookup, noteShadow, vendorCall, vendorsToday, flush, start, rowsBetween, prune, dayOf };
