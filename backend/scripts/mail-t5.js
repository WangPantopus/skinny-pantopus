#!/usr/bin/env node

/**
 * T5, the test-mode run for the mail layer (docs/research/provider-replacement/parity-and-acceptance.md).
 *
 * Drives a real local backend and database against one printer's test mode: both
 * verification flows and Block Founders, with delivered, returned, re-routed and failed
 * events, duplicates, late events, lost answers and a printer that's down. Duplicates are
 * counted from the printer's own list. It mails nothing: it refuses anything but test keys.
 *
 * Usage, with the same environment as the backend under test:
 *   node backend/scripts/mail-t5.js --api http://127.0.0.1:18990 [--printer lob] [--faults <rules.json>]
 *
 * Without --faults the timeout checks are skipped and the report says so. To run them,
 * start the backend with scripts/mail-t5-faults.cjs preloaded on the same rules file.
 * The grace periods are stepped over by backdating rows in the local database.
 *
 * Prints one line per check and exits non-zero if any fails. The output describes a
 * printer's behavior: keep it out of Git and anywhere public.
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const API = opt('--api', 'http://127.0.0.1:8000');
const PRINTER = opt('--printer', 'lob');
const FAULTS = opt('--faults', null);
const WEBHOOK_PATH = opt('--webhook-path', PRINTER === 'lob' ? '/api/v1/webhooks/lob' : `/api/v1/webhooks/${PRINTER}`);
const LOCAL = /^(https?|postgres(ql)?):\/\/([^@/]*@)?(127\.0\.0\.1|localhost)[:/]/;

function refuse(message) { console.error(`mail-t5: ${message}; refusing`); process.exit(2); }
if (!LOCAL.test(API)) refuse('--api is not local');
if (!LOCAL.test(process.env.DATABASE_URL || '')) refuse('DATABASE_URL is not local');
if (!LOCAL.test(process.env.SUPABASE_URL || '')) refuse('SUPABASE_URL is not local');
if (!String(process.env.LOB_API_KEY || '').startsWith('test_') || process.env.LOB_ENV !== 'test') refuse('Lob is not in test mode');
if (process.env.POSTGRID_API_KEY && !process.env.POSTGRID_API_KEY.startsWith('test_')) refuse('PostGrid is not in test mode');

const mailVendorService = require('../services/addressValidation/mailVendorService');
const material = require('../utils/homePostcardCodeMaterial');
const { hashPostcardCode } = require('../utils/postcardDispatch');

const printer = mailVendorService.providerForPiece(PRINTER);
const counts = { pass: 0, fail: 0, skip: 0 };
let pg;

function check(name, ok, detail) {
  counts[ok ? 'pass' : 'fail'] += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  got: ${JSON.stringify(detail)}` : ''}`);
}
function skip(name, why) { counts.skip += 1; console.log(`SKIP  ${name}: ${why}`); }
function section(name) { console.log(`\n${name}`); }
const q = async (sql, params = []) => (await pg.query(sql, params)).rows;
const setFaults = (rules) => fs.writeFileSync(FAULTS, JSON.stringify({ rules }));
const POST_CARDS = PRINTER === 'lob' ? '/v1/postcards' : '/print-mail/v1/postcards';

// ── People and Homes ─────────────────────────────────────────

const people = {};
async function newPerson(label) {
  const suffix = crypto.randomBytes(4).toString('hex');
  const email = `t5-${label}-${suffix}@example.com`;
  const password = `T5-${crypto.randomBytes(12).toString('base64url')}!`;
  const [{ id }] = await q(`
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
        raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
        extensions.crypt($2, extensions.gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}',
        '{"t5":true}', now(), now(), '', '', '', '') returning id
    ), i as (
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', $1::text, 'email_verified', true),
        'email', now(), now(), now() from u returning user_id
    ) select user_id as id from i`, [email, password]);
  await q(`insert into "User" (id, email, username, first_name, last_name, name, city, state, onboarding_completed_at, adult_attested_at, role, created_at)
    values ($1, $2, $3, 'T5', $4, $5, 'Vancouver', 'WA', now(), now(), 'user', now() - interval '30 days')`,
    [id, email, `t5_${label}_${suffix}`, label, `T5 ${label}`]);
  await q('insert into "LocalProfile" (user_id, handle, handle_normalized, display_name) values ($1, $2, $2, $3)', [id, `t5${suffix}`, `T5 ${label}`]);
  const res = await fetch(`${API}/api/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json();
  if (!res.ok || !body.accessToken) throw new Error(`sign-in failed: ${res.status}`);
  people[label] = { id, token: body.accessToken };
  return people[label];
}
async function api(person, method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${person.token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* empty */ }
  return { status: res.status, body: json };
}
// Vancouver City Hall, a public building, with a made-up suite: test modes can refuse made-up streets.
let suite = 1000 + crypto.randomInt(0, 8000);
const nextSuite = () => { suite += 1; return suite; };
async function newHome(person, kind) {
  const { computeAddressHash } = require('../utils/normalizeAddress');
  const n = nextSuite();
  const line1 = '415 W 6th St', unit = `Suite ${n}`, city = 'Vancouver', state = 'WA', zip = '98660';
  const hash = computeAddressHash(line1, unit, city, state, zip);
  const [a] = await q(`insert into "HomeAddress"(address_line1_norm,address_line2_norm,city_norm,state,postal_code,address_hash,validation_vendor,last_validated_at)
    values($1,$2,$3,$4,$5,$6,'google',now()) on conflict (address_hash) do update set last_validated_at=now() returning id`, [line1, unit, city, state, zip, hash]);
  const [h] = await q(`insert into "Home"(address,address2,city,state,zipcode,country,address_hash,address_id,map_center_lat,map_center_lng,owner_id,created_by_user_id,name)
    values($1,$2,$3,$4,$5,'US',$6,$7,45.6387,-122.6615,$8,$9,'T5') returning id`,
    [line1, unit, city, state, zip, hash, a.id, kind === 'owner' ? person.id : null, person.id]);
  await addOccupant(h.id, person, kind);
  return { id: h.id, addressId: a.id, n };
}
async function addOccupant(homeId, person, kind) {
  const verified = kind !== 'resident';
  const role = kind === 'owner' ? 'owner' : 'member';
  await q(`insert into "HomeOccupancy"(home_id,user_id,role,role_base,is_active,start_at,access_start_at,verification_status,verified_at,verification_expires_at,
      can_manage_home,can_manage_access,can_view_sensitive,can_manage_tasks,can_manage_finance)
    values($1,$2,$3::text,($3::text)::home_role_base,true,now()-interval '2 days',now()-interval '2 days',$4,$5,$6,$7,$7,$7,$7,$7)`,
    [homeId, person.id, role, verified ? 'verified' : 'pending_postcard', verified ? new Date() : null, verified ? new Date(Date.now() + 3e10) : null, kind === 'owner']);
  if (kind === 'owner') {
    await q(`insert into "HomeOwner"(home_id,subject_type,subject_id,owner_status,is_primary_owner,added_via,verification_tier)
      values($1,'user',$2,'verified',true,'claim','strong')`, [homeId, person.id]);
  }
  if (kind === 'resident') {
    await q(`insert into "HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role,status,cold_start_mode)
      values($1,$2,'Example','member','pending','self_bootstrap')`, [homeId, person.id]);
  }
}

