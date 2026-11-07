/**
 * Once a day: yesterday's county lookups and vendor calls, into the log (counts only).
 * The whole report is GET /api/admin/property-records/report and
 * scripts/eval/property-records-report.js; the rows behind it stay 45 days.
 */

const logger = require('../utils/logger');
const counts = require('../services/propertyRecords/counts');
const { loadReport } = require('../services/propertyRecords/report');

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP = 25;
const brief = (rows) => rows.slice(0, TOP).map(({ fips, state, unanswered, searches_unanswered: searches }) => ({ fips, state, unanswered, searches }));

async function propertyRecordsDaily() {
  const report = await loadReport({ days: 1, until: new Date(Date.now() - DAY_MS) });
  logger.info('property_records.daily', {
    day: report.to,
    totals: report.totals,
    vendors: report.vendors,
    servers: report.servers,
    build_next: brief(report.queue),
    ready_to_go_live: brief(report.ready),
    no_county: brief(report.no_county),
  });
  if (report.attom_calls) {
    logger.warn('property_records.attom_called', {
      day: report.to,
      calls: report.attom_calls,
      counties: report.counties.filter((row) => row.attom_calls).map(({ fips, attom_calls: calls }) => ({ fips, calls })),
    });
  }
  if (report.servers_disagree) logger.warn('property_records.servers_disagree', { servers: report.servers });
  await counts.prune();
}

module.exports = propertyRecordsDaily;
