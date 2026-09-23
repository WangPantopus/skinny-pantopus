// party/join follow-up probe: a household member opens a party session on household mail, then an outsider
// (no Home) and the other household member try to join it. Statuses only; no tokens.
const { login, api } = require('./h.cjs'); const fs = require('fs');
const W = __dirname + '/work/';
const ids = Object.fromEntries(fs.readFileSync(W + 'x2-fixture-ids.txt', 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const P2 = '/api/mailbox/v2/p2';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const cell = (r) => `${r.status}${r.status >= 400 && r.json?.error ? ' ' + r.json.error : ''}`;
(async () => {
  const label = process.argv[2] || 'run';
  console.log(`# /p2/party/join probe (${label}) ${new Date().toISOString()}`);
  const e = await login('editor'), o = await login('m01outsider'), v = await login('viewer');
  const pc = await api('POST', `${P2}/party/create`, e, { mailId: ids.xm_resolve_e }); await sleep(1500);
  const sid = pc.json?.session?.id;
  console.log(`editor POST /party/create (household notice) | ${cell(pc)} session=${sid ? '<' + sid.slice(0, 8) + '>' : '-'}`);
  if (!sid) return;
  fs.appendFileSync(W + 'x2-created-sessions.txt', sid + '\n');
  const oj = await api('POST', `${P2}/party/join`, o, { sessionId: sid }); await sleep(1500);
  console.log(`m01outsider POST /party/join (another household's session) | ${cell(oj)}${oj.json?.session ? ' returned session.mail_id=<' + String(oj.json.session.mail_id).slice(0, 8) + '> home_id=<' + String(oj.json.session.home_id).slice(0, 8) + '>' : ''}`);
  const vj = await api('POST', `${P2}/party/join`, v, { sessionId: sid }); await sleep(1500);
  console.log(`viewer POST /party/join (own household's session) | ${cell(vj)}`);
  const act = await api('GET', `${P2}/party/active`, v);
  console.log(`viewer GET /party/active | ${cell(act)} sessions=${(act.json?.sessions || []).length}`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
