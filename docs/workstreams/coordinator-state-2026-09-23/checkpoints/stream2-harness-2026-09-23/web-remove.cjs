// R06 admission step: owner removes the synthetic member through the real web Members -> removal review UI.
const fs = require('node:fs'); const w = require('./web-lib.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const [targetUsername, tag] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'owner'); const page = await ctx.newPage();
  const net = []; page.on('response', (r) => { if (/member-removals|\/members/.test(r.url())) net.push(`${r.request().method()} ${r.url().replace(w.WEB, '')} ${r.status()}`); });
  await page.goto(`${w.WEB}/app/homes/${HOME}/members`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${w.OUT}/${tag}-a-members.png`, fullPage: true });
  await page.getByRole('button', { name: `Review removal of ${targetUsername}` }).click();
  await page.getByRole('button', { name: /^Review removal$/ }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Review removal$/ }).click();
  await page.getByRole('button', { name: /^Confirm removal$/ }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${w.OUT}/${tag}-b-review.png`, fullPage: true });
  await page.getByRole('button', { name: /^Confirm removal$/ }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${w.OUT}/${tag}-c-after-confirm.png`, fullPage: true });
  const text = await page.innerText('body');
  fs.writeFileSync(`${w.OUT}/${tag}.json`, JSON.stringify({ net, text: text.slice(0, 1500) }, null, 2));
  console.log(net.join('\n')); console.log(text.slice(0, 900));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
