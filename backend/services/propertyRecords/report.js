'use strict';

/**
 * The router's report, per county, from each process's counts (counts.js) and the index's
 * state files: how lookups were answered, which counties to build next, which are built
 * and waiting to go live, and calls to each vendor. ATTOM's must be zero. Counts only, so
 * it can go in a log or a chat.
 *
 *   queue  asked for, and no release: the next counties to build, by what people asked for
 *   ready  asked for, with a release, and not live: what going live would start answering
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const reader = require('./reader');
const router = require('./router');
const counts = require('./counts');
const { stateOfCounty } = require('./addressKey');

const UNANSWERED = ['off', 'no_record', 'ambiguous'];
const DAY_MS = 24 * 60 * 60 * 1000;
const isCounty = (place) => /^\d{5}$/.test(place);

function blankRow(place) {
  return {
    ...(isCounty(place) ? { fips: place, state: stateOfCounty(place) } : { fips: null, state: place }),
    answered: 0, unanswered: 0, searches_unanswered: 0, off: 0, no_record: 0, ambiguous: 0, waiting: 0, shadow: {}, attom_calls: 0,
  };
}

function addUp(rows) {
  const places = new Map();
  const vendors = {};
  const row = (place) => {
    if (!places.has(place)) places.set(place, blankRow(place));
    return places.get(place);
  };
  for (const counted of rows) {
    for (const [place, surfaces] of Object.entries(counted.lookups || {})) {
      const total = row(place);
      for (const [surface, outcomes] of Object.entries(surfaces)) {
        for (const [outcome, count] of Object.entries(outcomes)) {
          total[outcome] = (total[outcome] || 0) + count;
          if (UNANSWERED.includes(outcome)) {
            total.unanswered += count;
            if (surface === 'add_home') total.searches_unanswered += count;
          }
        }
      }
    }
    for (const [fips, matches] of Object.entries(counted.shadow || {})) {
      const total = row(fips);
      for (const [match, count] of Object.entries(matches)) total.shadow[match] = (total.shadow[match] || 0) + count;
    }
    for (const [vendor, count] of Object.entries(counted.vendors || {})) vendors[vendor] = (vendors[vendor] || 0) + count;
    for (const [fips, count] of Object.entries(counted.attom_by_county || {})) {
      if (isCounty(fips)) row(fips).attom_calls += count;
    }
  }
  return { places, vendors };
}

/** What the index holds for these counties; null for a state it can't read just now, so nothing is wrongly called missing. */
async function releasesFor(states) {
  const found = new Map();
  await Promise.all([...states].map(async (state) => {
    try {
      found.set(state, await reader.stateFile(state));
    } catch (err) {
      logger.info('property_records.report_index_later', { error: err.name });
    }
  }));
  return found;
}

/** County names for those without a release; a report still works without them. */
async function namesFor(fipsList) {
  const names = new Map();
  for (let at = 0; at < fipsList.length; at += 300) {
    const { data, error } = await supabaseAdmin.from('CountyRadonZone').select('county_fips, county_label').in('county_fips', fipsList.slice(at, at + 300));
    if (error) logger.info('property_records.report_names_later', { error: error.message });
    for (const row of data || []) names.set(row.county_fips, row.county_label);
  }
  return names;
}

// The latest each kind of server wrote. API and worker should agree; if not, one hasn't followed a switch.
function serversFrom(rows) {
  const latest = new Map();
  for (const counted of rows) {
    if (!(latest.get(counted.role)?.written_at > counted.written_at)) latest.set(counted.role, counted);
  }
  const servers = [...latest.values()].map(({ role, written_at: writtenAt, switches }) => ({ role, written_at: writtenAt, ...switches }));
  return { servers, servers_disagree: new Set(servers.map((server) => server.hash)).size > 1 };
}

const byUnanswered = (a, b) => b.unanswered - a.unanswered || b.searches_unanswered - a.searches_unanswered || String(a.fips).localeCompare(String(b.fips));

/**
 * @param {object} [options]
 * @param {number} [options.days] How many days, 1 to 31
 * @param {Date} [options.until] The last day, by default today
 */
async function loadReport({ days = 7, until = new Date() } = {}) {
  const span = Math.min(Math.max(Math.trunc(Number(days)) || 7, 1), 31);
  const to = counts.dayOf(until);
  const from = counts.dayOf(new Date(until.getTime() - (span - 1) * DAY_MS));
  await counts.flush();
  const rows = await counts.rowsBetween(from, to);
  const { places, vendors } = addUp(rows);
  for (const [fips, mode] of router.listed()) if (mode !== 'off' && !places.has(fips)) places.set(fips, blankRow(fips));

  const list = [...places.values()];
  const states = await releasesFor(new Set(list.filter((row) => row.fips).map((row) => row.state).filter(Boolean)));
  const names = await namesFor(list.filter((row) => row.fips).map((row) => row.fips));
  for (const row of list.filter((entry) => entry.fips)) {
    row.mode = router.modeFor(row.fips);
    const county = states.get(row.state)?.jurisdictions?.[row.fips];
    row.name = county?.name || names.get(row.fips) || null;
    // Unknown when the index can't be read here, which isn't the same as no release.
    row.has_release = states.has(row.state) ? Boolean(county) : null;
    if (county) Object.assign(row, { release: county.release, as_of: county.as_of, records: county.records ?? null, source_status: county.status });
  }
  const counties = list.filter((row) => row.fips).sort(byUnanswered);
  const asked = counties.filter((row) => row.unanswered > 0);
  const total = (field) => list.reduce((sum, row) => sum + row[field], 0);
  const answered = total('answered');
  const unanswered = total('unanswered');
  return {
    from,
    to,
    index_read: states.size > 0 && [...states.values()].some(Boolean),
    ...serversFrom(rows),
    totals: { answered, unanswered, waiting: total('waiting'), answered_share: answered + unanswered ? Math.round((1000 * answered) / (answered + unanswered)) / 10 : null },
    vendors,
    attom_calls: vendors.attom || 0,
    queue: asked.filter((row) => row.has_release === false),
    ready: asked.filter((row) => row.has_release && row.mode !== 'live'),
    counties,
    no_county: list.filter((row) => !row.fips).sort(byUnanswered),
  };
}

module.exports = { loadReport };
