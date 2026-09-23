// Task 3 (mail_extracted compatibility retry): an attn_only Home letter whose attention user does not exist
// (a member list that went stale after an account deletion) versus the same letter to a real member.
// Usage: node compat-retry-probe.cjs <tag>   -> prints the send results and the viewer's Home drawer visibility.
const h = require('./h.cjs');
const { randomUUID } = require('node:crypto');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
(async () => {
  const tag = process.argv[2] || 'run';
  const owner = await h.login('owner');
  const viewer = await h.login('viewer');
  const editor = await h.login('editor');
  const missing = randomUUID();
  const send = async (label, attnUserId) => {
    const r = await h.api('POST', '/api/mailbox/send', owner, {
      destination: { deliveryTargetType: 'home', homeId: HOME, attnUserId, visibility: 'attn_only' },
      envelope: { type: 'letter', subject: `Stream2 RD compat ${tag} ${label}` },
      content: `Synthetic attn_only letter (${label}) for the compatibility-retry check.`,
    });
    const m = (r.json && (r.json.mail || r.json.data)) || {};
    console.log(`send ${label}: HTTP ${r.status} ${r.json && r.json.error ? JSON.stringify(r.json.error) : ''} id=${m.id || '-'}`);
    return m.id || null;
  };
  console.log(`# ${tag}: owner sends attn_only Home letters (missing attention user ${missing.slice(0, 8)})`);
  const ghostId = await send('missing-attn', missing);
  const realId = await send('viewer-attn', viewer.id);
  for (const [who, sess] of [['viewer', viewer], ['editor', editor]]) {
    const r = await h.api('GET', '/api/mailbox/v2/drawer/home?tab=incoming&limit=50', sess);
    const items = (r.json && (r.json.items || r.json.mail || r.json.data)) || [];
    const ids = new Set(items.map((i) => i.id));
    console.log(`${who} Home drawer (HTTP ${r.status}): missing-attn letter ${ghostId && ids.has(ghostId) ? 'VISIBLE' : 'not visible'}; viewer-attn letter ${realId && ids.has(realId) ? 'VISIBLE' : 'not visible'}`);
  }
  console.log(`ids ${ghostId || '-'} ${realId || '-'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
