#!/usr/bin/env node
// Installed native review -> production Express/Joi/service -> real local SDK/SQL.
// Only authentication, public identity and unrelated shell data are synthetic.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const [container, project, cli, output, portText = '18084'] = process.argv.slice(2);
assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const port = Number(portText); assert(port >= 18083 && port <= 18089);
const f = require('../db/home-residency-review-http-fixture.cjs')(container, { dashboard: true });
const { actor, home, claims, users, sql, q } = f;
const provenanceQuery = `SELECT coalesce(jsonb_agg(jsonb_build_object('oid',oid,'definition',pg_get_functiondef(oid),
  'owner',proowner,'acl',proacl,'config',proconfig) ORDER BY oid),'[]') FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('get_home_residency_review','decide_home_residency_review','review_home_residency','home_residency_review_authority');`;
const ledgerQuery = `SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]')::text,'UTF8')),'hex')
  FROM supabase_migrations.schema_migrations m;`;
const before = sql(provenanceQuery), ledger = sql(ledgerQuery);
fs.writeFileSync(path.join(output, 'functions-before.json'), before, { mode: 0o600, flag: 'wx' });
fs.writeFileSync(path.join(output, 'ledger-before.json'), JSON.stringify({ all_rows_columns_sha256: ledger }), { mode: 0o600, flag: 'wx' });
assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgname='residency_http_receipt_failure';"), '0');
assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='residency_http_receipt_failure';"), '0');
const config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
assert.equal(config.API_URL, 'http://127.0.0.1:64521');
const rawFetch = global.fetch;
global.fetch = (input, options) => { const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname)); return rawFetch(input, options); };
const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let initialized = false, server, stopping = false, fault = null, holdNext = false, releaseRead = null;
const events = [], commands = [];
f.useDatabaseClient({ supabaseUrl: client.supabaseUrl, from: table => client.from(table), async rpc(name, args) {
  assert(['get_home_residency_review', 'decide_home_residency_review', 'home_record_context', 'get_home_records', 'home_delete_eligibility', 'list_home_invitations'].includes(name));
  if (name === 'get_home_residency_review' && fault?.kind === 'before') return { data: null, error: { code: 'SYNTHETIC_UNAVAILABLE' } };
  const result = await client.rpc(name, args);
  events.push({ name, ok: result.data?.ok, code: result.data?.code, error: result.error?.code || null });
  if (name === 'get_home_residency_review' && holdNext) {
    holdNext = false;
    await new Promise(resolve => { releaseRead = resolve; });
  }
  if (name === 'get_home_residency_review' && fault?.kind === 'malformed') return { data: { ok: true }, error: null };
  if (name === 'decide_home_residency_review' && result.data?.ok && fault?.kind === 'lost') {
    fault = null; throw Error('Synthetic lost committed decision');
  }
  return result;
} });
const state = () => ({ home, claims, commands, events, held: !!releaseRead,
  authority: sql(`SELECT public.home_residency_review_authority(${q(home)},${q(actor)});`) === 't',
  receipts: JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY created_at),'[]') FROM public."HomeResidencyReviewReceipt" r WHERE home_id=${q(home)};`)),
  current_claims: JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'review_note',review_note) ORDER BY id),'[]') FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};`)),
  memberships: JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'is_active',is_active,'verification_status',verification_status,'role_base',role_base) ORDER BY user_id),'[]') FROM public."HomeOccupancy" WHERE home_id=${q(home)};`)) });
const express = require(path.join(root, 'backend/node_modules/express'));
const app = express(); app.use(express.json());
const token = 'pantopus-synthetic-residency-review-loopback-only', sessionId = 'local-native-residency-review';
const stamp = '2026-09-12T12:00:00Z';
const user = { id: actor, email: 'residency-review-ui@example.invalid', username: 'residency_review_ui_fixture', name: 'Residency Reviewer',
  firstName: 'Residency', lastName: 'Reviewer', accountType: 'personal', account_type: 'personal', role: 'user', verified: true, createdAt: stamp, updatedAt: stamp };
app.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    if (req.path === '/fixture/state') return res.json(state());
    if (req.path === '/fixture/fault') { assert(['before', 'malformed', 'lost', 'clear'].includes(req.body.kind)); fault = req.body.kind === 'clear' ? null : req.body; return res.json({ ok: true }); }
    if (req.path === '/fixture/hold-read') { assert(!releaseRead); holdNext = true; return res.json({ ok: true }); }
    if (req.path === '/fixture/release-read') { releaseRead?.(); releaseRead = null; return res.json({ ok: true }); }
    if (req.path === '/fixture/change') {
      const index = req.body.index ?? 0; assert(Number.isInteger(index) && index >= 0 && index < claims.length);
      switch (req.body.kind) {
        case 'stale': sql(`UPDATE public."HomeResidencyClaim" SET updated_at=clock_timestamp() WHERE id=${q(claims[index])};`); break;
        case 'move-out': sql(`UPDATE public."HomeOccupancy" SET is_active=false,verification_status='moved_out' WHERE home_id=${q(home)} AND user_id=${q(users[index + 1])};`); break;
        case 'resubmit': sql(`UPDATE public."HomeResidencyClaim" SET status='pending',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=clock_timestamp() WHERE id=${q(claims[index])};`); break;
        case 'revoke': sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'members.manage',false) ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false;`); break;
        case 'restore': sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)} AND permission='members.manage';`); break;
        default: assert.fail('Unknown exact fixture change');
      }
      return res.json(state());
    }
    if (req.path === '/fixture/stop') { res.json({ ok: true }); void stop(); return; }
    if (req.path === '/api/users/login') {
      assert.equal(req.body.email, user.email); assert.equal(req.body.password, 'synthetic-loopback-only');
      return res.json({ user, accessToken: token, refreshToken: token + '-refresh', expiresIn: 86400, sessionId, session: { id: sessionId, context: 'interactive' } });
    }
    if (req.headers.authorization !== 'Bearer ' + token) return res.status(401).json({ error: 'Synthetic sign-in required' });
    req.headers['x-fixture-actor'] = actor; req.headers['x-fixture-session'] = sessionId;
    events.push({ method: req.method, path: req.path });
    if (req.method === 'POST' && /\/claim\/[^/]+\/(approve|reject)$/.test(req.path)) commands.push({ path: req.path, body: structuredClone(req.body) });
    if (['/api/users/profile', '/api/users/me'].includes(req.path)) return res.json({ user, ...user });
    if (req.path.startsWith('/api/users/id/')) { const id = req.path.split('/').pop(); assert(users.includes(id)); return res.json({ id, name: 'Applicant ' + id.slice(-1), username: 'residency_http_' + id.slice(-2) }); }
    if (req.path === '/api/hub') return res.json({ user, context: { activeHomeId: home, activePersona: { type: 'personal' } },
      availability: { hasHome: true, hasBusiness: false, hasPayoutMethod: false }, homes: [], businesses: [],
      setup: { steps: [], allDone: true, profileCompleteness: { score: 1, checks: { firstName: true, lastName: true, photo: true, bio: true, skills: true }, missingFields: [] } }, statusItems: [],
      cards: { personal: { unreadChats: 0, earnings: 0, gigsNearby: 0, rating: 0, reviewCount: 0 } }, jumpBackIn: [], activity: [] });
    if (req.path.includes('/ownership-claims')) return res.json({ claims: [] });
    if (req.path === `/api/homes/${home}/owners`) return res.json({ owners: [] });
    if (req.path.endsWith('/unread-count')) return res.json({ count: 0, unread_count: 0, unreadCount: 0 });
    if (req.path === '/api/notifications') return res.json({ notifications: [], unreadCount: 0, pagination: { page: 1, totalPages: 0, total: 0 } });
    if (req.path.includes('/logout')) return res.json({ success: true });
    return next();
  } catch { return res.status(500).json({ error: 'Synthetic fixture could not perform the requested action' }); }
});
app.use(f.app);
async function stop() {
  if (stopping) return; stopping = true; releaseRead?.(); releaseRead = null;
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (initialized) {
    fs.writeFileSync(path.join(output, 'final-state.json'), JSON.stringify(state(), null, 2), { mode: 0o600 });
    fs.writeFileSync(path.join(output, 'diagnostics.json'), JSON.stringify(f.diagnostics, null, 2), { mode: 0o600 });
    f.cleanup();
  }
  assert.equal(sql(provenanceQuery), before); assert.equal(sql(ledgerQuery), ledger);
  fs.writeFileSync(path.join(output, 'cleanup.json'), JSON.stringify({ fixtures_removed: true, exact_functions_properties_preserved: true, complete_ledger_preserved: true }), { mode: 0o600 });
  f.restoreModules(); console.log('PASS: exact native residency review fixture cleanup; function definitions/properties and complete ledger preserved');
}
async function main() {
  try { f.setup(); initialized = true;
    for (const userId of users) sql(`UPDATE public."User" SET name=${q("Applicant " + userId.slice(-1))} WHERE id=${q(userId)};`);
    const probe = await client.rpc('get_home_residency_review', { p_home_id: home, p_claim_id: claims[0], p_actor_id: actor });
    assert(!probe.error && probe.data?.ok === true);
    server = app.listen(port, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const listing = await rawFetch(`http://127.0.0.1:${port}/api/homes/${home}/claims`, { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(listing.status, 200);
    assert.deepEqual((await listing.json()).claims.map(row => row.id).sort(), [...claims].sort());
    console.log('READY: owned native residency review HTTP/SDK/SQL fixture at ' + port);
  } catch { await stop(); throw Error('Owned native residency review fixture failed; inspect private evidence'); }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop().catch(() => { process.exitCode = 1; }));
main().catch(() => { console.error('Native residency review fixture failed; preserve private evidence'); process.exitCode = 1; });
