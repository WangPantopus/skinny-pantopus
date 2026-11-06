#!/usr/bin/env node
/**
 * Runs the same synthetic addresses down each path that decides on an address, against a real local
 * database, and prints whether they agree: the live check, the unit re-check, the stored answer the
 * claim and create paths read, the claim decision, the postcard hold and Mailbox Check.
 *
 * It uses made-up addresses, so it refuses to run unless a local stand-in answers Google
 * (a preload that sets POSTAL_EVAL_STANDIN=1 and answers by house number).
 *
 * usage (from backend/, ADDRESS_POSTAL_PROVIDER=google): node scripts/eval/postal-paths.js --cases <house:unit,...>
 */

if (process.env.POSTAL_EVAL_STANDIN !== '1') {
  console.error('Refusing to run: POSTAL_EVAL_STANDIN=1 is not set, so nothing says a stand-in answers Google.');
  process.exit(1);
}
if (process.env.ADDRESS_POSTAL_PROVIDER !== 'google') {
  console.error('Refusing to run: ADDRESS_POSTAL_PROVIDER is not google.');
  process.exit(1);
}

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const pipelineService = require('../../services/addressValidation/pipelineService');
const decisionEngine = require('../../services/addressValidation/addressDecisionEngine');
const { holdFor } = require('../../services/addressValidation/postalRecheckService');
const { dpvFinding } = require('../../services/mailboxCheckService');

const AUTO_VERIFY_CONFIDENCE = 0.8; // routes/addressValidation.js
const CLAIMABLE = new Set(['OK', 'MIXED_USE', 'LOW_CONFIDENCE', 'UNIT_NOT_CONFIRMED', 'POSTAL_PENDING']);

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function claimOutcome(verdict) {
  if (verdict.status === 'OK' && verdict.confidence >= AUTO_VERIFY_CONFIDENCE) return 'verified';
  return CLAIMABLE.has(verdict.status) ? 'pending' : 'refused';
}

async function main() {
  logger.silent = true;
  const street = option('street', 'Example Trust Lane');
  const cases = option('cases', '5300:,5301:,5301:4B,5301:999,5302:,5303:,5304:,5305:4B,5306:,5307:,5308:,5309:,5310:,5311:,5312:,5313:,5314:,5316:,5317:,5318:')
    .split(',')
    .map((item) => item.split(':'));
  const rows = [];
  let disagreements = 0;

  for (const [house, unit] of cases) {
    const input = { line1: `${house} ${street}`, line2: unit || undefined, city: 'Vancouver', state: 'WA', zip: '98660' };
    const live = await pipelineService.runValidationPipeline(input, { includeHousehold: false, auditContext: { trigger: 'eval' } });
    const again = await pipelineService.runValidationPipeline(input, { includeHousehold: false, auditContext: { trigger: 'eval' } });

    let stored = null;
    let address = null;
    if (live.address_id) {
      const { data } = await supabaseAdmin.from('HomeAddress').select('*').eq('id', live.address_id).maybeSingle();
      address = data;
      stored = decisionEngine.classify(pipelineService.buildStoredDecisionInputs(address));
    }

    const storedStatus = stored ? stored.status : '(not saved)';
    const agree = live.verdict.status === again.verdict.status
      && (!stored || stored.status === live.verdict.status)
      && (!stored || claimOutcome(stored) === claimOutcome(live.verdict));
    if (!agree) disagreements += 1;

    rows.push([
      `${house}${unit ? ` #${unit}` : ''}`.padEnd(12),
      live.verdict.status.padEnd(25),
      storedStatus.padEnd(25),
      claimOutcome(stored || live.verdict).padEnd(9),
      (address ? holdFor(address)?.code || 'mail ok' : '-').padEnd(26),
      address ? dpvFinding(address.dpv_match_code).title : '-',
      agree ? '' : '  DISAGREE',
    ].join(' '));
  }

  console.log('address      live / re-check           stored (create, claim)    claim     postcard                   Mailbox Check');
  for (const row of rows) console.log(row);
  console.log(`\n${disagreements === 0 ? 'All paths agree' : `${disagreements} addresses disagree`} across ${cases.length} addresses.`);
  process.exit(disagreements === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