// ── Delivery updates, signed the way the printer signs them ──

let eventCounter = 0;
async function deliver(eventType, pieceId, metadata, id = `evt_t5_${Date.now()}_${eventCounter += 1}`) {
  const body = JSON.stringify({ id, object: 'event', date_created: new Date().toISOString(), event_type: { id: eventType },
    body: { id: pieceId, object: 'postcard', metadata }, reference_id: pieceId });
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', process.env.LOB_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
  const res = await fetch(API + WEBHOOK_PATH, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'lob-signature-timestamp': timestamp, 'lob-signature': signature }, body });
  return { status: res.status, body: await res.json().catch(() => null), id };
}
async function runJob() {
  const res = await fetch(`${API}/api/internal/jobs/reconcile-mail-pieces`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY }, body: '{"triggered_by":"mail-t5"}' });
  if (res.status !== 200) throw new Error(`job answered ${res.status}`);
}
const piecesFor = (key, id) => printer.findPieces(key, id);

// ── Home postcards ───────────────────────────────────────────

const statusOf = async (person, home) => (await api(person, 'GET', `/api/homes/${home.id}/postcard-status`)).body;
async function requestCard(person, home) {
  const status = await statusOf(person, home);
  const res = await api(person, 'POST', `/api/homes/${home.id}/postcard-requests`, { request_id: crypto.randomUUID(), address: status.mailing_address });
  const [row] = await q(`select pc.*, c.code_key_id from "HomePostcardCode" pc left join "HomePostcardRequestCommand" c on c.postcard_id=pc.id
    where pc.home_id=$1 and pc.user_id=$2 order by pc.requested_at desc limit 1`, [home.id, person.id]);
  return { res, row };
}
const codeOf = (person, home, row) => material.deriveCode({ actorId: person.id, homeId: home.id, postcardId: row.id, keyId: row.code_key_id });
const redeem = (person, home, row, code) => api(person, 'POST', `/api/homes/${home.id}/postcards/${row.id}/verifications`, { request_id: crypto.randomUUID(), code });
const homeRef = (row) => ({ pantopus_home_postcard_id: row.id });
const occupancy = async (person, home) => (await q('select verification_status from "HomeOccupancy" where home_id=$1 and user_id=$2', [home.id, person.id]))[0].verification_status;

