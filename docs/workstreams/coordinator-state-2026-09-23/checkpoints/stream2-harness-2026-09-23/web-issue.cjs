// R06 web step 1-2: real Identity -> Residency letter UI issue + view/download as the verified lease resident (editor).
const fs = require('node:fs'); const crypto = require('node:crypto');
const w = require('./web-lib.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const b = await w.browser(); const ctx = await w.signedInContext(b, process.argv[2] || 'editor'); const page = await ctx.newPage();
  const net = []; w.netLog(page, net);
  await page.goto(w.WEB + '/app/place/identity', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: /Generate a verified residency letter/ }).click();
  await page.getByLabel('What is this letter for?').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: w.OUT + '/01-letter-leaf-before-issue.png', fullPage: true });
  await page.getByLabel('What is this letter for?').fill('R06 library card application');
  const dl1P = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: /Issue verified letter/ }).click();
  const dl1 = await dl1P; const p1 = w.OUT + '/issued-auto-download.pdf'; await dl1.saveAs(p1);
  await page.getByText(/Letter issued — verification code/).waitFor({ timeout: 20000 }).catch(() => {});
  await page.screenshot({ path: w.OUT + '/02-issued-toast.png', fullPage: true });
  await page.waitForTimeout(1500);
  const text = await page.innerText('body');
  const code = (text.match(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/) || [])[0];
  await page.screenshot({ path: w.OUT + '/03-issued-card-active.png', fullPage: true });
  const dl2P = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: /^PDF$/ }).first().click();
  const dl2 = await dl2P; const p2 = w.OUT + '/issued-card-download.pdf'; await dl2.saveAs(p2);
  const res = { code, autoDownload: { name: dl1.suggestedFilename(), sha256: sha(fs.readFileSync(p1)), bytes: fs.statSync(p1).size },
    cardDownload: { name: dl2.suggestedFilename(), sha256: sha(fs.readFileSync(p2)), bytes: fs.statSync(p2).size },
    issuedCardText: text.slice(text.indexOf('ISSUED LETTERS'), text.indexOf('ISSUED LETTERS') + 200), net };
  fs.writeFileSync(w.OUT + '/web-issue-result.json', JSON.stringify(res, null, 2));
  console.log(JSON.stringify({ code: res.code, auto: res.autoDownload, card: res.cardDownload, issuedCardText: res.issuedCardText, net: net.map(n => `${n.method} ${n.path} ${n.status}`) }, null, 1));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
