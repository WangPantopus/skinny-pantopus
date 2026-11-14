'use strict';
// Dakota County, Minnesota: the state's open parcels (mn-parcels.cjs), with each home's bedrooms and baths from the county's own
// Tax Parcels, which Dakota County releases on the Minnesota Geospatial Commons "without fees or use restrictions" under the Open
// Database License (its GIS Database Disclaimer goes with any copy of the data). Only the parcel number, the two counts, the
// several-buildings flag and the update date are asked for: the owner, mailing and tax columns in the layer never are. A parcel
// the county flags as having several buildings takes nothing, since its counts may be more than one home's.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { isoDate } = require('../lib/addresses.cjs');
const { fillHomes, bathFacts, describe, monthOf } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { countyParcels } = require('./mn-parcels.cjs');

const FIPS = '27037';
const COUNTY = 'Dakota County';
const LAYER = 'https://gis2.co.dakota.mn.us/arcgis/rest/services/DCGIS_OL_PropertyInformation/MapServer/71';
const COLUMNS = ['TAXPIN', 'BEDS', 'BATH', 'MULTI_BLDG', 'Update_Date'];

async function* build({ work }) {
  const dwellings = new Map();
  let newest = 0;
  let several = 0;
  for await (const row of cached(path.join(work, 'mn-dakota', 'tax-parcels.jsonl.gz'), () => layerRows(LAYER, COLUMNS))) {
    const pin = String(row.TAXPIN ?? '').trim();
    if (!pin) continue;
    newest = Math.max(newest, Number(row.Update_Date) || 0);
    if (String(row.MULTI_BLDG ?? '').trim().toUpperCase() === 'Y') {
      // Several buildings: two dwellings as far as the fill is concerned, so neither count is taken.
      dwellings.set(pin, [{}, {}]);
      several += 1;
      continue;
    }
    const beds = Number(row.BEDS);
    const facts = { bedrooms: Number.isInteger(beds) && beds > 0 && beds <= 15 ? beds : null, ...bathFacts(Number(row.BATH)) };
    if (facts.bedrooms || facts.bathrooms) dwellings.set(pin, [facts]);
  }
  const asOf = isoDate(newest);
  if (!asOf) throw new Error('The county\'s tax parcels no longer say when they were updated');
  log(`${COUNTY}: ${dwellings.size - several} parcels with bedrooms or baths in the county's tax parcels, ${several} with several buildings`);
  const entry = await countyParcels(work, FIPS);
  const counts = fillHomes(entry.records, dwellings);
  log(describe(COUNTY, counts));
  yield {
    ...entry,
    publisher: 'Dakota County and MnGeo',
    dataset: `${entry.dataset} and the county's ${monthOf(asOf)} tax parcels`,
    method: 'county',
    source: 'mn-dakota',
    title: 'County records',
  };
}

module.exports = {
  build,
  dictionary: {
    layer: LAYER,
    facts: { bedrooms: 'BEDS', bathrooms: 'BATH (a half bath as .5; a total, so no full or half count)' },
  },
};