async function homeFlow() {
  section('Home postcard: request, delivery updates, redeem');
  const resident = await newPerson('resident');
  let home = await newHome(resident, 'resident');
  let { res, row } = await requestCard(resident, home);
  check('request is accepted by the printer', res.status === 200 && row.dispatch_status === 'accepted' && !!row.vendor_job_id, { s: res.status, d: row.dispatch_status });
  check('the printer is recorded on the row', row.mail_provider === PRINTER, row.mail_provider);
  let status = await statusOf(resident, home);
  check('status offers the code, in the old words', status.can_verify === true && status.postcard.delivery === 'accepted' && status.postcard.status === 'pending', status.postcard);

  for (const type of ['postcard.mailed', 'postcard.in_transit', 'postcard.delivered']) {
    await deliver(type, row.vendor_job_id, homeRef(row));
  }
  status = await statusOf(resident, home);
  check('a delivery scan redeems nothing', (await occupancy(resident, home)) === 'pending_postcard' && status.postcard.status === 'pending', status.postcard);
  const first = await deliver('postcard.delivered', row.vendor_job_id, homeRef(row));
  const again = await deliver('postcard.delivered', row.vendor_job_id, homeRef(row), first.id);
  check('a duplicate update is ignored', again.status === 200 && again.body?.duplicate === true, again.body);

  const wrong = await redeem(resident, home, row, '000000');
  check('a wrong code is refused', wrong.body?.code === 'POSTCARD_WRONG_CODE', wrong.body);
  const right = await redeem(resident, home, row, codeOf(resident, home, row));
  check('the right code verifies', right.status === 200 && right.body?.state === 'completed', right.body);
  check('the person is verified', (await occupancy(resident, home)) === 'verified');
  await deliver('postcard.returned_to_sender', row.vendor_job_id, homeRef(row));
  check('a late return never undoes a used code', (await occupancy(resident, home)) === 'verified'
    && (await q('select status from "HomePostcardCode" where id=$1', [row.id]))[0].status === 'verified');

  section('Home postcard: returned, re-routed and failed end the attempt');
  for (const [type, state] of [['postcard.returned_to_sender', 'returned'], ['postcard.re-routed', 'rerouted'], ['postcard.failed', 'failed']]) {
    home = await newHome(resident, 'resident');
    ({ row } = await requestCard(resident, home));
    await q('update "HomePostcardCode" set requested_at=requested_at-interval \'2 hours\' where user_id=$1', [resident.id]);
    await deliver(type, row.vendor_job_id, homeRef(row));
    status = await statusOf(resident, home);
    check(`${state}: the attempt ends and says why`, status.postcard.mail_state === state && status.postcard.status === 'cancelled' && status.can_verify === false, status.postcard);
    check(`${state}: older apps still read known words`, ['pending', 'verified', 'expired', 'cancelled'].includes(status.postcard.status)
      && ['not_started', 'accepted', 'unknown', 'rejected'].includes(status.postcard.delivery));
    check(`${state}: another card can be requested`, status.can_request === true);
    const refused = await redeem(resident, home, row, codeOf(resident, home, row));
    check(`${state}: its code no longer works`, refused.body?.code === 'POSTCARD_NO_LONGER_AVAILABLE', refused.body);
    await deliver('postcard.in_transit', row.vendor_job_id, homeRef(row));
    await deliver('postcard.delivered', row.vendor_job_id, homeRef(row));
    status = await statusOf(resident, home);
    check(`${state}: late scans change nothing`, status.postcard.mail_state === state && status.postcard.status === 'cancelled', status.postcard);
  }

  section('Home postcard: two cards back stop a third');
  const second = await newPerson('resident2');
  home = await newHome(second, 'resident');
  ({ row } = await requestCard(second, home));
  await deliver('postcard.returned_to_sender', row.vendor_job_id, homeRef(row));
  ({ res, row } = await requestCard(second, home));
  check('one card back: another is allowed', res.body?.state === 'completed' && row.status === 'pending', res.body);
  await deliver('postcard.returned_to_sender', row.vendor_job_id, homeRef(row));
  status = await statusOf(second, home);
  check('two cards back: no form, and a reason', status.can_request === false && status.restriction === 'POSTCARD_RETURNED_LIMIT', { c: status.can_request, r: status.restriction });
  res = await api(second, 'POST', `/api/homes/${home.id}/postcard-requests`, { request_id: crypto.randomUUID(),
    address: { line1: '415 W 6th St', line2: `Suite ${home.n}`, city: 'Vancouver', state: 'WA', postal_code: '98660', country: 'US' } });
  check('two cards back: a third request is refused', res.body?.code === 'POSTCARD_RETURNED_LIMIT', res.body);

  section('Home postcard: a new address pulls the old card back');
  const mover = await newPerson('mover');
  home = await newHome(mover, 'resident');
  ({ row } = await requestCard(mover, home));
  await q(`update "Home" set address2=$1 where id=$2`, [`Suite ${nextSuite()}`, home.id]);
  const moved = await requestCard(mover, home);
  const [before] = await q('select status, mail_outcome from "HomePostcardCode" where id=$1', [row.id]);
  check('the new request goes out and retires the old code', moved.row.id !== row.id && moved.row.dispatch_status === 'accepted' && before.status === 'cancelled', before);
  check('the printer pulled the old card before it printed', before.mail_outcome === 'canceled' && (await piecesFor('pantopus_home_postcard_id', row.id)).length === 0, before);

  section('Home postcard: the routes older apps call');
  const older = await newPerson('older');
  home = await newHome(older, 'resident');
  res = await api(older, 'POST', `/api/homes/${home.id}/request-postcard`);
  [row] = await q('select * from "HomePostcardCode" where home_id=$1', [home.id]);
  check('request: accepted, printer recorded', res.status === 201 && row.dispatch_status === 'accepted' && row.mail_provider === PRINTER, { s: res.status, b: res.body });
  res = await api(older, 'GET', `/api/homes/${home.id}/postcard`);
  check('status: pending, in the old shape', res.status === 200 && res.body?.postcard?.status === 'pending' && res.body?.postcard?.mail_state === undefined, res.body);
  await deliver('postcard.delivered', row.vendor_job_id, homeRef(row));
  [row] = await q('select * from "HomePostcardCode" where home_id=$1', [home.id]);
  check('a delivery scan changes nothing', row.status === 'pending');
  await deliver('postcard.returned_to_sender', row.vendor_job_id, homeRef(row));
  res = await api(older, 'GET', `/api/homes/${home.id}/postcard`);
  check('returned: no pending card, which those apps already handle', res.status === 404 && res.body?.code === 'NO_POSTCARD', res.body);
  res = await api(older, 'POST', `/api/homes/${home.id}/request-postcard`);
  check('returned: another can be requested', res.status === 201, res.body);
  [row] = await q(`select * from "HomePostcardCode" where home_id=$1 and status='pending'`, [home.id]);
  await deliver('postcard.re-routed', row.vendor_job_id, homeRef(row));
  await q('update "HomePostcardCode" set requested_at=requested_at-interval \'2 hours\' where user_id=$1', [older.id]);
  res = await api(older, 'POST', `/api/homes/${home.id}/request-postcard`);
  check('two cards back: a third is refused with a reason', res.status === 409 && res.body?.code === 'POSTCARD_RETURNED_LIMIT', { s: res.status, b: res.body });

  section('Home postcard: no-mail flag');
  const { suppressionHashForDestination } = require('../services/addressValidation/mailSuppression');
  const third = await newPerson('resident3');
  home = await newHome(third, 'resident');
  await q(`insert into "BlockInviteOptOut"(address_hash,scope) values($1,'all_mail')`,
    [suppressionHashForDestination({ line1: '415 W 6th St', line2: `Suite ${home.n}`, city: 'Vancouver', state: 'WA', zip: '98660' })]);
  ({ row } = await requestCard(third, home));
  status = await statusOf(third, home);
  check('a flagged address gets no card, and no special message', row.dispatch_status === 'rejected' && !row.vendor_job_id && status.postcard.mail_state === 'failed', status.postcard);
  check('nothing reached the printer', (await piecesFor('pantopus_home_postcard_id', row.id)).length === 0);
}

