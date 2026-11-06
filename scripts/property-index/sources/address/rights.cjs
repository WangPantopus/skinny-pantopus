'use strict';
// The rights register for address points: what each source's terms say, read on the date shown, and whether the address
// registry may use it. docs/research/provider-replacement/cost-and-rights.md section 4 has the rules. A source that isn't
// here, or isn't `use: true`, never enters a release.
//
// OpenAddresses sources Overture doesn't distribute are cleared one by one in openaddresses-rights.json.
//
// In every case the registry answers one person about their own address (does it exist, which units, where is its
// point). It is never a mailing list: the National Address Database's terms and some state laws forbid that, and nothing
// in Pantopus mails from it. Anything derived from OpenStreetMap stays out (share-alike).

const CHECKED = '2026-11-06';

const NAD = {
  id: 'nad',
  name: 'U.S. DOT National Address Database',
  publisher: 'U.S. Department of Transportation',
  use: true,
  terms: 'Work of the federal government, not subject to copyright (17 U.S.C. 105), "available for re-use without limitation or restriction"; CC0 on data.gov. As is. "Not intended for use as a mailing list" and subject to state statutes that prohibit that.',
  url: 'https://maps.dot.gov/dotgis/NationalAddressDatabaseMetadata.xml',
  credit: 'U.S. Department of Transportation, the U.S. Census Bureau, and the state, local and tribal partners of the National Address Database',
  checked: CHECKED,
};

// Overture's licence on a row, for the sources Overture distributes. Overture's attribution page says what each is
// (https://docs.overturemaps.org/attribution/, read on the date above).
const OVERTURE_LICENSES = {
  'LicenseRef-Public-Domain-US': { use: true, terms: 'Federal work (NAD; taken from the National Address Database directly instead)' },
  'LicenseRef-Public-Domain-US-CA-Law': { use: true, terms: 'Public domain by judicial interpretation of the California Public Records Act (County of Santa Clara v. Superior Court, 2009)' },
  'LicenseRef-Public-Domain-US-FL-Law': { use: true, terms: 'Public domain by judicial decision in Florida (Microdecisions v. Skinner, 2004)' },
  'CC0-1.0': { use: true, terms: 'CC0' },
  'PDDL-1.0': { use: true, terms: 'Public Domain Dedication and License' },
  'CC-BY-4.0': { use: true, credit: true, terms: 'CC BY 4.0: credit on the data sources page' },
  // A label for "see this source's terms": each is read below, and anything not listed stays out.
  'LicenseRef-Proprietary': { use: false, terms: 'Per source' },
};

// Per source, by OpenAddresses's name for it. Wins over the licence on the row.
const SOURCES = {
  'us/ma/statewide': { use: true, terms: 'MassGIS: public domain' },
  'us/co/statewide': { use: true, terms: "Colorado Governor's Office of Information Technology: public data" },
  'us/mn/statewide': { use: true, terms: 'Minnesota Department of Public Safety: public data' },
  'us/or/statewide': { use: true, terms: 'Oregon GeoHub: no usage restrictions; credits and caveats in the metadata', credit: 'Oregon GeoHub' },
  'us/ny/city_of_new_york': { use: true, terms: 'NYC Open Data terms of use; NYC Department of City Planning', credit: 'NYC Department of City Planning' },
  'us/ca/los_angeles': { use: true, terms: 'Los Angeles County: license to copy, publish, distribute, adapt and exploit the data for commercial or personal use' },
  'us/ca/santa_cruz': { use: true, terms: 'CC0 as Overture assumes, and the California Public Records Act' },
  'us/fl/palm_beach': { use: true, terms: 'Public domain by judicial decision in Florida' },
  'us/fl/orange': { use: true, terms: 'Public domain by judicial decision in Florida' },
  'us/mi/oakland': { use: true, terms: 'Oakland County, Michigan: open data' },
  'us/ms/statewide-east': { use: true, terms: 'MARIS, Mississippi: open data' },
  'us/ms/statewide-west': { use: true, terms: 'MARIS, Mississippi: open data' },
  'us/ms/desoto': { use: true, terms: 'DeSoto County, Mississippi: no commercial usage restrictions or attribution requirements' },
  // Held until someone reads these terms and they allow it.
  'us/ca/san_diego': { use: false, terms: 'SanGIS has its own license (indemnification); the register names it. Held until read' },
  'us/ca/stanislaus': { use: false, terms: 'The register reads Stanislaus as own use only. Held' },
  'us/mi/kent': { use: false, terms: 'Kent County geospatial data license agreement: limited and revocable. Held' },
  'us/mi/allegan': { use: false, terms: 'Allegan County geospatial data license agreement: limited and revocable. Held' },
  'us/mi/muskegon': { use: false, terms: 'Muskegon County data use agreement: limited and revocable. Held' },
  'us/nv/carson_city': { use: false, terms: 'Carson City: its own license, not read yet. Held' },
};

// State and county layers read directly (points.cjs).
const POINT_LAYERS = [
  {
    id: 'wa-clark',
    state: 'WA',
    url: 'https://services2.arcgis.com/ylxwjFBdCPBzP16d/arcgis/rest/services/SitusAddress/FeatureServer/0',
    fields: { number: 'HsNbr', pre: 'StDir', name: 'StName', suffix: 'Stype', unit: 'Apt', building: 'Building', city: 'StCity', zip: 'Zp1' },
    terms: "Clark County, Washington: public layer, disclaimers only (read for the property index, November 5); the founder's OK for the county's public data",
  },
];

/** Whether a row Overture distributes may enter the registry. */
function overtureRow(dataset, license) {
  if (!dataset || dataset === 'NAD') return false;
  const named = SOURCES[dataset];
  if (named) return named.use;
  // Overture marks each of Mississippi's county sources LicenseRef-Proprietary and credits MARIS's open data for them.
  if (dataset.startsWith('us/ms/')) return true;
  return Boolean(OVERTURE_LICENSES[license]?.use);
}

module.exports = { CHECKED, NAD, OVERTURE_LICENSES, SOURCES, POINT_LAYERS, overtureRow };
