'use strict';
// Clinton County, Ohio: the County Auditor's "Full Real Estate Data" (its daily Public Records Extract in XML), linked from the Auditor's Property Data
// Download page, read like Geauga County's (lib/issg.cjs). The Auditor's disclaimer and terms of service give the data "as is", for reference and with no
// warranty; no license and no limit on use are stated. Few rows carry a city or ZIP, so the county's ZIP codes (from the Census) let an address find it.

module.exports = require('../lib/issg.cjs').issgCounty({
  fips: '39027', county: 'Clinton County', publisher: 'Clinton County Auditor', source: 'oh-clinton',
  file: 'https://clintoncountyauditor.org/api/Document/PublicRecordsXML.zip',
});