async function homeFaults() {
  section('Home postcard: lost answers and a printer that is down');
  const resident = await newPerson('resident4');
  const backdate = (id) => q(`update "HomePostcardCode" set updated_at=now()-interval '20 minutes' where id=$1`, [id]);
  const stepHour = () => q('update "HomePostcardCode" set requested_at=requested_at-interval \'2 hours\' where user_id=$1', [resident.id]);

  let home = await newHome(resident, 'resident');
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-after', times: 3 }]);
  let { row } = await requestCard(resident, home);
  let status = await statusOf(resident, home);
  check('answer lost: the saved request says sending', row.dispatch_status === 'delivery_unknown' && status.postcard.mail_state === 'sending' && status.postcard.delivery === 'unknown', status.postcard);
  check('answer lost: the code still works if the card arrives', status.can_verify === true && status.can_request === false);
  await backdate(row.id);
  status = await statusOf(resident, home);
  check('after the wait: the printer is late', status.postcard.mail_state === 'delayed', status.postcard);
  await runJob();
  [row] = await q('select * from "HomePostcardCode" where id=$1', [row.id]);
  check('answer lost: the printer is asked, and its piece is saved', row.dispatch_status === 'accepted' && !!row.vendor_job_id, row.dispatch_status);
  check('answer lost: the printer holds exactly one card', (await piecesFor('pantopus_home_postcard_id', row.id)).length === 1);

  await stepHour(); home = await newHome(resident, 'resident');
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-before', times: 3 }]);
  ({ row } = await requestCard(resident, home));
  check('never reached the printer: stays pending', row.dispatch_status === 'delivery_unknown', row.dispatch_status);
  setFaults([{ method: 'GET', path: POST_CARDS, mode: 'down', times: 1 }]);
  await backdate(row.id);
  await runJob();
  status = await statusOf(resident, home);
  check('printer down: nothing moves while it can\'t answer', status.postcard.mail_state === 'delayed' && status.postcard.status === 'pending', status.postcard);
  check('printer down: nothing was resent', (await piecesFor('pantopus_home_postcard_id', row.id)).length === 0);
  setFaults([]);
  await backdate(row.id);
  await runJob();
  [row] = await q('select * from "HomePostcardCode" where id=$1', [row.id]);
  const pieces = await piecesFor('pantopus_home_postcard_id', row.id);
  check('printer back: "no such piece" sends it, once', row.dispatch_status === 'accepted' && pieces.length === 1, { d: row.dispatch_status, n: pieces.length });
  const [withKey] = await q(`select pc.*, c.code_key_id from "HomePostcardCode" pc join "HomePostcardRequestCommand" c on c.postcard_id=pc.id where pc.id=$1`, [row.id]);
  const right = await redeem(resident, home, withKey, codeOf(resident, home, withKey));
  check('the resent card carries the same working code', right.status === 200 && right.body?.state === 'completed', right.body);
}

