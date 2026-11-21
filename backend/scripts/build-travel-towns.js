#!/usr/bin/env node
/**
 * Builds backend/data/travelTowns.json, the towns a travelling Christmas card can stop in (launch key card_travel;
 * services/cardTravel), from the U.S. Census Bureau's public-domain files. Nothing calls an outside service at run time.
 *
 *   2024 Gazetteer, places:     https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
 *   2024 Gazetteer, ZIP areas:  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip
 *   2020 ZIP area to place:     https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt
 *
 * usage: node scripts/build-travel-towns.js <folder with 2024_Gaz_place_national.txt, 2024_Gaz_zcta_national.txt and
 *        tab20_zcta520_place20_natl.txt (or zcta_place.txt)>
 *
 * A place is a town in the 50 states or DC: its name without the Census kind ("Vancouver city" is "Vancouver"), its
 * state and its centre (the Census internal point). A ZIP code is the place its area overlaps most, or, when it overlaps
 * none, the nearest place in its state (the state of most ZIP codes sharing its first three digits). `rank` is how many ZIP codes are a place's, a stand-in for its size, so a search lists the
 * bigger town first.
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/build-travel-towns.js <folder>'); process.exit(2); }
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8').replace(/^﻿/, '');
const STATES = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR',
  'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']);

// The names people use where the Census name is a government's ("Nashville-Davidson metropolitan government (balance)").
const NAMED = {
  'GA:Athens-Clarke County unified government (balance)': 'Athens',
  'GA:Augusta-Richmond County consolidated government (balance)': 'Augusta',
  'GA:Macon-Bibb County': 'Macon',
  'IN:Indianapolis city (balance)': 'Indianapolis',
  'KY:Lexington-Fayette urban county': 'Lexington',
  'KY:Louisville/Jefferson County metro government (balance)': 'Louisville',
  'MT:Anaconda-Deer Lodge County': 'Anaconda',
  'MT:Butte-Silver Bow (balance)': 'Butte',
  'TN:Nashville-Davidson metropolitan government (balance)': 'Nashville',
  'TN:Hartsville/Trousdale County': 'Hartsville',
  'TN:Lynchburg, Moore County metropolitan government': 'Lynchburg',
  'CT:Milford city (balance)': 'Milford',
  'ID:Boise City city': 'Boise',
  'HI:Urban Honolulu CDP': 'Honolulu',
  'CA:San Buenaventura (Ventura) city': 'Ventura',
  'CA:El Paso de Robles (Paso Robles) city': 'Paso Robles',
};
const KINDS = [' city and borough', ' metro township', ' metropolitan government', ' consolidated government',
  ' unified government', ' urban county', ' municipality', ' corporation', ' comunidad', ' zona urbana', ' borough',
  ' village', ' city', ' town', ' CDP'];
function townName(state, raw) {
  const named = NAMED[`${state}:${raw}`];
  if (named) return { name: named, alias: null };
  let name = raw.replace(/ \(balance\)$/, '');
  for (const kind of KINDS) {
    if (name.endsWith(kind)) { name = name.slice(0, -kind.length); break; }
  }
  const alias = /\(([^)]+)\)/.exec(name);
  return { name: name.replace(/\s*\([^)]*\)/, '').trim(), alias: alias ? alias[1].trim() : null };
}

const rows = (text) => text.split(/\r?\n/).filter(Boolean).map((line) => line.split('\t').map((v) => v.trim()));
const [, ...placeRows] = rows(read('2024_Gaz_place_national.txt'));
const places = [];
const byGeoid = new Map();
for (const [usps, geoid, , rawName, , , aland, , , , lat, lon] of placeRows) {
  if (!STATES.has(usps)) continue;
  const { name, alias } = townName(usps, rawName);
  const place = { geoid, name, alias, state: usps, lat: Number(lat), lon: Number(lon), aland: Number(aland), rank: 0 };
  if (!name || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
  byGeoid.set(geoid, place);
  places.push(place);
}

// Each ZIP area's place: the one it shares the most land with.
const relText = fs.existsSync(path.join(dir, 'tab20_zcta520_place20_natl.txt'))
  ? read('tab20_zcta520_place20_natl.txt') : read('zcta_place.txt');
const best = new Map();
for (const line of relText.split(/\r?\n/).slice(1)) {
  const f = line.split('|');
  const zip = f[1]; const geoid = f[9]; const part = Number(f[16]);
  if (!zip || !geoid || !byGeoid.has(geoid) || !(part > 0)) continue;
  const had = best.get(zip);
  if (!had || part > had.part) best.set(zip, { geoid, part });
}
const [, ...zctaRows] = rows(read('2024_Gaz_zcta_national.txt'));
const rad = (d) => (d * Math.PI) / 180;
function nearest(lat, lon, state) {
  let found = null; let dist = Infinity;
  const cos = Math.cos(rad(lat));
  for (const p of places) {
    if (state && p.state !== state) continue;
    const dy = p.lat - lat; const dx = (p.lon - lon) * cos;
    const d = dx * dx + dy * dy;
    if (d < dist) { dist = d; found = p; }
  }
  return found;
}
// A ZIP code's state, for one that overlaps no place: the state most ZIP codes with its first three digits are in.
const prefixStates = new Map();
for (const [zip, { geoid }] of best) {
  const prefix = zip.slice(0, 3);
  if (!prefixStates.has(prefix)) prefixStates.set(prefix, new Map());
  const counts = prefixStates.get(prefix);
  const st = byGeoid.get(geoid).state;
  counts.set(st, (counts.get(st) || 0) + 1);
}
const stateOfPrefix = (zip) => {
  const counts = prefixStates.get(zip.slice(0, 3));
  return counts ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
};
const zips = {};
let near = 0;
for (const [zip, , , , , lat, lon] of zctaRows) {
  if (!/^\d{5}$/.test(zip)) continue;
  let place = best.has(zip) ? byGeoid.get(best.get(zip).geoid) : null;
  if (!place) {
    if (/^00[6-9]/.test(zip)) continue; // Puerto Rico and the Virgin Islands
    place = nearest(Number(lat), Number(lon), stateOfPrefix(zip)) || nearest(Number(lat), Number(lon));
    near += 1;
  }
  if (!place) continue;
  zips[zip] = place;
  place.rank += 1;
}

places.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name) || a.geoid.localeCompare(b.geoid));
const index = new Map(places.map((p, i) => [p, i]));
const round = (v) => Math.round(v * 10000) / 10000;
const out = {
  v: 1,
  source: 'U.S. Census Bureau 2024 Gazetteer (places, ZIP Code Tabulation Areas) and 2020 ZCTA-to-place relationship file; public domain',
  // [geoid, name, state, lat, lon, rank, alias?]
  places: places.map((p) => [p.geoid, p.name, p.state, round(p.lat), round(p.lon), p.rank, ...(p.alias ? [p.alias] : [])]),
  // ZIP code -> index in places
  zips: Object.fromEntries(Object.entries(zips).sort(([a], [b]) => a.localeCompare(b)).map(([zip, p]) => [zip, index.get(p)])),
};
const file = path.join(__dirname, '../data/travelTowns.json');
fs.writeFileSync(file, `${JSON.stringify(out)}\n`);
console.log(`travelTowns.json: ${places.length} places, ${Object.keys(zips).length} ZIP codes (${near} by nearest place), ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
