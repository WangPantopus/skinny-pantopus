#!/usr/bin/env node
/**
 * Prints the router's report: which counties people asked for and what answered them, the next
 * counties to build, the ones ready to go live, and calls to each vendor. Counts only, no addresses.
 * Run it with the database environment of the server to read. With the property index's settings
 * too (PROPERTY_RECORDS_MANIFEST_URL and the reader key), it also knows which counties have a release.
 *
 * usage: node scripts/eval/property-records-report.js [--days 7] [--json]
 */

const { loadReport } = require('../../services/propertyRecords/report');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const countyLine = (row) => `  ${row.fips}  ${row.state}  ${String(row.name || '(no name)').padEnd(30)}  unanswered ${row.unanswered}  searches ${row.searches_unanswered}`;

function section(title, rows, line) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows.slice(0, 50)) console.log(line(row));
}

function shadowWords(shadow) {
  const entries = Object.entries(shadow);
  return entries.length ? `  shadow ${entries.map(([match, count]) => `${match} ${count}`).join(', ')}` : '';
}

async function main() {
  const report = await loadReport({ days: Number(option('days', 7)) });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 1));
    return;
  }
  console.log(`County records, ${report.from} to ${report.to}`);
  const { answered, unanswered, waiting, answered_share: share } = report.totals;
  console.log(`Lookups: ${answered} answered, ${unanswered} unanswered${share === null ? '' : ` (${share}% answered)`}, ${waiting} waiting on storage`);
  console.log(`ATTOM calls: ${report.attom_calls} (must stay 0)`);
  console.log(`Vendor calls: ${Object.entries(report.vendors).map(([vendor, count]) => `${vendor} ${count}`).join(', ') || 'none'}`);
  for (const server of report.servers) console.log(`Server ${server.role}: ${server.live} live, ${server.shadow} shadow, lists ${server.hash}`);
  if (report.servers_disagree) console.log('SERVERS DISAGREE: one has not followed a switch');
  if (!report.index_read) console.log('The index could not be read here, so counties with a release are not told apart: see All counties.');

  section('Build next (asked for, no release)', report.queue, countyLine);
  section('Ready to go live (asked for, release published, not live)', report.ready, countyLine);
  section('All counties', report.counties, (row) => `${countyLine(row)}  ${row.mode}  answered ${row.answered}  no record ${row.no_record}  several ${row.ambiguous}  waiting ${row.waiting}  attom ${row.attom_calls}${row.as_of ? `  as of ${row.as_of}, ${row.records} records` : ''}${shadowWords(row.shadow)}`);
  section('No county known (a ZIP not on the Census list, or Connecticut)', report.no_county, (row) => `  ${row.state}  unanswered ${row.unanswered}  answered ${row.answered}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
