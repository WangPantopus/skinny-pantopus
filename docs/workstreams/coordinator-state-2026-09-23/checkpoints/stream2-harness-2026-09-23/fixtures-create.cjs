// Harness-only: create disposable synthetic GoTrue users + public.User rows for R06 denial/admission cases.
// Random password stored only in extra-accounts.env (0600). Records exact ids for cleanup. Never bundled.
const { execFileSync } = require('node:child_process'); const crypto = require('node:crypto'); const fs = require('node:fs');
const h = require('./h.cjs');
const env = h.envFile('/private/tmp/pantopus-workstream-home/.stream2-verification/native/supabase.env');
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const sql = (s) => execFileSync('docker', ['exec', '-i', 'supabase_db_pantopus-stream2-native-r1', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: s, encoding: 'utf8' }).trim();
const USERS = { NONMEMBER: 'R06 Nonmember', REMOVED: 'R06 Removed', GUEST: 'R06 Guest', PENDING: 'R06 Pending' };
(async () => {
  if (fs.existsSync(__dirname + '/extra-accounts.env')) throw new Error('extra accounts already exist');
  const pw = crypto.randomBytes(12).toString('base64url') + 'a1!';
  const lines = [];
  for (const [key, name] of Object.entries(USERS)) {
    const email = `s2-r06-${key.toLowerCase()}@example.com`;
    const r = await fetch(`${env.API_URL}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw, email_confirm: true }) });
    const j = await r.json(); if (r.status !== 200 || !j.id) throw new Error('create failed ' + key + ' ' + r.status);
    sql(`INSERT INTO public."User"(id,email,username,name,role) VALUES(${q(j.id)},${q(email)},${q('s2r06' + key.toLowerCase())},${q(name)},'user');`);
    lines.push(`${key}_EMAIL=${email}`, `${key}_ID=${j.id}`);
    console.log('created', key, j.id);
  }
  fs.writeFileSync(__dirname + '/extra-accounts.env', lines.join('\n') + `\nPASSWORD=${pw}\n`, { mode: 0o600 });
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
