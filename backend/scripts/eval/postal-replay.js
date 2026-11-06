#!/usr/bin/env node
/**
 * Replays Google Address Validation answers through the postal adapter and the decision engine,
 * offline, and prints what each one decides. Exits 1 if a rule is broken.
 *
 * Without arguments it replays recorded answer shapes and every code combination the postal truth
 * set lists: DPV × footnotes × vacancy × mail-drop × home, business and PO-box flags × record type ×
 * a typed unit, plus timeouts, server errors and malformed answers. Nothing is sent to Google.
 *
 * With a truth set (real addresses, kept outside Git) it prints the per-category report, from
 * answers already saved by google-postal-live.js. Only counts are printed, never an address:
 *   node scripts/eval/postal-replay.js --cases <file.jsonl> --answers <file.jsonl>
 */

process.env.ADDRESS_POSTAL_PROVIDER = 'google';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'offline';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'offline';
process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY = process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY || 'offline';

const fs = require('fs');
const logger = require('../../utils/logger');

logger.silent = true;

const googleProvider = require('../../services/addressValidation/googleProvider');
const decisionEngine = require('../../services/addressValidation/addressDecisionEngine');
const { derivePlaceClassification } = require('../../services/addressValidation/pipelineService');
const { postalFromGoogle, keepTypedAddress } = require('../../services/addressValidation/postalAdapter');
const { SHAPES, googleAnswer } = require('./lib/googleAnswerShapes');

const AUTO_VERIFY_CONFIDENCE = 0.8; // routes/addressValidation.js
const REFUSED = new Set(['UNDELIVERABLE', 'PO_BOX', 'MISSING_STREET_NUMBER', 'UNVERIFIED_STREET_NUMBER', 'BUSINESS', 'LOW_CONFIDENCE', 'MULTIPLE_MATCHES']);
const SYNTHETIC = { line1: '5300 Example Trust Lane', city: 'Vancouver', state: 'WA', zip: '98660' };

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function decide(answer, input) {
  const parsed = googleProvider._parseResponse(answer);
  if (!parsed) return { status: 'SERVICE_ERROR', confidence: 0, reasons: [], postal: null };
  const google = keepTypedAddress(parsed, input);
  const postal = postalFromGoogle(google);
  const verdict = decisionEngine.classify({
    google,
    smarty: postal,
    place: derivePlaceClassification(input, google, postal),
    postal_source: 'google',
  });
  return { ...verdict, postal };
}

const autoVerifies = (result) => result.status === 'OK' && result.confidence >= AUTO_VERIFY_CONFIDENCE;

function ruleBreaks(result, facts) {
  const breaks = [];
  const { dpv, footnotes, typedUnit, poBox, record, cmra, residential, business, vacant, noStat } = facts;
  const hasFootnote = (code) => footnotes.includes(code);
  const military = hasFootnote('F1');

  if ((dpv === 'D' || hasFootnote('N1')) && result.status === 'OK') breaks.push('D or N1 reached OK');
  if ((dpv === 'S') && result.status === 'OK') breaks.push('S reached OK');
  if (!dpv && result.status === 'OK') breaks.push('blank DPV reached OK');
  if (autoVerifies(result)) {
    if (dpv !== 'Y') breaks.push('auto-verified without a full USPS match');
    if (residential !== true || business === true) breaks.push('auto-verified without a known home');
    if (cmra !== 'N' || vacant !== 'N') breaks.push('auto-verified with unknown or doubtful mail-drop or vacancy');
    if (noStat === 'Y') breaks.push('auto-verified a no-delivery address');
  }
  if (dpv === 'N' && !hasFootnote('M1') && !hasFootnote('M3')
    && !['UNDELIVERABLE', 'PO_BOX'].includes(result.status)) breaks.push('USPS no-match not refused');
  if (!military && (poBox === true || record === 'P') && result.status !== 'PO_BOX'
    && !['MISSING_STREET_NUMBER', 'UNVERIFIED_STREET_NUMBER', 'UNDELIVERABLE'].includes(result.status)) breaks.push('PO box not refused');
  if (cmra === 'Y' && dpv === 'Y' && !hasFootnote('N1') && !hasFootnote('C1') && !hasFootnote('M1') && !hasFootnote('M3')
    && !(poBox === true || record === 'P') && result.status !== 'BUSINESS') breaks.push('mail-drop store not refused');
  if ((dpv === 'D' || hasFootnote('N1')) && !typedUnit && !REFUSED.has(result.status) && result.status !== 'MISSING_UNIT') {
    breaks.push('missing unit not asked for');
  }
  if ((dpv === 'S' || dpv === 'D' || hasFootnote('N1') || hasFootnote('C1') || hasFootnote('CC')) && typedUnit
    && !REFUSED.has(result.status) && !['UNIT_NOT_CONFIRMED', 'CONFLICT', 'MIXED_USE'].includes(result.status)) {
    breaks.push('typed unit USPS doubts not flagged');
  }
  return breaks;
}

