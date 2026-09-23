// Fan-out and "Create Task" repair checks: send-time document/package/task fan-outs, fanoutFailed in the
// send response, and POST /api/mailbox/v2/p3/tasks/from-mail on household and attn_only letters.
// Usage: node fanout-fix-probe.cjs <tag>
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const tag = process.argv[2] || 'run';
  const owner = await h.login('owner'); const viewer = await h.login('viewer'); const editor = await h.login('editor');
  const keep = (id) => id && fs.appendFileSync(__dirname + '/work/t10-made-mail-ids.txt', id + '\n');
  const send = async (label, body) => {
    const r = await h.api('POST', '/api/mailbox/send', owner, body);
    const id = r.json && r.json.mail && r.json.mail.id; keep(id);
    const links = id ? sql(`select coalesce(string_agg(target_type, ',' order by target_type), 'none') from "MailLink" where mail_item_id = '${id}'`) : '-';
    console.log(`${label.padEnd(44)} send ${r.status} links=${links} fanoutFailed=${JSON.stringify(r.json && r.json.fanoutFailed)}`);
    return id;
  };
  const home = { deliveryTargetType: 'home', homeId: HOME };
  console.log(`# ${tag}: send-time fan-outs (owner)`);
  await send('document letter to the Home', { destination: home, envelope: { type: 'document', subject: `Stream2 RD fanfix ${tag} document` }, content: 'Synthetic document.' });
  await send('package letter to the Home', { destination: home, envelope: { type: 'package', subject: `Stream2 RD fanfix ${tag} package` }, content: 'Synthetic package.' });
  await send('letter with create_task to the Home', { destination: home, envelope: { type: 'letter', subject: `Stream2 RD fanfix ${tag} task` },
    content: 'Synthetic task letter.', object: { format: 'plain_text', content: 'Synthetic task letter.', payload: { outcomes: ['create_task'] } } });
  await send('person letter to viewer with create_task', { destination: { deliveryTargetType: 'user', homeId: HOME, userId: viewer.id, attnUserId: viewer.id, visibility: 'attn_only' },
    envelope: { type: 'letter', subject: `Stream2 RD fanfix ${tag} person task` },
    content: 'Synthetic person task letter.', object: { format: 'plain_text', content: 'Synthetic.', payload: { outcomes: ['create_task'] } } });
  console.log(`# ${tag}: "Create Task" on a received letter (POST /api/mailbox/v2/p3/tasks/from-mail)`);
  const hl = await send('household letter (for Create Task)', { destination: home, envelope: { type: 'letter', subject: `Stream2 RD fanfix ${tag} fromMail household` }, content: 'Synthetic.' });
  const al = await send('attn_only letter for viewer (for Create Task)', { destination: { ...home, attnUserId: viewer.id, visibility: 'attn_only' },
    envelope: { type: 'letter', subject: `Stream2 RD fanfix ${tag} fromMail attn` }, content: 'Synthetic.' });
  for (const [who, sess, id, what] of [['viewer', viewer, hl, 'household'], ['editor', editor, hl, 'household'], ['viewer', viewer, al, 'attn_only for viewer'], ['editor', editor, al, 'attn_only for viewer']]) {
    const r = await h.api('POST', '/api/mailbox/v2/p3/tasks/from-mail', sess, { mailId: id, homeId: HOME, title: `Stream2 RD task ${tag} ${who}`, priority: 'medium' });
    console.log(`${who} creates a task from the ${what} letter: ${r.status} ${r.status === 200 ? 'task=' + String(r.json.task && r.json.task.id).slice(0, 8) : JSON.stringify(r.json).slice(0, 110)}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
