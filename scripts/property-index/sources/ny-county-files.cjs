'use strict';
// New York counties whose own parcel files count half baths, which the state's public tax parcels (ny-parcels.cjs) leave out: there a
// home has its full baths and no total. Each county here is the state's release with the bath counts (and stories, where given) from:
// - Erie: the City of Buffalo's 2026-27 assessment roll, for the homes in Buffalo (the city assesses its own parcels). Its notice
//   disclaims any warranty or liability and says it isn't the city's official record; it states no limit on use. Then, for the homes
//   Buffalo's roll doesn't give, Erie County's own parcels (Real Property Tax Services and the Office of GIS, on the county's ArcGIS
//   Online, "for display, analysis and distribution", no license and no limit on use), whose assessment details date from about
//   September 2023. Its bath count is a total: 2.5 is two full baths and a half bath.
// - Rensselaer and Montgomery: each county's parcels as New York State's GIS office publishes them, under the state's own notice (as is,
//   no warranty, no limit on use), the same terms as the statewide file.
// - Tioga: the county's own parcel properties for 2025, on its ArcGIS Online, which state no license and no limit on use.
// - Warren: the county's master parcel view on its own ArcGIS Online, which states no license or limit on use (its parcel files have long
//   been published as is, at the user's own risk).
// Only one-family homes and mobile homes take a count, matched by town code and print key (a print key repeats from town to town), and
// only where every count both files give agrees: a different full bath or bedroom count means one file is about another building.
// Owner, mailing, exemption and taxable value columns are never asked for.

const path = require('node:path');
const { layerRows, cached } = require('../lib/services.cjs');
const { positive, word } = require('../lib/values.cjs');
const { fillHomes, bathFacts, describe } = require('../lib/fill.cjs');
const { log } = require('../lib/log.cjs');
const { COUNTIES, publishedOn, countyRelease } = require('./ny-parcels.cjs');

// The Assessor's Manual's one-family classes: a year-round house, a rural residence, an estate, a seasonal home, a mobile home. A file
// gives the class's code ("210") or the manual's short words for it ("1 Family Res").
const ONE_FAMILY = new Set(['210', '211', '240', '241', '242', '250', '260', '270']);
const ONE_FAMILY_WORDS = /^(1 Family Res|Rural res|Estate|Seasonal res|Mfg housing)$/i;
const oneFamily = (cls) => ONE_FAMILY.has(String(cls || '').slice(0, 3)) || ONE_FAMILY_WORDS.test(String(cls || '').trim());

const count = (value, most) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= most ? n : null;
};
// Half-floor stories ("1.5") are a house's own; anything else odd says nothing.
const storiesOf = (value) => {
  const n = positive(value);
  return n && n <= 5 && (n * 2) % 1 === 0 ? n : null;
};

/** A home's counts as the facts a record keeps. No full bath and no half bath says nothing. */
function dwelling({ beds, full, half, stories }) {
  const facts = { bedrooms: beds || null, stories: storiesOf(stories) };
  if (full !== null && half !== null && full + half > 0) {
    facts.full_baths = full || null;
    facts.half_baths = half || null;
    facts.bathrooms = full + half * 0.5;
  }
  return facts;
}

