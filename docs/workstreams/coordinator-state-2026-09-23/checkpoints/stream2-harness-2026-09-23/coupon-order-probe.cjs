// Money-safety probe for POST /api/mailbox/v2/p2/coupon/order on the disposable Stream 2 stack, with owned
// synthetic fixtures only. Seeds two synthetic EarnOffers (the offers' advertiser is the owner fixture account).
// The lease-resident account opens offer A through the real /earn/open (a pending EarnTransaction), then calls
// /coupon/order for A, again for A, for offer B it never opened, and for A after its transaction is flagged.
// Prints the EarnTransaction status, the earn balance, and the redemption and receipt rows after each call.
// Usage: node coupon-order-probe.cjs <label>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const label = process.argv[2] || 'run';
  const owner = await h.login('owner'); const user = await h.login('viewer');
  const mk = (t) => sql(`insert into "EarnOffer" (advertiser_id, business_name, offer_title, payout_amount, status, discount_type, discount_value)
    values ('${owner.id}', 'Stream2 Probe Shop', 'Stream2 RD coupon probe ${t}', 1.25, 'active', 'percentage', 10) returning id`).split('\n')[0];
  const A = mk('A'); const B = mk('B');
  fs.appendFileSync(__dirname + '/work/t28-offer-ids.txt', `${A}\n${B}\n`);
  console.log(`# ${label}: synthetic offers A=${A.slice(0, 8)} B=${B.slice(0, 8)} (payout 1.25 each)`);
  const state = (tag) => {
    const tx = sql(`select coalesce(string_agg(left(offer_id::text,8) || ':' || status || ':' || amount, ' ' order by created_at), 'none') from "EarnTransaction" where user_id='${user.id}' and offer_id in ('${A}','${B}')`);
    const red = sql(`select count(*) from "OfferRedemption" where user_id='${user.id}' and offer_id in ('${A}','${B}')`);
    const rec = sql(`select count(*) from "Mail" where recipient_user_id='${user.id}' and sender_display='Stream2 Probe Shop'`);
    return `${tag}: EarnTransaction ${tx}; redemptions ${red}; receipt letters ${rec}`;
  };
  const balance = async () => { const r = await h.api('GET', '/api/mailbox/v2/earn/balance', user); return JSON.stringify(r.json && r.json.balance); };
  const open = await h.api('POST', '/api/mailbox/v2/earn/open', user, { offerId: A });
  console.log(`user POST /earn/open A -> ${open.status} ${JSON.stringify(open.json)}`);
  console.log(state('after open') + `; balance ${await balance()}`);
  const order = async (offer, name) => {
    const r = await h.api('POST', '/api/mailbox/v2/p2/coupon/order', user, { offerId: offer, items: [{ name: 'Synthetic item', price: 10, quantity: 1 }] });
    console.log(`user POST /coupon/order ${name} -> ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`);
    console.log(state(`after order ${name}`) + `; balance ${await balance()}`);
  };
  await order(A, 'A (opened, pending)');
  await order(A, 'A again');
  await order(B, 'B (never opened)');
  sql(`update "EarnTransaction" set status='flagged' where user_id='${user.id}' and offer_id='${A}'`);
  console.log(state('risk system flags A (set by SQL)') + `; balance ${await balance()}`);
  await order(A, 'A while flagged');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