function replayShapes() {
  console.log('Recorded answer shapes (synthetic addresses)\n');
  console.log('shape                  unit   outcome                confidence  auto-verifies');
  for (const shape of Object.keys(SHAPES)) {
    for (const line2 of ['', '4B']) {
      const input = { ...SYNTHETIC, line2: line2 || undefined };
      const result = decide(googleAnswer(shape, { ...SYNTHETIC, line2 }), input);
      console.log(`${shape.padEnd(22)} ${(line2 ? 'typed' : '-').padEnd(6)} ${result.status.padEnd(22)} ${String(result.confidence).padEnd(11)} ${autoVerifies(result) ? 'yes' : 'no'}`);
    }
  }
}

function replayMatrix() {
  const DPV = ['Y', 'N', 'D', 'S', undefined];
  const FOOTNOTES = ['AABB', 'AAN1', 'AAC1', 'AABBCC', 'A1M1', 'AAM3', 'AAP1', 'AABBF1'];
  const YES_NO = ['Y', 'N', undefined];
  const FLAG = [true, false, undefined];
  const RECORD = [undefined, 'F', 'G', 'H', 'P', 'R', 'S'];
  const counts = {};
  const breaks = {};
  let total = 0;

  for (const dpv of DPV) for (const dpvFootnote of FOOTNOTES) for (const vacant of YES_NO) for (const cmra of YES_NO) {
    for (const residential of FLAG) for (const business of FLAG) for (const poBox of FLAG) for (const record of RECORD) {
      for (const line2 of ['', '4B']) {
        const answer = googleAnswer('house', { ...SYNTHETIC, line2 }, {
          usps: { dpvConfirmation: dpv, dpvFootnote, dpvVacant: vacant, dpvCmra: cmra, addressRecordType: record, carrierRoute: record === 'P' ? 'B001' : 'C012' },
          metadata: { residential, business, poBox },
        });
        const input = { ...SYNTHETIC, line2: line2 || undefined };
        const result = decide(answer, input);
        total += 1;
        counts[result.status] = (counts[result.status] || 0) + 1;
        const footnotes = dpvFootnote.match(/.{2}/g);
        for (const text of ruleBreaks(result, {
          dpv, footnotes, typedUnit: !!line2, poBox, record, cmra, residential, business, vacant, noStat: 'N',
        })) {
          breaks[text] = (breaks[text] || 0) + 1;
        }
      }
    }
  }

  console.log(`\nEvery code combination: ${total}\n`);
  for (const [status, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(26)} ${count}`);
  }
  return breaks;
}

function replayNoUspsCases() {
  console.log('\nNo USPS answer');
  const cases = [
    ['no USPS data at all', googleAnswer('no_usps_answer', SYNTHETIC)],
    ['not CASS processed', googleAnswer('cass_not_processed', SYNTHETIC)],
    ['USPS checks suspended', googleAnswer('usps_suspended', SYNTHETIC)],
    ['not in USPS file', googleAnswer('not_in_usps_file', SYNTHETIC)],
    ['USPS will have it soon', googleAnswer('coming_soon', SYNTHETIC)],
    ['USPS hasn\'t listed it yet', googleAnswer('not_listed_yet', SYNTHETIC)],
    ['Puerto Rico, no match', googleAnswer('not_in_usps_file', { ...SYNTHETIC, state: 'PR', zip: '00901' })],
  ];
  const broken = {};
  for (const [name, answer] of cases) {
    const result = decide(answer, SYNTHETIC);
    console.log(`  ${name.padEnd(26)} ${result.status}`);
    if (result.status !== 'POSTAL_PENDING') broken[`${name} is not pending`] = 1;
  }
  return broken;
}

async function replayFailures() {
  console.log('\nGoogle failing (a stub answers fetch; nothing leaves this process)');
  const respond = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  const good = googleAnswer('house', SYNTHETIC);
  const cases = [
    ['server error, then fine', [() => respond(503, {}), () => respond(200, good)], 'answer'],
    ['rate limited, then fine', [() => respond(429, {}), () => respond(200, good)], 'answer'],
    ['server error twice', [() => respond(500, {}), () => respond(500, {})], 'none'],
    ['client error (no retry)', [() => respond(400, {})], 'none'],
    ['malformed answer', [() => respond(200, '<html>')], 'none'],
    ['empty answer', [() => respond(200, {})], 'none'],
    ['network error twice', [() => { throw new TypeError('fetch failed'); }, () => { throw new TypeError('fetch failed'); }], 'none'],
    ['timeout (no retry)', [() => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }], 'none'],
  ];
  const broken = {};
  const realFetch = globalThis.fetch;
  for (const [name, answers, want] of cases) {
    let calls = 0;
    globalThis.fetch = async () => {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      return answer();
    };
    googleProvider.consecutiveFailures = 0;
    googleProvider.circuitOpenUntil = 0;
    const parsed = await googleProvider.validate(SYNTHETIC);
    const verdict = parsed ? null : decisionEngine.classify({ google: null, smarty: null, postal_source: 'google' });
    console.log(`  ${name.padEnd(26)} calls ${calls}  ${parsed ? 'answered' : verdict.status}`);
    if (want === 'answer' ? !parsed : !!parsed) broken[`${name}: expected ${want}`] = 1;
    if (calls !== answers.length) broken[`${name}: expected ${answers.length} calls, made ${calls}`] = 1;
  }

  // Five failures in a row and nobody waits on Google for 30 seconds.
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return respond(400, {}); };
  googleProvider.consecutiveFailures = 0;
  googleProvider.circuitOpenUntil = 0;
  for (let i = 0; i < 8; i += 1) await googleProvider.validate(SYNTHETIC);
  console.log(`  after 5 failures in a row  calls ${calls} of 8`);
  if (calls !== 5) broken['the outage switch did not stop calls after 5 failures'] = 1;
  globalThis.fetch = realFetch;
  return broken;
}

function wilson(agree, n) {
  if (!n) return '-';
  const z = 1.96;
  const p = agree / n;
  const denominator = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return `${Math.round(((centre - margin) / denominator) * 100)}-${Math.round(((centre + margin) / denominator) * 100)}%`;
}

const AGREES = {
  deliverable: (r) => r.status === 'OK',
  unit_required: (r) => r.status === 'MISSING_UNIT',
  unit_unconfirmed: (r) => r.status === 'UNIT_NOT_CONFIRMED',
  undeliverable: (r) => ['UNDELIVERABLE', 'MISSING_STREET_NUMBER', 'UNVERIFIED_STREET_NUMBER'].includes(r.status),
  po_box: (r) => r.status === 'PO_BOX',
  cmra: (r) => r.status === 'BUSINESS' && (r.reasons || []).includes('CMRA_MAILBOX'),
  business: (r) => r.status === 'BUSINESS',
  mixed_use: (r) => r.status === 'MIXED_USE',
  vacant: (r) => (r.reasons || []).includes('USPS_VACANT'),
  unknown: (r) => r.status === 'POSTAL_PENDING',
  new_construction: (r) => r.status === 'POSTAL_PENDING' || r.status === 'OK',
};

function truthReport(casesFile, answersFile) {
  const read = (file) => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const cases = new Map(read(casesFile).map((item) => [item.id, item]));
  const categories = new Map();
  const gate = { codeBreaks: 0, autoVerified: 0, reachedOk: 0, answered: 0 };
  const disagreements = new Map();
  const latencies = [];
  const noStatOutcomes = {};
  let useUnset = 0;
  let noStat = 0;

  for (const row of read(answersFile)) {
    const item = cases.get(row.id);
    if (!item) continue;
    const input = { line1: item.line1, line2: item.line2 || undefined, city: item.city, state: item.state, zip: item.zip };
    const result = decide(row.answer, input);
    gate.answered += 1;
    if (Number.isFinite(row.latency_ms)) latencies.push(row.latency_ms);

    const entry = categories.get(item.category) || { n: 0, agree: 0, outcomes: {}, wrongOk: 0, wrongRefused: 0, autoVerified: 0 };
    categories.set(item.category, entry);
    entry.n += 1;
    entry.outcomes[result.status] = (entry.outcomes[result.status] || 0) + 1;
    const agrees = (AGREES[item.truth] || (() => false))(result);
    if (agrees) entry.agree += 1;
    if (autoVerifies(result)) entry.autoVerified += 1;
    if (!agrees && result.status === 'OK') entry.wrongOk += 1;
    if (!agrees && item.truth === 'deliverable' && REFUSED.has(result.status)) entry.wrongRefused += 1;

    const postal = result.postal;
    if (postal) {
      if (postal.rdi_type === 'unknown') useUnset += 1;
      if (postal.no_stat === true) {
        noStat += 1;
        noStatOutcomes[result.status] = (noStatOutcomes[result.status] || 0) + 1;
      }
      const doubted = postal.dpv_match_code !== 'Y' || postal.footnotes.includes('N1');
      if (doubted && result.status === 'OK') gate.reachedOk += 1;
      if (doubted && autoVerifies(result)) gate.autoVerified += 1;
      if (!agrees) {
        const key = `${item.category} | truth ${item.truth} | ${result.status} | dpv ${postal.dpv_match_code || 'blank'} ${postal.footnotes.join('')} rec ${postal.record_type || '-'} use ${postal.rdi_type} ${(result.reasons || []).filter((reason) => /GEOCODE|GOOGLE|PLACE_|PARCEL/.test(reason)).join(',')}`;
        disagreements.set(key, (disagreements.get(key) || 0) + 1);
      }
    }
  }

  console.log(`\nPostal truth set: ${gate.answered} answers\n`);
  console.log('category                    n  agree  95% range  auto-verify  wrongly OK  wrongly refused  outcomes');
  for (const [category, entry] of [...categories.entries()].sort()) {
    const outcomes = Object.entries(entry.outcomes).sort((a, b) => b[1] - a[1]).map(([status, count]) => `${status} ${count}`).join(', ');
    console.log(`${category.padEnd(26)} ${String(entry.n).padStart(3)} ${String(entry.agree).padStart(6)}  ${wilson(entry.agree, entry.n).padEnd(9)}  ${String(entry.autoVerified).padStart(11)}  ${String(entry.wrongOk).padStart(10)} ${String(entry.wrongRefused).padStart(16)}  ${outcomes}`);
  }
  console.log(`\nA missing unit, an unconfirmed unit or no USPS answer reached OK: ${gate.reachedOk}`);
  console.log(`...and auto-verified a claim: ${gate.autoVerified}`);
  console.log(`Google left home-or-business unset: ${useUnset} of ${gate.answered}`);
  console.log(`USPS says no delivery here (no-stat, recorded only): ${noStat} of ${gate.answered}: ${JSON.stringify(noStatOutcomes)}`);
  if (latencies.length) {
    latencies.sort((a, b) => a - b);
    console.log(`Google answer time: p50 ${latencies[Math.ceil(latencies.length / 2) - 1]} ms, p95 ${latencies[Math.ceil(latencies.length * 0.95) - 1]} ms, max ${latencies.at(-1)} ms`);
  }
  if (disagreements.size) {
    console.log('\nWhere the outcome differs from the truth (codes only):');
    for (const [key, count] of [...disagreements.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${key}`);
  }
  return gate.reachedOk + gate.autoVerified;
}

async function main() {
  const casesFile = option('cases');
  const answersFile = option('answers');
  if (casesFile && answersFile) {
    process.exit(truthReport(casesFile, answersFile) ? 1 : 0);
  }

  replayShapes();
  const breaks = {
    ...replayMatrix(),
    ...replayNoUspsCases(),
    ...(await replayFailures()),
  };

  console.log('\nRules that must hold');
  if (Object.keys(breaks).length === 0) {
    console.log('  all hold: no D, N1, S or blank DPV reaches OK or auto-verifies; undeliverable, PO box, mail-drop refused');
    process.exit(0);
  }
  for (const [text, count] of Object.entries(breaks).sort((a, b) => b[1] - a[1])) {
    console.log(`  BROKEN  ${text}: ${count}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
