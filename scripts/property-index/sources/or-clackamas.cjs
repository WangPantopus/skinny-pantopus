'use strict';
// Clackamas County, Oregon: Metro's RLIS taxlots (or-rlis.cjs), with each home's bedrooms and full baths from the county GIS
// office's own taxlot layer (Taxlots CMap, public on the county's ArcGIS Online, updated weekly, offered "as is" with no limit
// on use). The layer has no half baths, so it never says a home's bath total: only full baths are added. Only the account
// number and the two counts are asked for; the layer's owner columns never are. An account the layer lists twice with
// different counts takes nothing.

const path = require('node:path');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { isoDate } = require('../lib/addresses.cjs');
const { fillHomes, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyTaxlots } = require('./or-rlis.cjs');

const FIPS = '41005';
const COUNTY = 'Clackamas County';
const LAYER = 'https://services3.arcgis.com/I2eWXOndpF9m8oKC/arcgis/rest/services/Taxlots_CMap/FeatureServer/0';
const COLUMNS = ['PARCEL_NUMBER', 'BEDROOMS', 'FULL_BATHS'];

const count = (value, most) => (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= most ? Number(value) : null);

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The county layer\'s description');
  const asOf = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!asOf) throw new Error('The county layer no longer says when it changed');
  const dwellings = new Map();
  for await (const row of cached(path.join(work, 'or-clackamas', 'taxlots.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const account = String(row.PARCEL_NUMBER ?? '').trim();
    if (!account) continue;
    const facts = { bedrooms: count(row.BEDROOMS, 15), full_baths: count(row.FULL_BATHS, 12) };
    if (!facts.bedrooms && !facts.full_baths) continue;
    const held = dwellings.get(account);
    // The same account on two taxlots says the same counts twice; different counts are two buildings.
    if (held && held.some((other) => other.bedrooms === facts.bedrooms && other.full_baths === facts.full_baths)) continue;
    dwellings.set(account, [...(held || []), facts]);
  }
  log(`${COUNTY}: ${dwellings.size} accounts with bedrooms or full baths in the county's taxlot layer`);
  const entry = await countyTaxlots(work, FIPS);
  const counts = fillHomes(entry.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...entry,
    publisher: 'Clackamas County Assessor and Metro',
    dataset: `${entry.dataset} and the county's ${monthOf(asOf)} taxlot layer`,
    source: 'or-clackamas',
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { bedrooms: 'BEDROOMS', full_baths: 'FULL_BATHS' },
  },
};
