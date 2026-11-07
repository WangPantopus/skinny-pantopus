'use strict';

/**
 * Which county a ZIP code is mostly in, for counting only: a ZIP across a county line goes
 * to the larger side, and it is never used to answer a lookup. data/zipCounty.json comes
 * from the Census Bureau's public file (scripts/property-index/build-zip-county.cjs).
 */

let byZip = null;

function load() {
  byZip = new Map();
  for (const [fips, zips] of Object.entries(require('../../data/zipCounty.json'))) {
    for (const zip of zips.split(' ')) byZip.set(zip, fips);
  }
}

function countyOfZip(zip) {
  if (!byZip) load();
  return byZip.get(zip) || null;
}

module.exports = { countyOfZip };
