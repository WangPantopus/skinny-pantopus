// R06 web step 4: revoke from the real issued-letter card, then confirm card state and historical PDF.
const fs = require('node:fs'); const crypto = require('node:crypto'); const w = require('./web-lib.cjs');
(async () => {
  const b = await w.browser(); const ctx = await w.signedInContext(b, process.argv[2] || 'editor'); const page = await ctx.newPage();
  const net = []; w.netLog(page, net);
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: /Generate a verified residency letter/ }).click();
  await page.getByText('ISSUED LETTERS', { exact: false }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /Revoke/ }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: w.OUT + '/06-before-revoke.png' });
  await page.getByRole('button', { name: /Revoke/ }).first().click();
  await page.getByText(/Letter revoked/).waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.getByText('Revoked', { exact: true }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: w.OUT + '/07-after-revoke-card.png' });
  const mailDisabled = await page.getByRole('button', { name: /^Mail$/ }).first().isDisabled();
  const revokeVisible = await page.getByRole('button', { name: /Revoke/ }).count();
  const dlP = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: /^PDF$/ }).first().click();
  const dl = await dlP; const p = w.OUT + '/revoked-historical-download.pdf'; await dl.saveAs(p);
  const text = await page.innerText('body');
  const res = { mailDisabled, revokeButtons: revokeVisible, historicalPdfSha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
    cardText: text.slice(text.indexOf('ISSUED LETTERS'), text.indexOf('ISSUED LETTERS') + 140), net };
  fs.writeFileSync(w.OUT + '/web-revoke-result.json', JSON.stringify(res, null, 2));
  console.log(JSON.stringify({ ...res, net: net.map(n => `${n.method} ${n.path} ${n.status}`) }, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
