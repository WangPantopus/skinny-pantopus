// Follow-up to coupon-order-probe.cjs on the same synthetic offer A (id passed in). Reads the canonical wallet
// (GET /api/wallet) and the mailbox earnings summary before and after a coupon order on a pending transaction,
// then repeats the order after the transaction is put under review and after it is rejected (the other risk holds).
// Usage: node coupon-order-probe2.cjs <offerA-id>
const h = require('./h.cjs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const A = process.argv[2];
  const user = await h.login('viewer');
  const tx = () => sql(`select status || ':' || amount from "EarnTransaction" where user_id='${user.id}' and offer_id='${A}'`);
  const reads = async (tag) => {
    const bal = await h.api('GET', '/api/mailbox/v2/earn/balance', user);
    const wal = await h.api('GET', '/api/wallet', user);
    const sum = await h.api('GET', '/api/mailbox/earnings/summary', user);
    const w = wal.json && wal.json.wallet;
    console.log(`${tag}: EarnTransaction ${tx()}; earn/balance ${JSON.stringify(bal.json && bal.json.balance)}; `
      + `/api/wallet ${wal.status} balance=${w ? w.balance : 'n/a'} lifetime_received=${w ? w.lifetime_received : 'n/a'}; `
      + `earnings/summary ${JSON.stringify(sum.json)}`);
  };
  const order = async (name) => {
    const r = await h.api('POST', '/api/mailbox/v2/p2/coupon/order', user, { offerId: A, items: [{ name: 'Synthetic item', price: 10, quantity: 1 }] });
    console.log(`user POST /coupon/order A (${name}) -> ${r.status} earnPayoutReleased=${r.json && r.json.earnPayoutReleased}`);
  };
  sql(`update "EarnTransaction" set status='pending', verified_at=null where user_id='${user.id}' and offer_id='${A}'`);
  await reads('A reset to pending (SQL)');
  await order('pending');
  await reads('after order');
  for (const hold of ['under_review', 'rejected']) {
    sql(`update "EarnTransaction" set status='${hold}' where user_id='${user.id}' and offer_id='${A}'`);
    await reads(`A set to ${hold} (SQL)`);
    await order(hold);
    await reads('after order');
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
