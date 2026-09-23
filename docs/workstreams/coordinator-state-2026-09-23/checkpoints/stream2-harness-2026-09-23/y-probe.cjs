// PR Y (M01 a) probe: for one synthetic letter of each kind, which of owner / viewer (attn member, addressee) /
// editor (another member) / outsider sees it in each list, item and badge. Statuses and letter keys only.
const { login, api } = require('./h.cjs'); const fs = require('fs');
const W = __dirname + '/work/';
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const L = Object.fromEntries(fs.readFileSync(W + 'y-fixture-ids.txt', 'utf8').split('\n').filter(Boolean).map(l => l.split('=')));
const KEYS = ['y_shared', 'y_v1_noattn', 'y_attn_members', 'y_attn_only', 'y_attn_admins', 'y_private'];
const byId = Object.fromEntries(Object.entries(L).map(([k, v]) => [v, k]));
const WHO = ['owner', 'viewer', 'editor', 'm01outsider'];
const mark = (ids) => KEYS.map(k => (ids.has(L[k]) ? 'Y' : '.')).join(' ');
(async () => {
  const [phase, label] = process.argv.slice(2);
  const s = {}; for (const w of WHO) s[w] = await login(w);
  console.log(`# PR Y probe: ${phase} (${label}) ${new Date().toISOString()}`);
  console.log(`# letter order: ${KEYS.join(' ')}   (Y = present, . = absent)`);
  if (phase === 'reads') {
    for (const w of WHO) {
      const out = [];
      const home = await api('GET', `/api/mailbox?scope=home&homeId=${HOME}&limit=200`, s[w]);
      out.push(`v1 list scope=home  ${home.status === 200 ? mark(new Set((home.json.mail || []).map(m => m.id))) + `  (summary unread ${home.json.summary?.unread_count})` : home.status + ' ' + (home.json?.error || '')}`);
      const all = await api('GET', `/api/mailbox?scope=all&limit=200`, s[w]);
      out.push(`v1 list scope=all   ${all.status === 200 ? mark(new Set((all.json.mail || []).map(m => m.id))) : all.status}`);
      const dr = await api('GET', `/api/mailbox/v2/drawer/home?tab=incoming&limit=200`, s[w]);
      out.push(`v2 Home drawer      ${dr.status === 200 ? mark(new Set((dr.json.mail || []).map(m => m.id))) + `  (total ${dr.json.total})` : dr.status}`);
      const drs = await api('GET', `/api/mailbox/v2/drawers`, s[w]);
      const homeDrawer = (drs.json?.drawers || []).find(d => d.drawer === 'home');
      out.push(`v2 drawers home unread_count ${drs.status === 200 ? homeDrawer?.unread_count : drs.status}`);
      const pend = await api('GET', `/api/mailbox/v2/pending`, s[w]);
      out.push(`v2 pending          ${pend.status === 200 ? mark(new Set((pend.json.pending || []).map(p => p.mail_id))) : pend.status}`);
      const md = await api('GET', `/api/mailbox/v2/mailday/today`, s[w]);
      out.push(`Mail Day today      ${md.status === 200 ? md.status + ' unreviewed ' + (md.json.unreviewed || []).length : md.status}`);
      const items = [];
      for (const k of KEYS) { const r = await api('GET', `/api/mailbox/${L[k]}`, s[w]); items.push(r.status); }
      out.push(`v1 item GET /api/mailbox/:id  ${items.join(' ')}`);
      const dash = await api('GET', `/api/homes/${HOME}/dashboard`, s[w]);
      out.push(`badge (dashboard today.unread_mail_count) ${dash.status === 200 ? dash.json.today?.unread_mail_count : dash.status + ' ' + (dash.json?.error || dash.json?.code || '')}`);
      console.log(`\n## ${w}\n` + out.join('\n'));
    }
  } else if (phase === 'v2items') {
    for (const w of WHO) {
      const items = [];
      for (const k of KEYS) { const r = await api('GET', `/api/mailbox/v2/item/${L[k]}`, s[w]); items.push(r.status); }
      console.log(`${w.padEnd(12)} v2 item GET /v2/item/:id  ${items.join(' ')}`);
    }
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
