#!/usr/bin/env node
// Actual tip service + PostgreSQL RPCs; provider and notice transport are synthetic.
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST));
assert.match(process.env.PGDATABASE || '', /^pantopus_[a-z0-9_]+_contract$/);
assert.ok(['postgres', 'supabase_admin'].includes(process.env.PGUSER));
const run = promisify(execFile);
const uid = n => `aad30000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const payer = uid(1), worker = uid(2), customer = 'cus_tiporiginalsql';
const quote = v => v == null ? 'NULL' : "'" + String(typeof v === 'object' ? JSON.stringify(v) : v).replaceAll("'", "''") + "'";
const ident = v => { assert.match(v, /^[a-zA-Z_][a-zA-Z0-9_]*$/); return `"${v}"`; };
let queries = 0, createCalls = 0, cancelCalls = 0, customerCalls = 0, notices = 0, loseCreate = false, hideList = false, loseRecord = false, failRecord = false;
let loseAdoption = false;
let initialStatus = 'succeeded', holdCreate = null, releaseCreate = null;
const keys = new Map(), intents = new Map(), parameters = new Map(), legacyRequests = new Map();
async function sql(query) {
  queries++;
  const { stdout } = await run('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', `SET statement_timeout='12s'; SET lock_timeout='5s'; ${query}`]);
  return stdout.trim();
}
const allowed = new Set(['preview_gig_tip', 'reserve_gig_tip_original', 'read_gig_tip_original', 'claim_gig_tip_original',
  'prepare_gig_tip_provider', 'record_gig_tip_original', 'release_gig_tip_original', 'cancel_unstarted_gig_tip', 'bind_payment_customer', 'register_legacy_gig_tip']);
const tables = new Set(['User', 'PaymentMethod', 'Payment', 'Gig']);
const db = {
  async rpc(name, args) {
    assert.ok(allowed.has(name), name);
    if (name === 'record_gig_tip_original' && failRecord) return { error: { message: 'Synthetic failed write' } };
    const params = Object.entries(args).map(([k, v]) => { assert.match(k, /^p_[a-z_]+$/); return k + '=>' + quote(v); }).join(',');
    try {
      const data = JSON.parse(await sql(`SET ROLE service_role; SELECT to_jsonb(public.${name}(${params}));`));
      if (name === 'record_gig_tip_original' && loseRecord) { loseRecord = false; return { error: { message: 'Synthetic lost acknowledgement' } }; }
      if (name === 'register_legacy_gig_tip' && loseAdoption) { loseAdoption = false; return { error: { message: 'Synthetic lost adoption acknowledgement' } }; }
      return { data };
    } catch (error) { return { error: { message: error.message } }; }
  },
  from(table) {
    assert.ok(tables.has(table)); let updates = null; const filters = []; let limit = '';
    async function execute() {
      try {
        const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
        const body = updates
          ? `UPDATE public.${ident(table)} SET ${Object.entries(updates).map(([k, v]) => ident(k) + '=' + quote(v)).join(',')}${where} RETURNING *`
          : `SELECT * FROM public.${ident(table)}${where}${limit}`;
        const data = JSON.parse(await sql(`SET ROLE service_role; WITH result AS (${body}) SELECT coalesce(jsonb_agg(to_jsonb(result)),'[]') FROM result;`));
        return { data };
      } catch (error) { return { error: { message: error.message } }; }
    }
    const builder = { select: () => builder, eq: (k, v) => { filters.push(ident(k) + '=' + quote(v)); return builder; },
      is: (k, v) => { assert.equal(v, null); filters.push(ident(k) + ' IS NULL'); return builder; },
      limit: n => { assert.ok(Number.isSafeInteger(n) && n > 0); limit = ' LIMIT ' + n; return builder; },
      update: v => { updates = v; return builder; },
      single: async () => { const result = await execute(); return result.error ? result : result.data.length === 1 ? { data: result.data[0] } : { error: { message: 'Expected exact row' } }; },
      maybeSingle: async () => { const result = await execute(); return result.error ? result : result.data.length <= 1 ? { data: result.data[0] || null } : { error: { message: 'Multiple rows' } }; },
      then: (a, b) => execute().then(a, b) };
    return builder;
  },
};
const copy = v => JSON.parse(JSON.stringify(v));
function setStatus(intent, status) {
  Object.assign(intent, { status, amount_received: status === 'succeeded' ? intent.amount : 0,
    latest_charge: status === 'succeeded' ? 'ch_' + intent.id.slice(3) : null });
}
const stripe = {
  customers: {
    create: async args => { assert.equal(args.metadata.user_id, payer); customerCalls++; return { id: customer }; },
    retrieve: async id => { assert.equal(id, customer); return { id, livemode: false, metadata: { user_id: payer } }; },
  },
  ephemeralKeys: { create: async args => { assert.equal(args.customer, customer); return { secret: 'ek_synthetic' }; } },
  paymentMethods: { retrieve: async id => ({ id, customer, livemode: false }) },
  paymentIntents: {
    async create(params, options) {
      createCalls++;
      const request = params.metadata.tip_request_id;
      const saved = JSON.parse(await sql(`SELECT to_jsonb(p) FROM public."Payment" p WHERE id=${quote(request)};`));
      assert.ok(saved && saved.metadata.gig_tip_original_v1.provider_started_at, 'Provider reached before reservation/preparation');
      assert.deepEqual(saved.metadata.gig_tip_original_v1.provider_params, params);
      assert.equal(options.idempotencyKey, `gig-tip:${request}`);
      let id = keys.get(options.idempotencyKey);
      if (id) assert.deepEqual(parameters.get(id), params);
      else {
        id = 'pi_tiporiginalsql' + (intents.size + 1); keys.set(options.idempotencyKey, id); parameters.set(id, copy(params));
        const intent = { id, customer, livemode: false, amount: params.amount, currency: params.currency,
          capture_method: 'automatic', confirmation_method: 'automatic', amount_capturable: 0, transfer_data: null,
          on_behalf_of: null, application_fee_amount: null, payment_method: 'pm_tiporiginalsql',
          metadata: params.metadata, client_secret: id + '_secret_synthetic', created: Math.floor(Date.now() / 1000) };
        setStatus(intent, initialStatus); intents.set(id, intent);
      }
      if (holdCreate) { const announce = holdCreate; holdCreate = null; announce(); await new Promise(resolve => { releaseCreate = resolve; }); }
      if (loseCreate) { loseCreate = false; throw new Error('Synthetic lost provider response'); }
      return copy(intents.get(id));
    },
    async retrieve(id) { assert.ok(intents.has(id)); return copy(intents.get(id)); },
    async list(args) {
      assert.equal(args.customer, customer);
      return { data: hideList ? [] : [...intents.values()].filter(i => i.created >= args.created.gte).map(copy), has_more: false };
    },
    async cancel(id, params, options) {
      cancelCalls++; const intent = intents.get(id); assert.ok(intent);
      assert.equal(options.idempotencyKey, `gig-tip-cancel:${intent.metadata.tip_request_id || legacyRequests.get(id)}:${id}`);
      assert.equal(params.cancellation_reason, 'requested_by_customer'); setStatus(intent, 'canceled'); return copy(intent);
    },
  },
  charges: { retrieve: async id => {
    const intent = [...intents.values()].find(i => i.latest_charge === id); assert.ok(intent);
    return { id, payment_intent: intent.id, customer, livemode: false, amount: intent.amount, currency: 'usd',
      on_behalf_of: null, transfer: null, destination: null, application_fee: null, application_fee_amount: null,
      paid: true, captured: true, amount_captured: intent.amount, amount_refunded: 0, refunded: false, disputed: false,
      dispute: null, created: intent.created };
  } },
};
const overrides = new Map([[root + '/backend/config/supabaseAdmin.js', db],
  [root + '/backend/stripe/getStripeClient.js', { getStripeClient: () => stripe }],
  [root + '/backend/services/notificationService.js', { createNotification: async n => {
    assert.equal(n.userId, worker); assert.equal(n.idempotencyKey, `gig-tip-received:${n.metadata.payment_id}`); notices++; return { id: uid(900) };
  } }], [root + '/backend/utils/logger.js', { info() {}, warn() {}, error() {}, debug() {} }]]);
process.env.STRIPE_SECRET_KEY = 'sk_test_local_tip_original_synthetic';
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) { const key = Module._resolveFilename(name, parent, isMain); return overrides.has(key) ? overrides.get(key) : originalLoad.apply(this, arguments); };
const service = require(root + '/backend/stripe/stripeService.js'); Module._load = originalLoad;
async function command(n) {
  const preview = await service.previewTip({ gigId: uid(100 + n), payerId: payer });
  assert.equal(preview.eligible, true);
  return { requestId: uid(300 + n), payerId: payer, gigId: uid(100 + n), amount: 500, paymentMethodId: null,
    expectedTerms: preview.terms, sessionScope: 'a'.repeat(64), mode: 'resume' };
}
const read = cmd => service.readTipRequest({ requestId: cmd.requestId, payerId: payer });
const providerFor = cmd => [...intents.values()].find(i => i.metadata.tip_request_id === cmd.requestId);
(async () => {
  let seeded = false, scenarios = 0;
  const pass = message => { scenarios++; console.log('PASS: ' + message); };
  try {
    assert.equal(await sql(`SELECT count(*) FROM auth.users WHERE id IN(${quote(payer)},${quote(worker)});`), '0');
    await sql(`BEGIN; INSERT INTO auth.users(id,email) VALUES(${quote(payer)},'tip-original-payer@example.invalid'),(${quote(worker)},'tip-original-worker@example.invalid');
      INSERT INTO public."User"(id,email,username,name) SELECT id,email,'tip_original_sql_'||right(id::text,1),'Synthetic tip' FROM auth.users WHERE id IN(${quote(payer)},${quote(worker)});
      INSERT INTO public."StripeAccount"(user_id,stripe_account_id) VALUES(${quote(worker)},'acct_tiporiginalsql');
      INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,owner_confirmed_at) VALUES ${Array.from({ length: 18 }, (_, i) =>
        `(${quote(uid(101 + i))},${quote(payer)},${quote(payer)},'Tip original','Synthetic',0,'completed',${quote(worker)},now())`).join(',')}; COMMIT;`); seeded = true;
    let cmd = await command(1), result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'succeeded'); assert.equal(result.receipt.amountChargedCents, 500); assert.equal(customerCalls, 1);
    assert.equal(await sql(`SELECT amount_to_payee FROM public."Payment" WHERE id=${quote(cmd.requestId)};`), '500');
    assert.equal((await read(cmd)).status, 'succeeded'); pass('first free-task tip reserves Payment before existing customer CAS and captures full worker amount');
    cmd = await command(2); loseCreate = true; hideList = true; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'pending'); assert.equal(result.receipt, null); const createsBefore = createCalls;
    hideList = false; result = await service.createTipPayment({ ...cmd, mode: 'check' });
    assert.equal(result.status, 'succeeded'); assert.equal(createCalls, createsBefore); pass('lost create response recovers exact provider intent through read-only discovery');
    cmd = await command(3); loseCreate = true; hideList = true; await service.createTipPayment(cmd);
    const countBefore = intents.size; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'succeeded'); assert.equal(intents.size, countBefore); hideList = false;
    pass('explicit unknown retry reuses exact saved parameters and one provider identity');
    cmd = await command(4); initialStatus = 'requires_action'; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'requires_action'); assert.ok(result.checkout.clientSecret); assert.equal(result.receipt, null);
    const retained = await sql(`SELECT metadata FROM public."Payment" WHERE id=${quote(cmd.requestId)};`);
    assert.ok(!retained.includes('_secret_') && !retained.includes('ek_synthetic'));
    setStatus(providerFor(cmd), 'succeeded'); result = await service.createTipPayment({ ...cmd, mode: 'check' });
    assert.equal(result.status, 'succeeded'); pass('SDK checkout remains transient and same-ID check requires actual capture');
    cmd = await command(5); result = await service.createTipPayment(cmd); assert.equal(result.status, 'requires_action');
    result = await service.createTipPayment({ ...cmd, mode: 'cancel' });
    assert.equal(result.status, 'canceled'); assert.equal(result.receipt.amountChargedCents, 0); pass('explicit provider cancellation completes only after current zero-charge proof');
    cmd = await command(6); await service._tipRpc('reserve_gig_tip_original', { p_request_id: cmd.requestId, p_actor_id: payer, p_gig_id: cmd.gigId,
      p_amount: 500, p_payment_method_id: null, p_expected: cmd.expectedTerms, p_session_scope: cmd.sessionScope, p_livemode: false });
    const beforeCancel = cancelCalls; result = await service.createTipPayment({ ...cmd, mode: 'cancel' });
    assert.equal(result.status, 'canceled'); assert.equal(cancelCalls, beforeCancel); pass('unstarted cancellation uses local proof without provider mutation');
    cmd = await command(7); initialStatus = 'succeeded'; loseRecord = true; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'succeeded'); assert.equal((await read(cmd)).receipt.paymentIntentId, providerFor(cmd).id);
    pass('lost committed database acknowledgement recovers durable exact receipt');
    cmd = await command(8); failRecord = true; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'pending'); assert.equal(result.receipt, null); assert.equal(result.checkout, undefined);
    failRecord = false; result = await service.createTipPayment({ ...cmd, mode: 'check' });
    assert.equal(result.status, 'succeeded'); pass('uncommitted receipt never reports paid; original provider result can reconcile later');
    cmd = await command(9); let announced; const ready = new Promise(resolve => { announced = resolve; }); holdCreate = announced;
    const first = service.createTipPayment(cmd); await ready;
    const second = await service.createTipPayment(cmd); assert.equal(second.status, 'pending'); assert.equal(second.canRetry, false);
    releaseCreate(); result = await first; assert.equal(result.status, 'succeeded');
    assert.equal([...intents.values()].filter(i => i.metadata.tip_request_id === cmd.requestId).length, 1);
    pass('concurrent service requests share one SQL lease and one intent');
    cmd = await command(10); initialStatus = 'requires_action'; await service.createTipPayment(cmd);
    providerFor(cmd).amount = 600; result = await service.createTipPayment({ ...cmd, mode: 'check' });
    assert.equal(result.status, 'needs_review'); assert.equal(result.receipt, null); assert.equal(result.checkout, undefined);
    providerFor(cmd).amount = 500; pass('provider amount mismatch cannot create a receipt or expose checkout');
    cmd = await command(11); const n = createCalls;
    await assert.rejects(service.createTipPayment({ ...cmd, mode: 'check' }), e => e.code === 'TIP_NOT_FOUND');
    assert.equal(createCalls, n); assert.equal(await sql(`SELECT count(*) FROM public."Payment" WHERE id=${quote(cmd.requestId)};`), '0');
    pass('unknown read-only command neither reserves nor creates replacement');
    cmd = await command(12); const beforeTombstone = createCalls;
    result = await service.createTipPayment({ ...cmd, mode: 'cancel' });
    assert.equal(result.status, 'canceled'); assert.equal(result.receipt.amountChargedCents, 0);
    result = await service.createTipPayment(cmd); assert.equal(result.status, 'canceled'); assert.equal(createCalls, beforeTombstone);
    pass('cancel before first admission saves the same UUID and prevents a delayed original submission from charging');
    const beforeLegacy = { createCalls, customerCalls };
    async function legacyCommand(n, status = 'requires_action', withIntent = true) {
      const requestId = uid(300 + n), gigId = uid(100 + n), intentId = 'pi_legacytip' + n;
      const intent = { id: intentId, customer, livemode: false, amount: 500, currency: 'usd',
        capture_method: 'automatic', confirmation_method: 'automatic', amount_capturable: 0, transfer_data: null,
        on_behalf_of: null, application_fee_amount: null, payment_method: 'pm_legacytip',
        metadata: { gig_id: gigId, payer_id: payer, payee_id: worker, payment_type: 'tip', platform_fee: '0' },
        client_secret: intentId + '_secret_synthetic', created: 1710000000 };
      setStatus(intent, status); intents.set(intentId, intent); legacyRequests.set(intentId, requestId);
      await sql(`INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,payment_type,payment_status,amount_total,amount_subtotal,
        amount_to_payee,amount_platform_fee,amount_processing_fee,tip_amount,currency,stripe_customer_id,stripe_payment_intent_id,metadata)
        VALUES(${quote(requestId)},${quote(gigId)},${quote(payer)},${quote(worker)},'tip','authorize_pending',500,500,500,0,44,500,'USD',
        ${quote(customer)},${quote(withIntent ? intentId : null)},NULL);
        UPDATE public."Gig" SET accepted_by=NULL,owner_confirmed_at=NULL WHERE id=${quote(gigId)};`);
      const local = await service.readTipRequest({ requestId, payerId: payer });
      assert.equal(local.status, 'needs_review'); assert.equal(local.receipt, null); assert.equal(local.request.source, 'legacy');
      assert.equal(local.request.terms.ownerConfirmedAt, null); assert.equal(local.request.payeeId, worker);
      return { requestId, gigId, payerId: payer, amount: 500, paymentMethodId: null, expectedTerms: local.request.terms,
        sessionScope: 'b'.repeat(64), mode: 'check' };
    }
    cmd = await legacyCommand(13); result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'requires_action'); assert.equal(result.canRetry, false); assert.equal(result.checkout, undefined);
    await assert.rejects(service.createTipPayment({ ...cmd, mode: 'resume' }), e => e.code === 'TIP_LEGACY_CHECK_ONLY');
    pass('older pending tip registers exact existing provider identity without current worker, confirmation or SDK credentials');
    result = await service.createTipPayment({ ...cmd, mode: 'cancel' });
    assert.equal(result.status, 'canceled'); assert.equal(result.receipt.amountChargedCents, 0);
    assert.equal((await read(cmd)).receipt.paymentIntentId, 'pi_legacytip13');
    pass('older explicit cancellation uses the same provider ID and commits a current zero-charge receipt');
    cmd = await legacyCommand(14, 'succeeded'); loseAdoption = true; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'succeeded'); assert.equal(result.receipt.amountChargedCents, 500);
    assert.equal(result.request.currency, 'usd');
    assert.equal(await sql(`SELECT currency FROM public."Payment" WHERE id=${quote(cmd.requestId)};`), 'USD');
    pass('lost historical capture registration reply recovers exact committed receipt and preserves raw currency');
    cmd = await legacyCommand(15, 'succeeded');
    await sql(`UPDATE public."Payment" SET payment_status='transferred',stripe_charge_id='ch_legacytip15',
      captured_at='2024-01-01Z',payment_succeeded_at='2024-01-01Z',cooling_off_ends_at='2024-01-03Z',
      transfer_completed_at='2024-01-04Z',transfer_status='paid' WHERE id=${quote(cmd.requestId)};`);
    const history = JSON.parse(await sql(`SELECT to_jsonb(p) FROM public."Payment" p WHERE id=${quote(cmd.requestId)};`));
    result = await service.createTipPayment(cmd); assert.equal(result.status, 'succeeded'); assert.equal(result.paymentStatus, 'transferred');
    const after = JSON.parse(await sql(`SELECT to_jsonb(p) FROM public."Payment" p WHERE id=${quote(cmd.requestId)};`));
    for (const field of ['currency', 'captured_at', 'payment_succeeded_at', 'cooling_off_ends_at', 'transfer_completed_at', 'transfer_status']) {
      assert.equal(after[field], history[field]);
    }
    pass('historical transferred payment retains its capture, cooldown and transfer history');
    cmd = await legacyCommand(16, 'requires_action', false); result = await service.createTipPayment({ ...cmd, mode: 'cancel' });
    assert.equal(result.status, 'needs_review'); assert.equal(result.receipt, null); assert.equal(result.canCancel, false);
    assert.equal(await sql(`SELECT metadata IS NULL FROM public."Payment" WHERE id=${quote(cmd.requestId)};`), 't');
    pass('missing older provider identity remains unresolved and unregistered');
    cmd = await legacyCommand(17); intents.get('pi_legacytip17').amount = 600; result = await service.createTipPayment(cmd);
    assert.equal(result.status, 'needs_review'); assert.equal(result.receipt, null);
    assert.equal(await sql(`SELECT metadata IS NULL FROM public."Payment" WHERE id=${quote(cmd.requestId)};`), 't');
    pass('wrong historical provider amount leaves the existing row unregistered');
    cmd = await legacyCommand(18); const firstAdoption = service.createTipPayment(cmd), secondAdoption = service.createTipPayment(cmd);
    const adopted = await Promise.all([firstAdoption, secondAdoption]);
    assert.ok(adopted.every(r => r.request.requestId === cmd.requestId && r.canRetry === false && r.checkout === undefined));
    assert.equal(await sql(`SELECT count(*) FROM public."Payment" WHERE id=${quote(cmd.requestId)};`), '1');
    assert.deepEqual({ createCalls, customerCalls }, beforeLegacy);
    pass('concurrent historical adoption retains one payment and no legacy scenario creates a provider payment or customer');
    console.log(JSON.stringify({ scenarios, queries, createCalls, distinctIntents: intents.size, cancelCalls, customerCalls, notices,
      boundary: 'Actual StripeService and PostgreSQL RPCs via local psql adapter; synthetic provider and notice transport, no hosted/provider acceptance' }));
  } finally {
    if (releaseCreate) releaseCreate();
    if (seeded) {
      await sql(`BEGIN; SET LOCAL session_replication_role=replica; DELETE FROM public."Payment" WHERE id IN(${Array.from({ length: 18 }, (_, i) => quote(uid(301 + i))).join(',')});
        SET LOCAL session_replication_role=origin; DELETE FROM public."Gig" WHERE id IN(${Array.from({ length: 18 }, (_, i) => quote(uid(101 + i))).join(',')});
        DELETE FROM public."StripeAccount" WHERE user_id=${quote(worker)}; DELETE FROM public."User" WHERE id IN(${quote(payer)},${quote(worker)});
        DELETE FROM auth.users WHERE id IN(${quote(payer)},${quote(worker)}); COMMIT;`);
      assert.equal(await sql(`SELECT (SELECT count(*) FROM public."Payment" WHERE id::text LIKE 'aad30000-%')+(SELECT count(*) FROM public."Gig" WHERE id::text LIKE 'aad30000-%')+(SELECT count(*) FROM public."User" WHERE id::text LIKE 'aad30000-%')+(SELECT count(*) FROM auth.users WHERE id::text LIKE 'aad30000-%');`), '0');
      console.log('PASS: exact synthetic fixture cleanup verified');
    }
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
