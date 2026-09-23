// GET /api/gigs/:id per viewer (owner, assigned helper, signed-in stranger, anonymous) and per transport
// (Bearer as native sends it, the web session cookie through Next). Prints what location detail each gets
// and viewer_has_saved. Seeds one task (owner) assigned to the editor account, and the stranger saves it.
// Usage: node gig-detail-viewer-probe.cjs <label> [gigId]
const h = require('./h.cjs'); const w = require('./web-lib.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const [label, given] = process.argv.slice(2);
  const owner = await h.login('owner'); const helper = await h.login('editor'); const stranger = await h.login('rdnohome');
  let id = given;
  if (!id) {
    const r = await h.api('POST', '/api/gigs', owner, { title: `Stream2 RD viewer ${label}: fix a gate`, description: 'Synthetic Stream2 task for the viewer check.', price: 45,
      deadline: '2026-11-15T00:00:00.000Z', estimated_duration: 2, location: { mode: 'address', latitude: 45.6387, longitude: -122.6615, address: '100 Synthetic St, Vancouver, WA' } });
    id = r.json.gig.id; fs.appendFileSync(__dirname + '/work/t20-made-gig-ids.txt', id + '\n');
    sql(`update "Gig" set status='assigned', accepted_by='${helper.id}', accepted_at=now() where id='${id}'`);
    const s = await h.api('POST', `/api/gigs/${id}/save`, stranger); console.log(`seeded task ${id.slice(0, 8)} (assigned to the helper); stranger saves it: ${s.status}`);
  }
  console.log(`# ${label}`);
  const show = (g) => g ? `location=${g.location ? `${g.location.latitude},${g.location.longitude}` : 'none'} exact_address=${JSON.stringify(g.exact_address ?? null)} locationUnlocked=${g.locationUnlocked} viewer_has_saved=${g.viewer_has_saved}` : '-';
  for (const [who, sess] of [['owner', owner], ['helper', helper], ['stranger', stranger]]) {
    const r = await h.api('GET', `/api/gigs/${id}`, sess);
    console.log(`${who.padEnd(9)} Bearer  ${r.status} ${show(r.json && r.json.gig)}`);
  }
  const b = await w.browser();
  for (const who of ['owner', 'editor', 'rdnohome', null]) {
    const ctx = await b.newContext({ userAgent: 'stream2-r06-web-chrome' });
    if (who) {
      const c = h.creds(who);
      const lr = await ctx.request.post(w.WEB + '/api/users/login', { headers: { 'x-token-transport': 'cookie', 'content-type': 'application/json' }, data: { email: c.email, password: c.password } });
      if (lr.status() !== 200) throw new Error('web login failed ' + who);
    }
    const r = await ctx.request.get(`${w.WEB}/api/gigs/${id}`);
    let j = null; try { j = await r.json(); } catch (_) {}
    const name = { owner: 'owner', editor: 'helper', rdnohome: 'stranger' }[who] || 'anonymous';
    console.log(`${name.padEnd(9)} cookie  ${r.status()} ${show(j && j.gig)}`);
    await ctx.close();
  }
  await b.close();
  if (!given) console.log(`task id: ${id}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
