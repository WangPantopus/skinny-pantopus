// T41 fixtures for the native mail-detail trust check, for the iOS test member (rdios) and the lease resident
// (viewer, Android):
//  - a person letter from the owner through the real POST /api/mailbox/send, then a task made from it through the real
//    POST /api/mailbox/v2/p3/tasks/from-mail (the Task screen and its "Pulled from this mail" card);
//  - two letters inserted by SQL with no sender user (the sender card's business branch): one with a stored
//    sender_trust 'verified_utility', one with none. The send route can't make these (it always sets a sender user).
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim().split('\n')[0];
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const owner = await h.login('owner');
  for (const who of ['rdios', 'viewer']) {
    const u = await h.login(who);
    const r = await h.api('POST', '/api/mailbox/send', owner, { type: 'letter', subject: `Stream2 T41 task source (${who})`, content: 'Synthetic Stream2 letter a task is made from.',
      destination: { deliveryTargetType: 'user', homeId: HOME, userId: u.id, attnUserId: u.id, visibility: 'attn_only' } });
    const mailId = r.json && r.json.mail && r.json.mail.id;
    if (mailId) fs.appendFileSync(__dirname + '/work/t41-mail-ids.txt', mailId + '\n');
    const t = await h.api('POST', '/api/mailbox/v2/p3/tasks/from-mail', u, { mailId, homeId: HOME, title: `Stream2 T41 task (${who})`, priority: 'medium' });
    const taskId = t.json && t.json.task && t.json.task.id;
    if (taskId) fs.appendFileSync(__dirname + '/work/t41-task-ids.txt', taskId + '\n');
    console.log(`${who}: letter ${r.status} <${(mailId || '-').slice(0, 8)}>, task from it ${t.status} <${(taskId || '-').slice(0, 8)}> ${t.json && t.json.error ? JSON.stringify(t.json) : ''}`);
    for (const [trust, type, subj] of [["'verified_utility'", 'bill', 'utility bill, stored trust verified_utility'], ['null', 'letter', 'business letter, no stored trust']]) {
      const id = sql(`insert into "Mail" (recipient_user_id, sender_user_id, sender_business_name, sender_display, sender_trust, type, mail_type, subject, content, drawer, mail_object_type, lifecycle, delivery_target_type) values ('${u.id}', null, 'Stream2 T41 County Utility', 'Stream2 T41 County Utility', ${trust}, '${type}', '${type}', 'Stream2 T41 ${subj} (${who})', 'Synthetic Stream2 letter with no sender user.', 'personal', 'envelope', 'delivered', 'user') returning id`);
      fs.appendFileSync(__dirname + '/work/t41-mail-ids.txt', id + '\n');
      console.log(`${who}: SQL letter <${id.slice(0, 8)}> "${subj}"`);
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
