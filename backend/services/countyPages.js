'use strict';

/**
 * The county's own page for a home, when we know it: people check a fact at the source
 * and confirm it here with a tap (config/countyPages.js). Without a county record the
 * county comes from the point on the map (the tract lookup is cached for a year, so this
 * asks the Census geocoder at most once per place). No answer in time means no link, never a wait.
 */

const logger = require('../utils/logger');
const PAGES = require('../config/countyPages');
const { stateCode, stateOfCounty } = require('./propertyRecords/addressKey');

const TRACT_WAIT_MS = 800;
const STATES = new Set(Object.keys(PAGES).map((fips) => stateOfCounty(fips)));

async function countyFrom({ jurisdiction, state, lat, lng }) {
  if (jurisdiction) return jurisdiction;
  if (!STATES.has(stateCode(state)) || lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  const { geocodeToTractCached } = require('./ai/neighborhoodProfileService');
  let timer;
  const tract = await Promise.race([
    geocodeToTractCached(Number(lat), Number(lng)).catch(() => null),
    new Promise((resolve) => { timer = setTimeout(() => resolve(null), TRACT_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  return tract?.stateCode && tract?.countyCode ? `${tract.stateCode}${tract.countyCode}` : null;
}

/** @returns {Promise<{ url: string, label: string }|null>} */
async function forAddress({ parcel = null, ...where }) {
  try {
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
  state: home.state,
  lat: home.location?.latitude,
  lng: home.location?.longitude,
});

module.exports = { forAddress, forHome };
