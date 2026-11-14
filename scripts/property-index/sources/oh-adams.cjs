'use strict';
// Adams County, Ohio: the County Auditor's free "CAMADatabase.zip" (Governmax text tables), linked from its Schneider-hosted site and refreshed daily,
// read with lib/mvp.cjs. The site's terms of service give the data "as is", for reference and with no warranty; no license and no limit on use are stated.

module.exports = require('../lib/mvp.cjs').mvpCounty({
  fips: '39001', county: 'Adams County', publisher: 'Adams County Auditor', source: 'oh-adams',
  site: 'https://adamsoh-auditor.schneidergis.com/', format: 'governmax',
});
