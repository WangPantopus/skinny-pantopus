// Compatibility entry for old operator references. Current comparisons are
// read-only SQL snapshots; legacy derived rows are retained, never converted.
async function billBenchmarkRefresh() {
  return { status: 'retired', calculation: 'current_sql_snapshot' };
}
module.exports = billBenchmarkRefresh;
