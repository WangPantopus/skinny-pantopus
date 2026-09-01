// ============================================================
// JOB: Rate Watch Evaluate (Wave 2b — Home Record Watch)
//
// Compares every record watch against the current Freddie Mac PMMS
// 30-year weekly average and alerts the ones whose refi window is
// open. The survey publishes Thursdays; this runs Friday 02:00 UTC so
// one evaluation sees each fresh reading. Idempotence lives in the
// service (claim-before-send on the watch row), so instances without
// leader election stay safe.
// ============================================================

const { evaluateWatches } = require('../services/homeRecordWatchService');

module.exports = async function rateWatchEvaluate() {
  return evaluateWatches();
};
