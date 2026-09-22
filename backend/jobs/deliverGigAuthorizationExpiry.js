const { deliverPending } = require('../services/gigAuthorizationExpiry');
module.exports = async function deliverGigAuthorizationExpiry() { return deliverPending(25); };