// A county's files, in order: a later file only adds what an earlier one didn't give.
const FILES = {
  Erie: [{
    layer: 'https://services8.arcgis.com/BMPgiPHUrkqJdtki/arcgis/rest/services/Parcels_20262027/FeatureServer/0',
    columns: ['SWIS', 'Print_Key', 'Property_Class_Code', 'F__of_Beds', 'F__of_Baths', 'F__of_Stories'],
    words: 'baths from the City of Buffalo assessment roll (2026-27) in Buffalo',
    // F__of_Baths holds the full baths and, after the point, the half baths: 2.1 is two full baths and a half bath.
    read: (row) => {
      const baths = Number(row.F__of_Baths);
      const whole = Number.isFinite(baths) && baths >= 0 ? Math.floor(baths + 1e-6) : null;
      return { key: `${word(row.SWIS) || ''}${word(row.Print_Key) || ''}`, cls: word(row.Property_Class_Code), beds: count(row.F__of_Beds, 15), full: whole === null ? null : count(whole, 12), half: whole === null ? null : count(Math.round((baths - whole) * 10), 6), stories: row.F__of_Stories };
    },
  }, {
    layer: 'https://services1.arcgis.com/CgOSc11uky3egK6O/arcgis/rest/services/Erie_County_Parcels/FeatureServer/0',
    oid: 'FID',
    cache: 'county',
    columns: ['SWIS', 'SBL', 'CLASS', 'BEDS', 'BATHS'],
    words: 'from Erie County parcels (assessment details of about September 2023) elsewhere',
    // Only its bath counts: its bedrooms are two years older than the state's, so they only check that it's the same home.
    only: ['bathrooms', 'full_baths', 'half_baths'],
    // BATHS is the total: a half is one half bath, and any other fraction says nothing.
    read: (row) => {
      const { full_baths: full = 0, half_baths: half = 0, bathrooms } = bathFacts(Number(row.BATHS));
      return { key: `${word(row.SWIS) || ''}${word(row.SBL) || ''}`, cls: word(row.CLASS), beds: count(row.BEDS, 15), full: bathrooms ? full : null, half: bathrooms ? half : null, stories: null };
    },
  }],
  Montgomery: {
    layer: 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/Montgomery_County_Parcels/FeatureServer/0',
    columns: ['SWIS', 'PRINT_KEY', 'PROP_CLASS', 'BEDROOMS', 'FULL_BATHS', 'HALF_BATHS', 'STORIES'],
    words: 'baths from Montgomery County parcels (New York State GIS)',
    read: (row) => ({ key: `${word(row.SWIS) || ''}${word(row.PRINT_KEY) || ''}`, cls: word(row.PROP_CLASS), beds: count(row.BEDROOMS, 15), full: count(row.FULL_BATHS, 12), half: count(row.HALF_BATHS, 6), stories: row.STORIES }),
  },
  Rensselaer: {
    layer: 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/Rensselaer_County/FeatureServer/0',
    columns: ['SWIS', 'PRINT_KEY', 'PROP_CLASS', 'BEDROOMS', 'FULL_BATHS', 'HALF_BATHS', 'STORIES'],
    words: 'baths from Rensselaer County parcels (New York State GIS)',
    read: (row) => ({ key: `${word(row.SWIS) || ''}${word(row.PRINT_KEY) || ''}`, cls: word(row.PROP_CLASS), beds: count(row.BEDROOMS, 15), full: count(row.FULL_BATHS, 12), half: count(row.HALF_BATHS, 6), stories: row.STORIES }),
  },
  Warren: {
    layer: 'https://services6.arcgis.com/Fg3XpDIUTR3JZZES/arcgis/rest/services/WCNY_Parcels_MASTER_new_view/FeatureServer/0',
    oid: 'FID',
    columns: ['SWIS', 'PRINT_KEY', 'PROP_CLASS', 'BEDROOMS', 'FULL_BATHS', 'HALF_BATHS', 'STORIES'],
    words: 'baths from Warren County parcels',
    read: (row) => ({ key: `${word(row.SWIS) || ''}${word(row.PRINT_KEY) || ''}`, cls: word(row.PROP_CLASS), beds: count(row.BEDROOMS, 15), full: count(row.FULL_BATHS, 12), half: count(row.HALF_BATHS, 6), stories: row.STORIES }),
  },
  Tioga: {
    layer: 'https://services3.arcgis.com/PvkAiSMFS7cpxnJP/arcgis/rest/services/Parcel_Properties_2025/FeatureServer/4',
    columns: ['SWIS_CODE', 'CURRENT_PRINT_KEY', 'BASE_PROP_CLASS', 'NO_OF_BEDROOMS', 'NO_OF_BATHS', 'NO_OF_HALF_BATHS'],
    words: 'baths from Tioga County parcel properties (2025)',
    read: (row) => ({ key: `${word(row.SWIS_CODE) || ''}${word(row.CURRENT_PRINT_KEY) || ''}`, cls: word(row.BASE_PROP_CLASS), beds: count(row.NO_OF_BEDROOMS, 15), full: count(row.NO_OF_BATHS, 12), half: count(row.NO_OF_HALF_BATHS, 6), stories: null }),
  },
};

// A count both give must be the same; the state's file is the record, and a file that disagrees changes nothing.
const agrees = (facts, found) => ['bedrooms', 'full_baths'].every((fact) => facts[fact] == null || found[fact] == null || facts[fact] === found[fact]);

async function* build({ work }) {
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const asOf = await publishedOn();
  for (const [name, file] of Object.entries(FILES)) {
    if (only.length && !only.includes(COUNTIES[name])) continue;
    const release = await countyRelease(work, name, asOf);
    const files = [].concat(file);
    for (const each of files) {
      const dwellings = new Map();
      let rows = 0;
      const cache = path.join(work, 'ny-county-files', `${release.fips}${each.cache ? `-${each.cache}` : ''}.jsonl.gz`);
      for await (const row of cached(cache, () => layerRows(each.layer, each.columns, { pageSize: 2000, ...(each.oid ? { oid: each.oid } : {}) }))) {
        rows += 1;
        const home = each.read(row);
        if (!home.key || !oneFamily(home.cls)) continue;
        if (!dwellings.has(home.key)) dwellings.set(home.key, []);
        dwellings.get(home.key).push(dwelling(home));
      }
      log(`${release.name}: ${rows} rows in the county's file, ${dwellings.size} one-family parcels`);
      // A record's id ends in the state's town code and print key ("14020099.99-9-9").
      const counts = fillHomes(release.records, dwellings, { keyOf: (record) => record.id.split(':').pop(), agrees, only: each.only });
      log(describe(release.name, counts));
    }
    yield { ...release, dataset: `${release.dataset}, with ${files.map((each) => each.words).join(' and ')}`, source: 'ny-county-files' };
  }
}

module.exports = {
  build,
  dictionary: {
    layer: Object.values(FILES).flat().map((file) => file.layer),
    facts: { bedrooms: ['F__of_Beds', 'BEDROOMS', 'NO_OF_BEDROOMS', 'BEDS'], full_baths: ['F__of_Baths', 'FULL_BATHS', 'NO_OF_BATHS', 'BATHS'], half_baths: ['F__of_Baths', 'HALF_BATHS', 'NO_OF_HALF_BATHS', 'BATHS'], bathrooms: ['F__of_Baths', 'FULL_BATHS', 'NO_OF_BATHS', 'BATHS'], stories: ['F__of_Stories', 'STORIES'] },
  },
};
