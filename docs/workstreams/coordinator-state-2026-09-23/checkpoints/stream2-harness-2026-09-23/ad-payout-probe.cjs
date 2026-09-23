// Earn honesty probe: what the native Earnings tab would show after an ordinary user sends an "ad" letter with a
// payout (the web structured compose offers type Ad and "Payout amount (optional)" up to $10). The owner fixture
// sends one to the lease-resident account through the real POST /api/mailbox/send; the resident views it through
// the real PATCH /api/mailbox/:id/view. Prints the earnings summary and history the Earnings tab reads, the value the
// apps compute for "Available to cash out" (max(0, totalEarned - pendingEarnings)), and the real wallet.
const h = require('./h.cjs');
const fs = require('node:fs');
(async () => {
  const owner = await h.login('owner'); const user = await h.login('viewer');
  const reads = async (tag) => {
    const s = await h.api('GET', '/api/mailbox/earnings/summary', user);
    const hist = await h.api('GET', '/api/mailbox/earnings/history', user);
    const w = await h.api('GET', '/api/wallet', user);
    const sum = s.json || {};
    const shown = Math.max(0, (sum.totalEarned || 0) - (sum.pendingEarnings || 0)).toFixed(2);
    const rows = ((hist.json && hist.json.earnings) || []).map((e) => `${e.subject}:${e.payout_amount}:${e.payout_status}`);
    console.log(`${tag}: earnings/summary ${JSON.stringify(sum)}; history ${JSON.stringify(rows)}; `
      + `apps show "Available to cash out $${shown}" and "Cash out $${shown}"; /api/wallet balance=${w.json && w.json.wallet ? w.json.wallet.balance : 'n/a'}`);
  };
  await reads('before');
  const send = await h.api('POST', '/api/mailbox/send', owner, {
    recipientUserId: user.id, type: 'ad', subject: 'Stream2 RD ad payout probe', content: 'Synthetic ad letter for the Earn honesty check.', payoutAmount: 10,
  });
  const id = send.json && (send.json.mail?.id || send.json.mailId || send.json.id);
  console.log(`owner POST /api/mailbox/send type=ad payoutAmount=10 to the resident -> ${send.status} mail=${id ? id.slice(0, 8) : JSON.stringify(send.json).slice(0, 200)}`);
  if (id) fs.appendFileSync(__dirname + '/work/t29-mail-ids.txt', `${id}\n`);
  await reads('after send, unopened');
  if (!id) return;
  const view = await h.api('PATCH', `/api/mailbox/${id}/view`, user);
  console.log(`resident PATCH /api/mailbox/:id/view -> ${view.status} ${JSON.stringify(view.json)}`);
  await reads('after the resident opens it');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
