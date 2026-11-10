// ============================================================
// JOB: Property tax watch (the Home Money Check's yearly watch)
//
// Once a week, tells the confirmed owner of a house the county values
// above similar houses on its street, once for each year of county
// values, in counties with similar homes switched on. A county's new
// roll reaches Homes through its release, so the week it arrives is the
// week owners hear. The notification's own key is the claim, so servers
// without leader election send one.
// ============================================================

const { evaluate } = require('../services/propertyTaxWatch');

module.exports = async function propertyTaxWatch() {
  return evaluate();
};
