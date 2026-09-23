// #243 privacy check: can a Home letter in the Business drawer be attn_only for one member, and who sees it?
// Real paths: v1 send (owner, stationery, attn viewer, attn_only) → the viewer resolves it to the Business drawer.
const { login, api } = require('./h.cjs'); const fs = require('fs'); const { execFileSync } = require('child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const o = await login('owner'), v = await login('viewer'), e = await login('editor'), n = await login('rdnohome');
  const send = await api('POST', '/api/mailbox/send', o, { destination: { deliveryTargetType: 'home', homeId: 'f0e51100-0000-4000-8000-000000000200', attnUserId: '20bd1f37-7f90-49a4-8445-47eb5acb395d', attnLabel: 'Stream2 Viewer', visibility: 'attn_only' },
    type: 'letter', subject: 'Stream2 RD attn-only letter routed to Business', content: 'Synthetic', object: { format: 'mailjson_v1', payload: { stationeryTheme: 'classic_cream' } } });
  const id = send.json?.mail?.id; fs.appendFileSync(__dirname + '/work/rd-sent-mail-ids.txt', id + '\n');
  console.log(`# owner v1 send (Home, attn viewer, attn_only, stationery): ${send.status} <${id.slice(0, 8)}>`);
  const res = await api('POST', '/api/mailbox/v2/resolve', v, { mailId: id, drawer: 'business' });
  console.log(`viewer POST /v2/resolve {drawer:'business'}: ${res.status}`);
  sql(`update "Mail" set due_date = current_date + 5 where id = '${id}'`);
  console.log('stored: ' + sql(`select json_build_object('drawer', drawer, 'privacy', privacy, 'recipient_user_id_set', recipient_user_id is not null, 'attn_is_viewer', attn_user_id = '20bd1f37-7f90-49a4-8445-47eb5acb395d', 'delivery_visibility', delivery_visibility, 'due_date_set', due_date is not null) from "Mail" where id = '${id}'`) + '  (due_date set by SQL for the Counter check)');
  for (const [who, s] of [['owner', o], ['viewer', v], ['editor', e], ['no-Home user', n]]) {
    const inc = await api('GET', '/api/mailbox/v2/drawer/business?tab=incoming&limit=100', s);
    const cnt = await api('GET', '/api/mailbox/v2/drawer/business?tab=counter&limit=100', s);
    const it = await api('GET', `/api/mailbox/v2/item/${id}`, s);
    const v1 = await api('GET', `/api/mailbox/${id}`, s);
    const has = (r) => (r.json?.mail || []).some(m => m.id === id) ? 'listed' : 'not listed';
    console.log(`${who.padEnd(13)} business incoming ${inc.status} ${has(inc)} | business counter ${cnt.status} ${has(cnt)} | v2 item ${it.status} | v1 item ${v1.status}`);
  }
  // v2 item marked it opened for the members who could open it; restore the probe letter's unread state.
  sql(`update "Mail" set viewed = false, viewed_at = null, opened_at = null, lifecycle = 'delivered' where id = '${id}'`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
