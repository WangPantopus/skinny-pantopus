// Branch check for POST /api/mailbox/v2/p2/coupon/order (disabled). Seeds one synthetic EarnOffer (advertiser: the
// owner fixture account); the lease-resident account opens it through the real /earn/open (pending transaction).
// Then: order it (valid body), order it with an invalid body, order a random uuid, order while the transaction is
// flagged, and order without a session. Prints the status and body of each call, and the transaction, redemptions
// and events after each. Usage: node coupon-order-branch.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const label = process.argv[2] || 'run';
  const owner = await h.login('owner'); const user = await h.login('viewer');
  const A = sql(`insert into "EarnOffer" (advertiser_id, business_name, offer_title, payout_amount, status, discount_type, discount_value)
    values ('${owner.id}', 'Stream2 Probe Shop', 'Stream2 RD coupon probe branch', 1.25, 'active', 'percentage', 10) returning id`).split('\n')[0];
  fs.appendFileSync(__dirname + '/work/t28-offer-ids.txt', `${A}\n`);
  console.log(`# ${label}: synthetic offer A=${A.slice(0, 8)} (payout 1.25)`);
  const state = (tag) => {
    const tx = sql(`select coalesce(string_agg(status || ':' || amount, ' '), 'none') from "EarnTransaction" where user_id='${user.id}' and offer_id='${A}'`);
    const red = sql(`select count(*) from "OfferRedemption" where user_id='${user.id}'`);
    const ev = sql(`select count(*) from "MailEvent" where user_id='${user.id}' and event_type='coupon_order_placed'`);
    return `${tag}: EarnTransaction ${tx}; redemptions ${red}; coupon_order_placed events ${ev}`;
  };
  const balance = async () => { const r = await h.api('GET', '/api/mailbox/v2/earn/balance', user); return JSON.stringify(r.json && r.json.balance); };
  const open = await h.api('POST', '/api/mailbox/v2/earn/open', user, { offerId: A });
  console.log(`user POST /earn/open A -> ${open.status} ${JSON.stringify(open.json)}`);
  console.log(state('after open') + `; balance ${await balance()}`);
  const order = async (name, body, who = user) => {
    const r = await h.api('POST', '/api/mailbox/v2/p2/coupon/order', who, body);
    console.log(`${who ? 'user' : 'anonymous'} POST /coupon/order ${name} -> ${r.status} ${JSON.stringify(r.json)}`);
    console.log(state(`after order ${name}`) + `; balance ${await balance()}`);
  };
  const valid = (offerId) => ({ offerId, items: [{ name: 'Synthetic item', price: 10, quantity: 1 }] });
  await order('A (opened, pending)', valid(A));
  await order('A again', valid(A));
  await order('invalid body', { offerId: 'not-a-uuid' });
  await order('random uuid', valid(crypto.randomUUID()));
  sql(`update "EarnTransaction" set status='flagged' where user_id='${user.id}' and offer_id='${A}'`);
  console.log(state('risk system flags A (set by SQL)'));
  await order('A while flagged', valid(A));
  await order('A without a session', valid(A), null);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
