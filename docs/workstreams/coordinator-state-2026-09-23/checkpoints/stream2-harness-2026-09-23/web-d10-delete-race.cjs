// D10: a delete refused after the page loaded (another household action adds a linked map pin between load and
// click). Records the server status and what each web delete control shows. Prints no tokens.
const w = require('./web-lib.cjs'); const h = require('./h.cjs'); const fs = require('fs');
const HOME = fs.readFileSync(__dirname + '/work/d10-race-home-id.txt', 'utf8').trim();
async function addPin() {
  const s = await h.login('d10owner');
  const r = await h.api('POST', '/api/mailbox/v2/p3/map/pin', s, { homeId: HOME, pinType: 'notice', title: 'Stream2 D10 race pin', lat: 45.6, lng: -122.6, visibleTo: 'household' });
  return r.json?.pin?.id;
}
async function removePin(id) { const s = await h.login('d10owner'); await h.api('DELETE', `/api/mailbox/v2/p3/map/pin/${id}`, s); }
(async () => {
  const [shotPrefix] = process.argv.slice(2);
  const b = await w.browser(); const ctx = await w.signedInContext(b, 'd10owner'); const page = await ctx.newPage();
  const calls = [];
  page.on('response', async (r) => { if (r.request().method() === 'DELETE' && r.url().includes(`/api/homes/${HOME}`)) calls.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 160)}`); });
  // 1) My Homes list
  await page.goto(w.WEB + '/app/homes', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);
  let pin = await addPin();
  await page.getByRole('button', { name: 'Delete home' }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${w.OUT}/${shotPrefix}-a-myhomes-refused.png`, fullPage: false });
  const listText = await page.innerText('body');
  const listToast = (listText.match(/(Failed[^\n]*|This home has[^\n]*|linked records[^\n]*)/) || [null])[0];
  await removePin(pin);
  // 2) Home settings tab
  await page.goto(w.WEB + `/app/homes/${HOME}/dashboard?tab=settings`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  pin = await addPin();
  await page.getByRole('button', { name: 'Delete Home' }).first().click();
  await page.waitForTimeout(400);
  const steps = page.locator('button', { hasText: /Continue|Yes|I understand|Next/ });
  if (await steps.count()) { await steps.first().click(); await page.waitForTimeout(300); }
  await page.getByPlaceholder('DELETE').fill('DELETE');
  const nextBtn = page.locator('button:not([disabled])', { hasText: /Continue|Next|Confirm/ });
  if (await nextBtn.count()) { await nextBtn.first().click(); await page.waitForTimeout(300); }
  await page.getByRole('button', { name: /Permanently Delete Home/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${w.OUT}/${shotPrefix}-b-settings-refused.png`, fullPage: true });
  const setText = await page.innerText('body');
  const setMsg = (setText.match(/(Failed to delete home[^\n]*|This home has[^\n]*|linked records[^\n]*)/) || [null])[0];
  await removePin(pin);
  console.log(JSON.stringify({ deleteResponses: calls, myHomesToast: listToast, settingsMessage: setMsg }));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