// ── Address verification cards ───────────────────────────────

async function addressFlow(faults) {
  section('Address verification card: request, returned, resend, redeem');
  // Each scenario gets its own person: the mail routes limit requests per person per hour.
  let person = await newPerson('address1');
  const start = async (addressId) => (await api(person, 'POST', '/api/v1/address/verify/mail/start', { address_id: addressId, unit: undefined }));
  const newAddress = async (withHome = false) => {
    const { computeAddressHash } = require('../utils/normalizeAddress');
    const n = nextSuite();
    const hash = computeAddressHash('415 W 6th St', `Suite ${n}`, 'Vancouver', 'WA', '98660');
    const [a] = await q(`insert into "HomeAddress"(address_line1_norm,address_line2_norm,city_norm,state,postal_code,address_hash,validation_vendor,last_validated_at)
      values('415 W 6th St',$1,'Vancouver','WA','98660',$2,'google',now()) returning id`, [`Suite ${n}`, hash]);
    // A redeemed card joins the one Home at its address.
    if (withHome) {
      await q(`insert into "Home"(address,address2,city,state,zipcode,country,address_hash,address_id,map_center_lat,map_center_lng,name)
        values('415 W 6th St',$1,'Vancouver','WA','98660','US',$2,$3,45.6387,-122.6615,'T5')`, [`Suite ${n}`, hash, a.id]);
    }
    return a.id;
  };
  const jobOf = async (attemptId) => (await q('select * from "MailVerificationJob" where attempt_id=$1 order by created_at desc limit 1', [attemptId]))[0];
  const statusFor = async (id) => (await api(person, 'GET', `/api/v1/address/verify/mail/${id}`)).body;
  const ref = (job) => ({ pantopus_verification_job_id: job.id });

  let res = await start(await newAddress());
  const attemptId = res.body?.verification_id;
  let job = await jobOf(attemptId);
  check('request is accepted by the printer', res.status === 200 && !!job.vendor_job_id && job.vendor === PRINTER, { s: res.status, v: job.vendor });
  await deliver('postcard.delivered', job.vendor_job_id, ref(job));
  check('a delivery scan redeems nothing', (await statusFor(attemptId)).status === 'pending');
  await deliver('postcard.returned_to_sender', job.vendor_job_id, ref(job));
  let status = await statusFor(attemptId);
  check('returned: the attempt ends and says why', status.status === 'expired' && status.mail_outcome === 'returned', status);
  await deliver('postcard.in_transit', job.vendor_job_id, ref(job));
  check('a late scan doesn\'t rewind the card', (await jobOf(attemptId)).vendor_status === 'returned');

  person = await newPerson('address2');
  res = await start(await newAddress());
  const second = res.body?.verification_id;
  job = await jobOf(second);
  await deliver('postcard.re-routed', job.vendor_job_id, ref(job));
  status = await statusFor(second);
  check('re-routed: the attempt ends too', status.status === 'expired' && status.mail_outcome === 'rerouted', status);

  person = await newPerson('address3');
  res = await start(await newAddress(true));
  const third = res.body?.verification_id;
  job = await jobOf(third);
  await q('update "AddressVerificationToken" set cooldown_until=now()-interval \'1 minute\' where attempt_id=$1', [third]);
  res = await api(person, 'POST', `/api/v1/address/verify/mail/${third}/resend`);
  check('resend mails another card', res.status === 200 && res.body?.verification_id === third, res.body);
  await deliver('postcard.returned_to_sender', job.vendor_job_id, ref(job));
  status = await statusFor(third);
  check('the first card coming back doesn\'t end the attempt for the newer one', status.status === 'pending', status);
  const code = '482913';
  await q('update "AddressVerificationToken" set code_hash=$1 where attempt_id=$2', [crypto.createHash('sha256').update(code).digest('hex'), third]);
  res = await api(person, 'POST', '/api/v1/address/verify/mail/confirm', { verification_id: third, code: '000000' });
  check('a wrong code is refused', res.body?.status === 'wrong_code', res.body);
  res = await api(person, 'POST', '/api/v1/address/verify/mail/confirm', { verification_id: third, code });
  check('the right code verifies', res.body?.status === 'confirmed', res.body);

  if (!faults) { skip('address card timeouts', 'run with --faults'); return; }
  section('Address verification card: lost answers');
  person = await newPerson('address4');
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-after', times: 3 }]);
  res = await start(await newAddress());
  const lost = res.body?.verification_id;
  check('answer lost: says it isn\'t confirmed, with the request saved', res.status === 503 && res.body?.delivery_unknown === true, { s: res.status, b: res.body });
  job = await jobOf(lost);
  await q(`update "MailVerificationJob" set updated_at=now()-interval '20 minutes' where id=$1`, [job.id]);
  await runJob();
  job = await jobOf(lost);
  check('answer lost: the printer is asked, and its piece is saved', !!job.vendor_job_id && job.vendor_status === 'created', job.vendor_status);
  check('answer lost: the printer holds exactly one card', (await piecesFor('pantopus_verification_job_id', job.id)).length === 1);

  person = await newPerson('address5');
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-before', times: 3 }]);
  res = await start(await newAddress());
  const never = res.body?.verification_id;
  job = await jobOf(never);
  await q(`update "MailVerificationJob" set updated_at=now()-interval '20 minutes' where id=$1`, [job.id]);
  setFaults([]);
  await runJob();
  status = await statusFor(never);
  check('never reached the printer: the attempt ends and says so', status.status === 'expired' && status.mail_outcome === 'failed', status);
  res = await api(person, 'POST', `/api/v1/address/verify/mail/${never}/resend`);
  check('and another card can go right away', res.status === 200, { s: res.status, b: res.body });
  check('the printer holds one card for the new job', (await piecesFor('pantopus_verification_job_id', (await jobOf(never)).id)).length === 1);
}

