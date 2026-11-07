'use strict';
// The national floor's neighborhood figures: the Census Bureau's American Community Survey, 5-year tables, by block group
// and by ZIP code tabulation area. Public domain. Statistics about an area, never a home's fact: median year built,
// median rooms and the most common bedroom count. An area with too few homes, or a median the survey itself is unsure
// of, says nothing.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { download } = require('../lib/tables.cjs');
const { stateOfCounty } = require('../../../backend/services/propertyRecords/addressKey');
const { log } = require('../lib/log.cjs');

const YEAR = 2024;
const BASE = `https://www2.census.gov/programs-surveys/acs/summary_file/${YEAR}/table-based-SF/data/5YRData`;
const MIN_HOMES = 30;
const MAX_YEAR_MARGIN = 15;
const MAX_ROOMS_MARGIN = 1.5;

function tableLines(work, table) {
  const file = path.join(work, 'us-acs', `${table}.dat`);
  download(`${BASE}/acsdt5y${YEAR}-${table}.dat`, file);
  return fs.readFileSync(file, 'latin1').split('\n').slice(1);
}

/** GEO_ID's block group (12 digits) or ZIP (5), or null for other geographies. */
function areaOf(geoId) {
  if (geoId.startsWith('1500000US')) return ['bg', geoId.slice(9)];
  if (geoId.startsWith('860Z200US')) return ['zip', geoId.slice(9)];
  return null;
}

function buildAreas({ work, out }) {
  const areas = new Map();
  const entry = (geoId) => {
    const area = areaOf(geoId);
    if (!area) return null;
    const key = area.join(':');
    if (!areas.has(key)) areas.set(key, { kind: area[0], id: area[1] });
    return areas.get(key);
  };
  for (const line of tableLines(work, 'b25041')) {
    const fields = line.split('|');
    const area = fields[0] && entry(fields[0]);
    if (!area) continue;
    const homes = Number(fields[1]);
    if (!(homes >= MIN_HOMES)) continue;
    area.homes = homes;
    let best = -1;
    let bestCount = 0;
    for (let bedrooms = 0; bedrooms <= 5; bedrooms += 1) {
      const count = Number(fields[3 + bedrooms * 2]);
      if (count > bestCount) {
        best = bedrooms;
        bestCount = count;
      }
    }
    if (best >= 0) {
      area.bedrooms = best;
      area.share = Math.round((100 * bestCount) / homes);
    }
  }
  for (const line of tableLines(work, 'b25035')) {
    const fields = line.split('|');
    const area = fields[0] && entry(fields[0]);
    const value = Number(fields[1]);
    if (area && value > 1800 && Number(fields[2]) >= 0 && Number(fields[2]) <= MAX_YEAR_MARGIN) area.year = value;
  }
  for (const line of tableLines(work, 'b25018')) {
    const fields = line.split('|');
    const area = fields[0] && entry(fields[0]);
    const value = Number(fields[1]);
    if (area && value > 0 && Number(fields[2]) >= 0 && Number(fields[2]) <= MAX_ROOMS_MARGIN) area.rooms = value;
  }
  const states = new Map();
  const zips = {};
  let kept = 0;
  for (const { kind, id, homes, year, rooms, bedrooms, share } of areas.values()) {
    if (!homes || (!year && !rooms && bedrooms === undefined)) continue;
    const row = [year ?? null, rooms ?? null, bedrooms ?? null, share ?? null];
    kept += 1;
    if (kind === 'zip') zips[id] = row;
    else {
      const state = stateOfCounty(id.slice(0, 5));
      if (!state) continue;
      if (!states.has(state)) states.set(state, {});
      states.get(state)[id] = row;
    }
  }
  const dir = path.join(out, 'areas');
  fs.mkdirSync(dir, { recursive: true });
  const about = { v: 1, source: `American Community Survey ${YEAR - 4}-${YEAR}`, columns: ['median_year_built', 'median_rooms', 'most_common_bedrooms', 'most_common_bedrooms_share'] };
  const write = (name, data) => fs.writeFileSync(path.join(dir, name), zlib.gzipSync(JSON.stringify({ ...about, areas: data }), { level: 9 }));
  write('zips.json.gz', zips);
  for (const [state, data] of states) write(`${state}.json.gz`, data);
  log(`Areas: ${kept} kept of ${areas.size}; ${Object.keys(zips).length} ZIP codes; ${states.size} states`);
}

module.exports = { buildAreas };
