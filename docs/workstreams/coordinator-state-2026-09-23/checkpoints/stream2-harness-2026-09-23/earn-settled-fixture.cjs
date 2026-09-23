// Earn check fixture: a synthetic settled task for <worker>, with task income credited to the worker's wallet by the
// backend's own walletService.creditGigIncome (the credit processPendingTransfers makes after cooling-off). This stack
// has no working Stripe TEST key and no settlement SQL, so the task, its acceptance and its payment are synthetic rows;
// the wallet credit is the real service path. Then the poster sends the worker an "Ad" letter with an unfunded $10
// payout (the web structured compose allows it), and the worker opens it through the legacy view route, which is what
// registers an ad payout. Usage: node earn-settled-fixture.cjs <worker>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const env = process.env; // the stack's URL and keys come from the private supabase.env, sourced by the caller
(async () => {
  const who = process.argv[2];
  const owner = await h.login('owner'); const worker = await h.login(who);
  const keep = (k, v) => fs.appendFileSync(__dirname + `/work/t31-${k}.txt`, `${v}\n`);
  const title = `Stream2 RD settled task for Earn (${who})`;
  const g = await h.api('POST', '/api/gigs', owner, { title, description: 'Synthetic Stream2 Earn check: a finished, paid task.', price: 40, category: 'General',
    location: { mode: 'address', latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA' } });
  const gigId = g.json && g.json.gig && g.json.gig.id;
  if (!gigId) throw new Error('gig create failed ' + g.status + ' ' + JSON.stringify(g.json));
  keep('gig-ids', gigId);
  sql(`update "Gig" set status='completed', accepted_by='${worker.id}' where id='${gigId}'`);
  const payId = sql(`insert into "Payment" (payer_id, payee_id, gig_id, amount_total, amount_subtotal, amount_platform_fee, amount_to_payee, payment_type, payment_status, transfer_status, currency)
    values ('${owner.id}', '${worker.id}', '${gigId}', 4000, 4000, 400, 3600, 'gig_payment', 'transferred', 'wallet_credited', 'usd') returning id`).split('\n')[0];
  keep('payment-ids', payId);
  console.log(`owner POST /api/gigs -> ${g.status}; synthetic settle: task ${gigId.slice(0, 8)} completed by ${who}, payment ${payId.slice(0, 8)} $40.00 (worker share $36.00)`);
  const out = execFileSync('node', ['-e', `
    const ws = require('./services/walletService');
    ws.creditGigIncome('${worker.id}', 3600, '${gigId}', '${payId}', '${owner.id}').then((tx) => console.log('walletService.creditGigIncome -> tx ' + String(tx.id || tx.transaction_id || JSON.stringify(tx)).slice(0, 8)))
      .catch((e) => { console.log('credit failed ' + e.message); process.exit(1); });`], { cwd: '/private/tmp/pantopus-stream2-work-backend/backend', env: {
    ...env, NODE_ENV: 'development', SUPABASE_URL: env.S2_API_URL, SUPABASE_SERVICE_ROLE_KEY: env.S2_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY: env.S2_ANON_KEY } }).toString().trim();
  console.log(out.split('\n').filter((l) => /creditGigIncome|credit failed/.test(l)).join('\n'));
  const w = await h.api('GET', '/api/wallet', worker);
  console.log(`${who} GET /api/wallet -> ${w.status} balance=${w.json.wallet.balance} lifetime_received=${w.json.wallet.lifetime_received}`);
  const send = await h.api('POST', '/api/mailbox/send', owner, { recipientUserId: worker.id, type: 'ad', subject: 'Stream2 RD paid ad (Earn check)', content: 'Synthetic ad letter for the Earn check.', payoutAmount: 10 });
  const mailId = send.json && (send.json.mail?.id || send.json.mailId || send.json.id);
  keep('mail-ids', mailId);
  const view = await h.api('PATCH', `/api/mailbox/${mailId}/view`, worker);
  const s = await h.api('GET', '/api/mailbox/earnings/summary', worker);
  console.log(`owner sends an Ad letter with an unfunded $10 payout -> ${send.status}; ${who} opens it (PATCH /view) -> ${view.status}; earnings/summary ${JSON.stringify(s.json)}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
