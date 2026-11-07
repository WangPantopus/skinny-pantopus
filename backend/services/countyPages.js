'use strict';

/**
 * The county's own page for a home, when we know it: people check a fact at the source
 * and confirm it here with a tap (config/countyPages.js). Without a county record the
 * county comes from the point on the map (the tract lookup is cached for a year, so this
 * asks the Census geocoder at most once per place). No answer in time means no link, never a wait.
 *
 * With link and confirm on (config/countyLinks.js) the links come from config/countyLinks.json instead: the home's
 * own page where the county's site takes its parcel number in the address and the record gives us that number, the
 * county's property search otherwise. Where a town keeps the records (Connecticut), the town's row answers, found by the
 * home's own postal town; the record's parcel number opens the home's page only when the record names that same town.
 */

const logger = require('../utils/logger');
const PAGES = require('../config/countyPages');
const countyLinks = require('../config/countyLinks');
const { stateCode, stateOfCounty } = require('./propertyRecords/addressKey');

const TRACT_WAIT_MS = 800;
const STATES = new Set(Object.keys(PAGES).map((fips) => stateOfCounty(fips)));
const LINKED = countyLinks.table.counties || {};
const LINKED_STATES = new Set(Object.keys(LINKED).map((fips) => stateOfCounty(fips)));
// Where towns keep the records, every town of the state by name, so a home's postal town finds its row whatever region
// a record put it in.
const TOWNS = new Map(Object.entries(LINKED).flatMap(([fips, county]) => Object.entries(county.towns || {})
  .map(([name, row]) => [`${stateOfCounty(fips)}:${name.toLowerCase()}`, row])));
// How a county's site writes the number it takes in a link, from the record's own parcel number.
const PARCEL_FORMS = {
  digits: (parcel) => parcel.replace(/\D/g, ''),
  // A number the state's file writes as 3141.0.
  whole: (parcel) => parcel.replace(/\.0+$/, ''),
  as_is: (parcel) => parcel,
  // Allegheny's search box: the first ten characters, lowercase.
  lower10: (parcel) => parcel.slice(0, 10).toLowerCase(),
};

async function countyFrom({ jurisdiction, state, lat, lng }, states = STATES) {
  if (jurisdiction) return jurisdiction;
  if (!states.has(stateCode(state)) || lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const { geocodeToTractCached } = require('./ai/neighborhoodProfileService');
  let timer;
  const tract = await Promise.race([
    geocodeToTractCached(Number(lat), Number(lng)).catch(() => null),
    new Promise((resolve) => { timer = setTimeout(() => resolve(null), TRACT_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  return tract?.stateCode && tract?.countyCode ? `${tract.stateCode}${tract.countyCode}` : null;
}

/**
 * The row that keeps this home's records: the county's, or its town's where the town keeps them. `deep`: whether the
 * record's parcel number belongs to that row (a town's only when the record names the home's own postal town).
 */
function linkedRow(fips, municipality, city) {
  const county = LINKED[fips];
  if (!county?.towns) return county ? { row: county, deep: true } : null;
  const town = (name) => TOWNS.get(`${stateOfCounty(fips)}:${String(name || '').trim().toLowerCase()}`);
  const byCity = town(city);
  const byRecord = town(municipality);
  return byCity || byRecord ? { row: byCity || byRecord, deep: Boolean(byCity && byCity === byRecord) } : null;
}

/**
 * The home's own page when the row has a pattern and we have its number, the search page otherwise. `extra` names any
 * other place the pattern writes the number, and how ({ parcel10: 'lower10' } fills {parcel10}).
 */
function linkFor(row, parcel) {
  const raw = parcel && row.deep ? String(parcel).trim() : '';
  const number = raw ? PARCEL_FORMS[row.form || 'as_is'](raw) : '';
  if (!number) return row.url ? { url: row.url, kind: 'search' } : null;
  const url = Object.entries(row.extra || {}).reduce((link, [name, form]) => link.replace(`{${name}}`, encodeURIComponent(PARCEL_FORMS[form](raw))),
    row.deep.replace('{parcel}', encodeURIComponent(number)));
  return { url, kind: 'deep' };
}

async function linkedPage({ parcel, municipality, city, ...where }) {
  const found = linkedRow(await countyFrom(where, LINKED_STATES), municipality, city);
  const link = found && linkFor(found.row, found.deep ? parcel : null);
  if (!link) return null;
  return { ...link, name: found.row.name, label: `Check ${found.row.name}'s page for this home` };
}

/** @returns {Promise<{ url: string, label: string, kind?: 'deep'|'search', name?: string }|null>} */
async function forAddress({ parcel = null, municipality = null, city = null, ...where }) {
  try {
    if (countyLinks.enabled()) return await linkedPage({ parcel, municipality, city, ...where });
    const page = PAGES[await countyFrom(where)];
    if (!page) return null;
    return {
      url: parcel && page.parcel ? page.parcel.replace('{parcel}', encodeURIComponent(parcel)) : page.url,
      label: `Check ${page.name}'s page for this home`,
    };
  } catch (err) {
    logger.info('county_page.unavailable', { error: err.name });
    return null;
  }
}

const forHome = ({ copy, home }) => forAddress({
  jurisdiction: copy?.jurisdiction,
  parcel: copy?.facts?.parcel_number ?? copy?.building?.parcel_number,
  municipality: copy?.facts?.municipality,
  city: home.city,
  state: home.state,
  lat: home.location?.latitude,
  lng: home.location?.longitude,
});

module.exports = { forAddress, forHome };
