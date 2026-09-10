const { deliverPending } = require('../services/gigStopService');
module.exports = async function deliverGigStop() { return deliverPending(25); };
