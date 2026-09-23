// create-disposable.cjs: create the #271 disposable accounts in the owned local stack (never printed; private file 0600).
const fs = require('fs'); const crypto = require('crypto');
const root = '/private/tmp/pantopus-stream3-api';
const { createClient } = require(root + '/backend/node_modules/@supabase/supabase-js');
const config = JSON.parse(fs.readFileSync('/private/tmp/pantopus-stream3-20260920-r1/local-stack.json'));
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const OUT = '/private/tmp/pantopus-stream3-20260923-r1/disposable-fixtures.json';
(async () => {
  const tag = crypto.randomBytes(3).toString('hex');
  const out = [];
  for (const [key, name] of [['a', 'Del409 A'], ['b1', 'DelOK B1'], ['b2', 'DelOK B2']]) {
    const email = `stream3-del271-${key}-${tag}@example.com`;
    const password = crypto.randomBytes(18).toString('base64url') + 'Aa1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
    if (error) throw error;
    const user = data.user;
    const profile = { id: user.id, email, username: `stream3_del271_${key}_${tag}`, name, account_type: 'individual' };
    const ins = await admin.from('User').upsert(profile); if (ins.error) throw ins.error;
    out.push({ ...profile, password });
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(out.map((u) => ({ name: u.name, id: u.id.slice(0, 8), username: u.username }))));
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
