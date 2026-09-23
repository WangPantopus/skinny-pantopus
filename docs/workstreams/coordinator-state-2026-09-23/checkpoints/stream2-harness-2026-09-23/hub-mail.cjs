// Hub mail counts for the owner and the lease resident (viewer). Prints no tokens.
const { login, api } = require('./h.cjs');
(async () => {
  const label = process.argv[2] || 'run';
  console.log(`# hub mail counts (${label}) ${new Date().toISOString()}`);
  for (const w of ['owner', 'viewer']) {
    const s = await login(w);
    const r = await api('GET', '/api/hub', s);
    const j = r.json || {};
    const d = await api('GET', '/api/homes/f0e51100-0000-4000-8000-000000000200/dashboard', s);
    const mb = await api('GET', '/api/mailbox?scope=personal&limit=5', s);
    console.log(w, JSON.stringify({ hub: r.status, mailItems: (j.statusItems || []).filter(i => /mail|inbox|offer/.test(i.id)).map(i => `${i.id}:${i.title}`), homeCardNewMail: j.cards?.home?.newMail ?? null, dashboardUnreadHomeMail: d.json?.today?.unread_mail_count ?? d.status, mailboxPersonalUnread: mb.json?.summary?.unread_count }));
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
