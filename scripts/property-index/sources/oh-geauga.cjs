'use strict';
// Geauga County, Ohio: the County Auditor's "Public Records Extract", rebuilt daily and linked from its real estate site's "Real Estate & GIS Data
// Downloads", with a published file layout: one XML table per record type, each row one element whose attributes are its columns. No license
// and no limit on use are stated with it; the Auditor's site terms bar only unlawful or harmful use. Year built, living area, rooms, bedrooms,
// full and half baths, stories, acres, the appraised land and improvement values (Ohio appraises at full market value; tax is figured on 35% of
// it) and the last single-parcel sale the Auditor marked valid. Five tables are read, and only the columns named here: the owner, payment, tax,
// distribution and delinquency tables are never opened, and the parcel table's owner, taxpayer and lender columns are never asked for.
// The extract holds the last three tax years; the build reads the latest.

module.exports = require('../lib/issg.cjs').issgCounty({
  fips: '39055', county: 'Geauga County', publisher: 'Geauga County Auditor', source: 'oh-geauga',
  file: 'https://realestate.geauga.oh.gov/api/Document/PublicRecordsExtract.zip',
});
