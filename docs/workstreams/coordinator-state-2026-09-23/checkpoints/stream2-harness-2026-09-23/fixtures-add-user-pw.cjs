// Harness-only: add one disposable synthetic user whose password comes from a private file (for a UI login).
const { execFileSync } = require('node:child_process'); const fs = require('node:fs'); const h = require('./h.cjs');
const env = h.envFile('/private/tmp/pantopus-workstream-home/.stream2-verification/native/supabase.env');
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const sql = (s) => execFileSync('docker', ['exec', '-i', 'supabase_db_pantopus-stream2-native-r1', 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: s, encoding: 'utf8' }).trim();
(async () => {
  const [key, name, pwFile] = process.argv.slice(2); const K = key.toUpperCase();
  const pw = fs.readFileSync(pwFile, 'utf8').trim();
  const email = `s2-r06-${key.toLowerCase()}@example.com`;
  const r = await fetch(`${env.API_URL}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw, email_confirm: true }) });
  const j = await r.json(); if (r.status !== 200 || !j.id) throw new Error('create failed ' + r.status);
  sql(`INSERT INTO public."User"(id,email,username,name,role) VALUES(${q(j.id)},${q(email)},${q('s2r06' + key.toLowerCase())},${q(name)},'user');`);
  fs.appendFileSync(__dirname + '/extra-accounts.env', `${K}_EMAIL=${email}\n${K}_ID=${j.id}\n${K}_PASSWORD=${pw}\n`);
  console.log('created', K, j.id, email);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