// ── Block Founders ───────────────────────────────────────────

async function inviteFlow(faults) {
  section('Block Founders: invitations');
  const owner = await newPerson('owner');
  const home = await newHome(owner, 'owner');
  const send = (n) => api(owner, 'POST', `/api/homes/${home.id}/block-founders/invites`, { recipient: { line1: `415 W 6th St Suite ${n}`, city: 'Vancouver', state: 'WA', zip: '98660' } });
  const rowOf = async (n) => (await q(`select * from "BlockInvite" where recipient_address->>'line1'=$1 order by created_at desc limit 1`, [`415 W 6th St Suite ${n}`]))[0];
  const budget = () => q('update "BlockInvite" set created_at=created_at-interval \'8 days\' where sender_user_id=$1', [owner.id]);
  const ref = (row) => ({ pantopus_block_invite_id: row.id });

  let n = nextSuite();
  let res = await send(n);
  let row = await rowOf(n);
  check('a clean invitation is accepted, printer recorded', res.status === 201 && !!row.lob_id && row.mail_provider === PRINTER && row.dispatch_status === 'accepted', { s: res.status, b: res.body });
  check('the printer holds exactly one card', (await piecesFor('pantopus_block_invite_id', row.id)).length === 1);
  res = await send(n);
  check('a second invitation to that address is refused', res.body?.code === 'RECENTLY_INVITED', res.body);
  const first = await deliver('postcard.delivered', row.lob_id, ref(row));
  const again = await deliver('postcard.delivered', row.lob_id, ref(row), first.id);
  check('a duplicate update is ignored', again.body?.duplicate === true, again.body);
  await deliver('postcard.returned_to_sender', row.lob_id, ref(row));
  row = await rowOf(n);
  check('a returned invitation is recorded; the address stays suppressed', row.mail_outcome === 'returned' && row.status === 'failed', { o: row.mail_outcome, s: row.status });
  await budget();
  res = await send(n);
  check('and it is still refused for its 90 days', res.body?.code === 'RECENTLY_INVITED', res.body);

  n = nextSuite();
  const { suppressionHashFor } = require('../services/addressValidation/mailSuppression');
  await q('insert into "BlockInviteOptOut"(address_hash) values($1)', [suppressionHashFor({ line1: `415 W 6th St Suite ${n}`, city: 'Vancouver', state: 'WA', zip: '98660' })]);
  res = await send(n);
  check('an opted-out address is refused before any send', res.body?.code === 'OPTED_OUT' && !(await rowOf(n)), res.body);

  if (!faults) { skip('invitation timeouts', 'run with --faults'); return; }
  section('Block Founders: lost answers');
  const backdate = (id) => q(`update "BlockInvite" set created_at=now()-interval '20 minutes' where id=$1`, [id]);
  await budget();
  n = nextSuite();
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-after', times: 3 }]);
  res = await send(n);
  row = await rowOf(n);
  check('answer lost: the invitation is saved as pending', res.status === 202 && res.body?.pending === true && row.dispatch_status === 'delivery_unknown', { s: res.status, b: res.body });
  res = await send(n);
  check('answer lost: retrying the address sends nothing', res.body?.code === 'RECENTLY_INVITED', res.body);
  await backdate(row.id);
  await runJob();
  row = await rowOf(n);
  check('answer lost: the printer is asked, and its piece is saved', !!row.lob_id && row.dispatch_status === 'accepted', row.dispatch_status);
  check('answer lost: the printer holds exactly one card', (await piecesFor('pantopus_block_invite_id', row.id)).length === 1);

  await budget();
  n = nextSuite();
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-before', times: 3 }]);
  await send(n);
  row = await rowOf(n);
  await backdate(row.id);
  setFaults([]);
  await runJob();
  row = await rowOf(n);
  check('never reached the printer: sent once after asking', !!row.lob_id && (await piecesFor('pantopus_block_invite_id', row.id)).length === 1, row.dispatch_status);

  await budget();
  n = nextSuite();
  setFaults([{ method: 'POST', path: POST_CARDS, mode: 'timeout-before', times: 3 }]);
  await send(n);
  row = await rowOf(n);
  await q('insert into "BlockInviteOptOut"(address_hash) values($1)', [row.recipient_address_hash]);
  await backdate(row.id);
  setFaults([]);
  await runJob();
  check('opted out meanwhile: the retry is dropped', !(await rowOf(n)) && (await piecesFor('pantopus_block_invite_id', row.id)).length === 0);
}

