const { reconcilePending } = require('../services/gigStopService');
module.exports = async function reconcileGigStop() { return reconcilePending(100); };
