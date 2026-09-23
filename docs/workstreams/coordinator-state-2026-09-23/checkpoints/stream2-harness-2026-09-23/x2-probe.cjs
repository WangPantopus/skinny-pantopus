// PR X second pass: POST /v2/resolve, /p2/party/create, /p2/party/assign and /mailday/items(+route)
// for an outsider (no Home) and for the addressee/household. Prints statuses only; no tokens.
const { login, api, creds } = require('./h.cjs'); const fs = require('fs'); const crypto = require('crypto');
const W = __dirname + '/work/';
const ids = Object.fromEntries(fs.readFileSync(W + 'x2-fixture-ids.txt', 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const V2 = '/api/mailbox/v2';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const short = (s) => String(s).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (x) => '<' + x.slice(0, 8) + '>');
const cell = (r) => `${r.status}${r.status >= 400 && r.json?.error ? ' ' + r.json.error : ''}`;
async function call(sess, m, path, body, note) {
  const r = await api(m, path, sess, body); await sleep(2500);
  console.log(`${sess.who} ${m} ${short(path)}${note ? ' ' + note : ''} | ${cell(r)}`); return r;
}
(async () => {
  const [mode, set] = process.argv.slice(2);
  console.log(`# PR X second-pass probe (${mode}${set ? ' ' + set : ''}) ${new Date().toISOString()}`);
  if (mode === 'outsider') {
    const o = await login('m01outsider'); const oid = creds('m01outsider').id;
    await call(o, 'POST', `${V2}/resolve`, { mailId: ids[set + '_resolve'], drawer: 'personal' }, '(outsider claims the viewer\'s letter)');
    await call(o, 'POST', `${V2}/p2/party/assign`, { sessionId: crypto.randomUUID(), mailId: ids[set + '_assign'], assignToUserId: oid }, '(outsider assigns the viewer\'s letter to self)');
    const pc = await call(o, 'POST', `${V2}/p2/party/create`, { mailId: ids[set + '_party'] }, '(outsider opens a party on household mail)');
    if (pc.json?.session?.id) fs.appendFileSync(W + 'x2-created-sessions.txt', pc.json.session.id + '\n');
    const it = await call(o, 'POST', `${V2}/mailday/items`, { kind: 'envelope', label: 'Stream2 X2 probe', mail_id: ids[set + '_mday'] }, '(outsider links the viewer\'s letter to a triage piece)');
    const itemId = it.json?.item?.id;
    if (itemId) {
      fs.appendFileSync(W + 'x2-created-maildayitems.txt', itemId + '\n');
      await call(o, 'POST', `${V2}/mailday/items/${itemId}/route`, { drawer: 'personal' }, '(outsider routes it to their personal drawer)');
    }
    for (const k of ['resolve', 'assign', 'mday']) await call(o, 'GET', `${V2}/item/${ids[set + '_' + k]}`, undefined, `(outsider reads the ${k} letter afterwards)`);
  } else if (mode === 'members') {
    const v = await login('viewer'); const e = await login('editor'); const vid = creds('viewer').id;
    await call(v, 'POST', `${V2}/resolve`, { mailId: ids.xm_resolve_v, drawer: 'personal' }, '(addressee resolves own letter)');
    await call(e, 'POST', `${V2}/resolve`, { mailId: ids.xm_resolve_e, drawer: 'home' }, '(household member resolves household notice)');
    const pc = await call(e, 'POST', `${V2}/p2/party/create`, { mailId: ids.xm_party }, '(household member opens a party on household mail)');
    const sid = pc.json?.session?.id; if (sid) fs.appendFileSync(W + 'x2-created-sessions.txt', sid + '\n');
    await call(e, 'POST', `${V2}/p2/party/assign`, { sessionId: sid || crypto.randomUUID(), mailId: ids.xm_assign, assignToUserId: vid }, '(household member assigns household notice to the viewer)');
    const it = await call(v, 'POST', `${V2}/mailday/items`, { kind: 'envelope', label: 'Stream2 X2 member probe', mail_id: ids.xm_mday }, '(addressee links own letter to a triage piece)');
    const itemId = it.json?.item?.id;
    if (itemId) {
      fs.appendFileSync(W + 'x2-created-maildayitems.txt', itemId + '\n');
      await call(v, 'POST', `${V2}/mailday/items/${itemId}/route`, { drawer: 'personal' }, '(addressee routes it to personal)');
    }
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
