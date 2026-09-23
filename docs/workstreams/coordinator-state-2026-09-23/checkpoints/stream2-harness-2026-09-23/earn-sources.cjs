// What the Earn Earnings tab reads for each account, and what each build shows from it.
// Old build: "Available to cash out" = earnings/summary totalEarned - pendingEarnings. New build: the wallet balance
// (GET /api/wallet, cents), with mail-offer and ad payouts (earnings/history rows) in a separate "Mail offers" cell.
const h = require('./h.cjs');
(async () => {
  for (const who of process.argv.slice(2)) {
    const u = await h.login(who);
    const [w, s, hist] = await Promise.all([h.api('GET', '/api/wallet', u), h.api('GET', '/api/mailbox/earnings/summary', u), h.api('GET', '/api/mailbox/earnings/history', u)]);
    const rows = (hist.json && hist.json.earnings) || [];
    const oldAvail = Math.max(0, (s.json.totalEarned || 0) - (s.json.pendingEarnings || 0)).toFixed(2);
    const offers = rows.reduce((n, r) => n + (Number(r.payout_amount) || 0), 0).toFixed(2);
    const bal = (w.json.wallet.balance / 100).toFixed(2);
    const populatedOld = (s.json.totalEarned || 0) > 0 || rows.length > 0;
    const populatedNew = w.json.wallet.balance > 0 || (w.json.wallet.lifetime_received || 0) > 0 || rows.length > 0;
    console.log(`${who}: wallet balance $${bal} (lifetime received $${((w.json.wallet.lifetime_received || 0) / 100).toFixed(2)}); summary ${JSON.stringify(s.json)}; ad rows ${rows.length}`);
    console.log(`  old build: ${populatedOld ? `"Available to cash out $${oldAvail}" + "Cash out $${oldAvail}"` : 'empty state'}`);
    console.log(`  new build: ${populatedNew ? `"Available to cash out $${bal}"${rows.length ? ` + "Mail offers $${offers} · can't be cashed out yet"` : ''} + ${Number(bal) > 0 ? `"Cash out $${bal}"` : '"Browse open tasks"'}` : 'empty state'}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
