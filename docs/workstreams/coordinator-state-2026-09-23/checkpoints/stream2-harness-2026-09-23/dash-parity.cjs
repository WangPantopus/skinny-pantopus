// The Home dashboard's gated fields for the same accounts, for parity with the hub card.
const { login, api } = require('./h.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  console.log(`# Home dashboard parity ${new Date().toISOString()}`);
  for (const w of (process.argv[2] || 'owner,viewer,bannerpending').split(',')) {
    const s = await login(w);
    const d = await api('GET', `/api/homes/${HOME}/dashboard`, s);
    const j = d.json || {};
    console.log(`${w}: dashboard ${d.status} ` + (d.status === 200
      ? `next_bill=${j.today?.next_bill ? 'present' : 'null'} bills_due=${j.counts?.bills_due} members_active=${j.counts?.members_active} unread_mail=${j.today?.unread_mail_count} perms(finance.view=${j.myAccess?.permissions?.includes('finance.view')}, mailbox.view=${j.myAccess?.permissions?.includes('mailbox.view')}, members.view=${j.myAccess?.permissions?.includes('members.view')})`
      : JSON.stringify(j)));
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
