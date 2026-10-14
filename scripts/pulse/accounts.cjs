#!/usr/bin/env node
// Synthetic accounts for a Pulse stream's isolated runtime (scripts/pulse/stream-runtime.sh). Local only.
// Accounts are real Supabase Auth users plus a public."User" row, so the backend and the apps accept them.
// Passwords are random and live only in a private file (mode 600) beside the runtime; tokens are printed
// on demand and never stored. Nothing here touches a hosted database: the API URL comes from the stream's
// own local stack.
//
//   node scripts/pulse/accounts.cjs create  <stream> <name> [<name> ...]   e.g. create pb alice bob
//   node scripts/pulse/accounts.cjs token   <stream> <name>                 prints a fresh access token
//   node scripts/pulse/accounts.cjs login   <stream> <name>                 prints "email<TAB>password" for typing into an app's sign-in form
//   node scripts/pulse/accounts.cjs list    <stream>
//   node scripts/pulse/accounts.cjs sql     <stream> "<query>"              runs SQL in the stream's database
//   node scripts/pulse/accounts.cjs cleanup <stream>                        removes the accounts (their posts and replies cascade)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const BASES = { pb: 55000, pi: 56000, pa: 57000, ps: 58000, pc: 59000, pv: 60000 };
const [cmd, stream, ...rest] = process.argv.slice(2);
if (!BASES[stream]) { console.error('usage: accounts.cjs create|token|login|list|sql|cleanup <pb|pi|pa|ps|pc|pv> …'); process.exit(2); }

const rt = path.join(process.env.PULSE_RUNTIME_ROOT || path.join(os.homedir(), '.config', 'pantopus'), `pulse-${stream}-runtime`);
const stateFile = path.join(rt, 'accounts.json');
const container = `supabase_db_pantopus-pulse-${stream}`;

function stackEnv() {
  const out = execFileSync('supabase', ['status', '--workdir', rt, '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const get = key => (out.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, 'm')) || [])[1];
  const env = { api: get('API_URL'), anon: get('ANON_KEY'), service: get('SERVICE_ROLE_KEY') };
  if (!env.api || !env.anon || !env.service) throw new Error(`stack for "${stream}" is not running (scripts/pulse/stream-runtime.sh start ${stream})`);
  return env;
}
const q = v => `'${String(v).replaceAll("'", "''")}'`;
function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8' }).trim();
}
const readState = () => (fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { accounts: {} });
const writeState = s => { fs.mkdirSync(rt, { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s, null, 2), { mode: 0o600 }); };

async function signIn(env, email, password) {
  const res = await fetch(`${env.api}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'content-type': 'application/json', apikey: env.anon }, body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed for ${email}: HTTP ${res.status}`);
  return (await res.json()).access_token;
}

async function create(names) {
  const env = stackEnv(); const state = readState();
  for (const name of names) {
    if (!/^[a-z][a-z0-9]{0,15}$/.test(name)) throw new Error(`bad name "${name}" (lowercase letters and digits)`);
    if (state.accounts[name]) { console.log(`${name}: exists`); continue; }
    const tag = crypto.randomBytes(3).toString('hex');
    const email = `pulse-${stream}-${name}-${tag}@example.invalid`;
    const password = `Pw-${crypto.randomBytes(9).toString('base64url')}`;
    const res = await fetch(`${env.api}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: env.service, authorization: `Bearer ${env.service}` },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`create ${name}: HTTP ${res.status} ${body.msg || body.message || ''}`);
    const display = name[0].toUpperCase() + name.slice(1);
    sql(`INSERT INTO public."User"(id,email,username,name,first_name,role)
         VALUES(${q(body.id)},${q(email)},${q(`pulse_${stream}_${name}_${tag}`)},${q(display)},${q(display)},'user');`);
    state.accounts[name] = { id: body.id, email, password };
    writeState(state);
    console.log(`${name}: created (${body.id})`);
  }
}

(async () => {
  if (cmd === 'create') { if (!rest.length) throw new Error('give at least one name'); await create(rest); }
  else if (cmd === 'token') { const a = readState().accounts[rest[0]]; if (!a) throw new Error(`no account "${rest[0]}"`); process.stdout.write(`${await signIn(stackEnv(), a.email, a.password)}\n`); }
  else if (cmd === 'login') { const a = readState().accounts[rest[0]]; if (!a) throw new Error(`no account "${rest[0]}"`); process.stdout.write(`${a.email}\t${a.password}\n`); }
  else if (cmd === 'list') { for (const [n, a] of Object.entries(readState().accounts)) console.log(`${n}\t${a.id}\t${a.email}`); }
  else if (cmd === 'sql') { console.log(sql(rest.join(' '))); }
  else if (cmd === 'cleanup') {
    const state = readState(); const ids = Object.values(state.accounts).map(a => q(a.id));
    if (!ids.length) { console.log('nothing to clean'); return; }
    sql(`DELETE FROM public."User" WHERE id IN (${ids.join(',')}); DELETE FROM auth.users WHERE id IN (${ids.join(',')});`);
    fs.unlinkSync(stateFile); console.log(`removed ${ids.length} account(s)`);
  } else { throw new Error('usage: create|token|login|list|sql|cleanup <stream> …'); }
})().catch(err => { console.error(`error: ${err.message}`); process.exit(1); });