async function pausedSwitch() {
  section('The switch that stops invitations alone');
  if (String(process.env.BLOCK_FOUNDERS_MAIL_ENABLED).toLowerCase() !== 'false') {
    skip('invitations paused', 'start the backend with BLOCK_FOUNDERS_MAIL_ENABLED=false to check it');
    return;
  }
  const owner = await newPerson('paused');
  const home = await newHome(owner, 'owner');
  const res = await api(owner, 'POST', `/api/homes/${home.id}/block-founders/invites`, { recipient: { line1: `415 W 6th St Suite ${nextSuite()}`, city: 'Vancouver', state: 'WA', zip: '98660' } });
  check('invitations are refused', res.status === 503 && res.body?.code === 'INVITES_PAUSED', res.body);
  const resident = await newPerson('paused2');
  const card = await requestCard(resident, await newHome(resident, 'resident'));
  check('verification cards keep going', card.row.dispatch_status === 'accepted');
}

(async () => {
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  console.log(`T5 on printer ${PRINTER}, test mode${FAULTS ? ', with fault injection' : ''}. Keep this output out of Git and anywhere public.`);
  try {
    if (FAULTS) setFaults([]);
    await homeFlow();
    if (FAULTS) await homeFaults(); else skip('Home postcard timeouts', 'run with --faults');
    await addressFlow(!!FAULTS);
    await inviteFlow(!!FAULTS);
    await pausedSwitch();
  } finally {
    if (FAULTS) setFaults([]);
    await pg.end();
  }
  console.log(`\n${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
  process.exit(counts.fail ? 1 : 0);
})().catch((err) => { console.error(`mail-t5: ${err.stack}`); process.exit(2); });
