// R06: household shortens an admitted guest's access (real role/end_at route) after the guest issued a letter.
const fs = require('node:fs'); const h = require('./h.cjs'); const HOME = 'f0e51100-0000-4000-8000-000000000200';
const out = []; const log = (k, v) => { out.push({ at: new Date().toISOString(), k, v }); console.log(k, JSON.stringify(v)); };
(async () => {
  const [who, code, tag] = process.argv.slice(2);
  const owner = await h.login('owner'); const u = await h.login(who);
  log('public-before', (await h.api('GET', `/api/public/residency-letters/${code}`, null)).json);
  const end = new Date(Date.now() + 60 * 1000).toISOString();
  const r = await h.api('POST', `/api/homes/${HOME}/members/${u.id}/role`, owner, { role_base: 'guest', end_at: end });
  log('owner-sets-end', { status: r.status, body: r.json, end_at: end });
  await new Promise((res) => setTimeout(res, Date.parse(end) - Date.now() + 10000));
  log('guest-list-after-end', { status: (await h.api('GET', `/api/homes/${HOME}/residency-letters`, u)).status });
  log('public-after-end', (await h.api('GET', `/api/public/residency-letters/${code}`, null)).json);
  fs.writeFileSync(`${__dirname}/work/${tag}.json`, JSON.stringify(out, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
