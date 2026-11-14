'use strict';
// Logan County, Ohio: the County Auditor's "Full Real Estate Data (CAMA & Tax in XML format)" (its daily Public Records Extract), on the Auditor's
// "CAMA and Tax Files" page, read like Geauga County's (lib/issg.cjs). No license and no limit on use are stated on the page or the Auditor's website.
// Few rows carry a city or ZIP, so the county's ZIP codes (from the Census) let an address find it.

module.exports = require('../lib/issg.cjs').issgCounty({
  fips: '39091', county: 'Logan County', publisher: 'Logan County Auditor', source: 'oh-logan',
  file: 'https://realestate.logancountyohio.gov/api/Document/PublicRecordsXML.zip',
});
