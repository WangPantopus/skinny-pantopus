const h = require('./h.cjs');
(async () => {
  for (const who of ['owner', 'viewer', 'editor', 'rdmember']) {
    const s = await h.login(who);
    const p = await h.api('GET', '/api/mailbox?scope=personal', s);
    const hm = await h.api('GET', '/api/mailbox?scope=all', s);
    const d = await h.api('GET', '/api/mailbox/v2/drawer/personal', s);
    const dh = await h.api('GET', '/api/mailbox/v2/drawer/home', s);
    const vf = await h.api('GET', '/api/mailbox/v2/p2/vault/folders', s);
    const it = (d.json?.mail || d.json?.items || []);
    console.log(who, 'v1 personal', p.status, (p.json?.mail || []).length, 'all', (hm.json?.mail || []).length,
      '| v2 personal', d.status, it.length, 'unopened', it.filter(x => !x.opened_at).length,
      '| v2 home', dh.status, (dh.json?.mail || dh.json?.items || []).length,
      '| vault folders', vf.status, JSON.stringify(vf.json)?.slice(0, 200));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
