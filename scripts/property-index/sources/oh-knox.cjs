'use strict';
// Knox County, Ohio: the County Auditor's free "CAMADatabase.zip", linked from its Schneider-hosted site and refreshed daily, read with lib/mvp.cjs.
// The site's terms of service give the data "as is", for reference and with no warranty; no license and no limit on use are stated. Most rows carry
// no city or ZIP, so the county's ZIP codes (from the Census) let an address find it.

module.exports = require('../lib/mvp.cjs').mvpCounty({
  fips: '39083', county: 'Knox County', publisher: 'Knox County Auditor', source: 'oh-knox',
  site: 'https://knoxoh-auditor.schneidergis.com/',
});
