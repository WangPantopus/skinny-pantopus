#!/usr/bin/env node
/**
 * Prints what shadow mode (ADDRESS_POSTAL_SHADOW=google) counted: Google's own postal categories
 * and what Google's answer alone would have decided. Counts only, no addresses, and nothing from
 * another provider. Run it with the database environment of the server that ran the shadow.
 *
 * usage: node scripts/eval/postal-shadow-report.js [--days 30]
 */

const supabaseAdmin = require('../../config/supabaseAdmin');

const PAGE = 1000;
const FIELDS = ['verdict', 'dpv', 'footnotes', 'home_or_business', 'mail_drop', 'vacant', 'no_stat', 'record_type', 'route', 'cass_processed', 'usps_suspended'];

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const days = Number(option('days', 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const counts = Object.fromEntries(FIELDS.map((field) => [field, {}]));
  let total = 0;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('AddressVerificationEvent')
      .select('raw_response')
      .eq('event_type', 'postal_shadow')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const { raw_response: row } of data || []) {
      total += 1;
      for (const field of FIELDS) {
        const value = row?.[field] ?? 'none';
        counts[field][value] = (counts[field][value] || 0) + 1;
      }
    }
    if (!data || data.length < PAGE) break;
  }

  console.log(`Shadow checks in the last ${days} days: ${total}\n`);
  for (const field of FIELDS) {
    console.log(field);
    for (const [value, count] of Object.entries(counts[field]).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(value).padEnd(26)} ${String(count).padStart(6)}  ${total ? Math.round((count / total) * 100) : 0}%`);
    }
    console.log('');
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
