const h = require('./h.cjs');
(async () => {
  for (const who of ['owner', 'viewer']) {
    const s = await h.login(who);
    for (const dr of ['personal', 'home']) {
      const d = await h.api('GET', '/api/mailbox/v2/drawer/' + dr, s);
      for (const x of (d.json?.mail || d.json?.items || [])) console.log(who, dr, x.id, JSON.stringify({ subj: x.subject || x.display_title, opened: x.opened_at, rec: x.recipient_user_id ? 'user' : null, home: x.recipient_home_id ? 'home' : null, type: x.type, mot: x.mail_object_type, created: x.created_at }));
    }
    const v1 = await h.api('GET', '/api/mailbox?scope=personal', s);
    for (const x of (v1.json?.mail || [])) console.log(who, 'v1', x.id, x.subject, x.viewed, x.starred, x.archived);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
