// T36: POST /api/mailbox/v2/p3/translate on this branch: every signed-in call answers 501 and writes nothing; a row
// that already holds a cached mock translation is not served. Usage: node t36-translate-probe.cjs <label>
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const [label] = process.argv.slice(2);
  const owner = await h.login('owner');
  const ids = fs.readFileSync(__dirname + '/work/t36-mail-ids.txt', 'utf8').split('\n').filter(Boolean);
  const snap = () => ids.map((id) => sql(`select left(id::text,8) || ' translation_text=' || coalesce('"' || left(translation_text, 40) || '..."', 'null') || ' translation_lang=' || coalesce(translation_lang,'null') from "Mail" where id='${id}'`)).join('\n    ');
  console.log(`# ${label} (${new Date().toISOString()})\n  stored before:\n    ${snap()}`);
  for (const id of ids.slice(0, 3)) {
    const r = await h.api('POST', '/api/mailbox/v2/p3/translate', owner, { mailId: id });
    const r2 = await h.api('POST', '/api/mailbox/v2/p3/translate', owner, { mailId: id, targetLang: 'es' });
    console.log(`  <${id.slice(0, 8)}> translate -> ${r.status} ${JSON.stringify(r.json)}; targetLang es -> ${r2.status}`);
  }
  const bad = await h.api('POST', '/api/mailbox/v2/p3/translate', owner, { nope: 1 });
  const anon = await h.api('POST', '/api/mailbox/v2/p3/translate', null, { mailId: ids[0] });
  console.log(`  invalid body -> ${bad.status}; no session -> ${anon.status}`);
  console.log(`  stored after:\n    ${snap()}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
