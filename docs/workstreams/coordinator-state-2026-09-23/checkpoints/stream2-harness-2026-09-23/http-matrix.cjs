// R06 HTTP/SQL matrix against the real routes/service/SQL (through the logging proxy). Letter ids come from argv.
const fs = require('node:fs'); const h = require('./h.cjs'); const HOME = 'f0e51100-0000-4000-8000-000000000200';
const L = (p) => `/api/homes/${HOME}/residency-letters${p || ''}`;
(async () => {
  const [editorLetter, tag] = process.argv.slice(2);
  const rows = []; const rec = (actor, action, r, extra = {}) => { const j = r.json || {}; rows.push({ actor, action, status: r.status, error: j.error || null, code: j.code || null, letters: Array.isArray(j.letters) ? j.letters.map((x) => `${x.id.slice(0, 8)}:${x.status}`) : undefined, letter: j.letter ? `${j.letter.id.slice(0, 8)}:${j.letter.status}` : undefined, ...extra }); };
  // Unauthenticated
  rec('anonymous', 'list', await h.api('GET', L(), null));
  rec('anonymous', 'issue', await h.api('POST', L(), null, { purpose: 'anon' }));
  rec('anonymous', 'pdf(editor letter)', await h.api('GET', L(`/${editorLetter}/pdf`), null, undefined, { raw: true }));
  rec('anonymous', 'revoke(editor letter)', await h.api('POST', L(`/${editorLetter}/revoke`), null));
  for (const who of ['nonmember', 'pending', 'viewer', 'owner', 'guest', 'removed']) {
    const s = await h.login(who);
    rec(who, 'list', await h.api('GET', L(), s));
    const pdf = await h.api('GET', L(`/${editorLetter}/pdf`), s, undefined, { raw: true });
    rec(who, 'pdf(editor letter)', pdf, { contentType: pdf.contentType });
    rec(who, 'revoke(editor letter)', await h.api('POST', L(`/${editorLetter}/revoke`), s));
  }
  // Issue attempts by roles that should not/should be able to issue
  for (const who of ['nonmember', 'pending']) { const s = await h.login(who); rec(who, 'issue', await h.api('POST', L(), s, { purpose: `R06 ${who} attempt` })); }
  fs.writeFileSync(`${__dirname}/work/${tag}.json`, JSON.stringify(rows, null, 2));
  for (const r of rows) console.log(`${r.actor.padEnd(10)} ${r.action.padEnd(22)} ${r.status} ${r.code || ''} ${r.error || ''} ${r.letters ? JSON.stringify(r.letters) : ''}${r.letter || ''}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
