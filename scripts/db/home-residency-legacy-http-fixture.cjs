// Isolated R02 HTTP -> production service -> actual local SDK/SQL harness.
// No shared UI fixture or fixed port. The caller must own the DB writer lease.
module.exports = function ({ container, project, cli, output, lease, mode }) {
  const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const { execFileSync } = require('node:child_process');
  const Module = require('node:module'), root = path.resolve(__dirname, '../..');
  assert.equal(lease, '--exclusive-lease'); assert(['review-baseline', 'accepted-review-baseline', 'candidate'].includes(mode));
  assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
  assert.match(project || '', /^\/private\/tmp\/pantopus-home-gig-[a-z0-9_-]+$/);
  assert.equal(cli, '/opt/homebrew/bin/supabase'); assert(path.isAbsolute(output || '') && !output.startsWith(root + '/'));
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  const q = value => "'" + String(value).replaceAll("'", "''") + "'";
  const ident = value => '"' + value.replaceAll('"', '""') + '"';
  const sql = query => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 16 * 1024 * 1024 }).trim();
  const read = query => JSON.parse(sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL statement_timeout='90s';" + query + 'ROLLBACK;'));
  const id = n => `ddc26000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const users = Array.from({ length: 24 }, (_, index) => id(index + 1));
  const homes = Array.from({ length: 10 }, (_, index) => id(index + 100));
  const functions = () => read(`SELECT coalesce(jsonb_agg(jsonb_build_object('oid',p.oid,'name',p.proname,
    'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl,'config',p.proconfig) ORDER BY p.oid),'[]')
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind IN('f','p');`);
  function preservation() {
    const tables = read(`SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','auth','storage','supabase_migrations') AND c.relkind='r';`);
    const rows = tables.map(([schema, table]) => `SELECT ${q(schema)}::text schema_name,${q(table)}::text table_name,count(*) row_count,
      md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' ORDER BY to_jsonb(r)::text),'')) digest FROM ${ident(schema)}.${ident(table)} r`).join(' UNION ALL ');
    return read(`SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(t) ORDER BY schema_name,table_name) FROM (${rows})t),
      'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'definition_hash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
        'owner',p.proowner,'acl',p.proacl,'config',p.proconfig) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind IN('f','p')),
      'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'kind',c.relkind,'owner',c.relowner,'acl',c.relacl,
        'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN('public','auth','storage','supabase_migrations')),
      'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY oid) FROM pg_extension e));`);
  }
  const empty = () => read(`SELECT (SELECT count(*) FROM public."Home" WHERE id::text LIKE 'ddc26000-%')
    +(SELECT count(*) FROM public."User" WHERE id::text LIKE 'ddc26000-%')+(SELECT count(*) FROM auth.users WHERE id::text LIKE 'ddc26000-%');`) === 0;
  assert(empty(), 'Reserved namespace is not empty');
  const before = preservation(), beforeFunctions = functions(); save('preservation-before.json', before); save('functions-before.json', beforeFunctions);
  const roleRows = () => read('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY role_base,permission),\'[]\') FROM public."HomeRolePermission" r;');
  const beforeRoles = roleRows(); save('role-rows-before.json', beforeRoles);
  const prerequisites = ['supabase/migrations/20260911030000_home_member_view_defaults.sql',
    'supabase/migrations/20260911043000_home_residency_submission.sql',
    'supabase/migrations/20260911050000_home_postcard_current_recovery.sql', 'supabase/migrations/20260912010000_home_postcard_verification_recovery.sql'];
  const candidate = 'supabase/migrations/20260912060000_home_residency_legacy_compatibility.sql';
  const sourcePaths = ['scripts/db/home-residency-legacy-http-fixture.cjs', 'scripts/db/test-home-residency-legacy-http.cjs',
    'scripts/db/test-home-residency-legacy-review-baseline.cjs', 'scripts/db/test-home-residency-legacy-concurrency.cjs',
    'scripts/db/test-home-residency-legacy-contracts.cjs',
    'backend/routes/home.js', 'backend/services/homeResidencyLegacyService.js',
    'backend/services/homeResidencySubmissionService.js', 'backend/services/homeResidencyReviewService.js', candidate, ...prerequisites];
  const sourceHashes = () => Object.fromEntries(sourcePaths.map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')]));
  const sourceBefore = sourceHashes(); save('sources-before.json', sourceBefore);
  let config;
  try { config = JSON.parse(execFileSync(cli, ['status', '--workdir', project, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })); }
  catch (_) { throw new Error('Owned SDK configuration unavailable'); }
  assert.equal(config.API_URL, 'http://127.0.0.1:64521');
  const rawFetch = global.fetch;
  global.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'R02 acceptance blocks external fetch'); return rawFetch(input, options);
  };
  const { createClient } = require(path.join(root, 'backend/node_modules/@supabase/supabase-js'));
  const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let server, installed = false, initialized = false, loseReply = null, failRpc = null, failNotices = false, nextRpcHook = null;
  const events = [], notices = [];
  const rpcNames = ['submit_legacy_home_residency', 'get_legacy_home_residency_reviewers',
    'submit_home_residency', 'get_home_residency_submission', 'cancel_home_residency_submission', 'decide_home_residency_review'];
  const db = { auth: client.auth, async rpc(name, args) {
    assert(rpcNames.includes(name)); assert(users.includes(args.p_actor_id)); assert(homes.includes(args.p_home_id));
    if (nextRpcHook?.name === name) { const hook = nextRpcHook; nextRpcHook = null; await hook.run(); }
    if (failRpc === name) { failRpc = null; events.push({ event: 'controlled_rpc_failure', name }); return { data: null, error: { code: 'SYNTHETIC' } }; }
    const result = await client.rpc(name, args);
    events.push({ event: 'actual_sdk_rpc', name, actor_id: args.p_actor_id, home_id: args.p_home_id,
      request_id: args.p_request_id || null, ok: result.data?.ok, state: result.data?.state, code: result.data?.code, error: result.error?.code || null });
    if (loseReply === name && result.data?.ok === true) { loseReply = null; events.push({ event: 'lost_committed_reply', name }); throw new Error('Controlled lost committed reply'); }
    return result;
  }, from() { throw new Error('R02 gateway must use its atomic SQL operation'); } };
  const load = Module._load;
  Module._load = function (name, parent, isMain) {
    if (parent?.filename.startsWith(root + '/backend/')) {
      if (name.endsWith('/config/supabaseAdmin')) return db;
      if (name.endsWith('/utils/logger')) return { info() {}, warn() {}, error() { events.push({ event: 'production_diagnostic' }); } };
      if (name.endsWith('/middleware/verifyToken')) return (req, _res, next) => {
        req.user = { id: req.headers['x-fixture-actor'] || users[1] }; assert(users.includes(req.user.id));
        req.session = { id: 'owned-r02-loopback-session-' + req.user.id }; next();
      };
      if (name.endsWith('/middleware/rateLimiter')) return new Proxy({}, { get: () => (_req, _res, next) => next() });
      // Intercept service-relative imports too. No real notification, push,
      // badge, mail or provider implementation is loaded by this acceptance.
      if (name.endsWith('/services/notificationService') || name === './notificationService') return {
        createBulkNotifications: async values => {
          assert(values.every(value => users.includes(value.userId))); notices.push({ kind: 'reviewer_notice_attempt', values });
          if (failNotices) { failNotices = false; throw new Error('Controlled notice failure'); } return [];
        },
        createNotification: async value => { assert(users.includes(value.userId)); notices.push({ kind: 'review_outcome_attempt', value }); return null; },
      };
      if (name.endsWith('/services/homePostcardService')) return { request() { throw new Error('Admission must not request postage'); } };
      if (parent.filename.endsWith('/routes/home.js')) {
        if (name === '../services/addressValidation') return { AddressVerdictStatus: {} };
        if (name === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
        if (!['express', 'joi', 'crypto', '../utils/parsePostGISPoint', '../middleware/validate', '../utils/homePermissions',
          '../utils/requestSessionScope', '../services/homeResidencyLegacyService', '../services/homeResidencySubmissionService',
          '../services/homeResidencyReviewService'].includes(name)) return {};
      }
    }
    return load.call(this, name, parent, isMain);
  };
  async function start() {
    const express = require(path.join(root, 'backend/node_modules/express'));
    const app = express(); app.use(express.json());
    app.use('/api/homes', (req, res, next) => {
      const matched = /^\/([a-f0-9-]+)\/(claim(?:\/[a-f0-9-]+\/(?:approve|reject))?|residency-submissions(?:\/[a-f0-9-]+(?:\/cancel)?)?)$/.exec(req.path);
      if (!matched || !homes.includes(matched[1])) return res.sendStatus(404); next();
    }, require(path.join(root, 'backend/routes/home')));
    if (mode !== 'review-baseline') {
      for (const table of ['HomeResidencySubmissionCommand', 'HomePostcardRequestCommand', 'HomePostcardVerificationCommand']) {
        assert.equal(read(`SELECT to_jsonb(to_regclass(${q('public."' + table + '"')}) IS NULL);`), true, 'Protocol was adopted or another fixture is active; inspect first');
      }
      assert(!beforeFunctions.some(f => ['submit_legacy_home_residency', 'save_home_residency_admission', 'home_residency_role_family', 'get_legacy_home_residency_reviewers'].includes(f.name)));
      const installPaths = mode === 'candidate' ? [...prerequisites, candidate] : prerequisites;
      sql('BEGIN;' + installPaths.map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n') + "NOTIFY pgrst,'reload schema';COMMIT;");
      installed = true; save('installed-functions.json', functions());
    }
    sql(`BEGIN;INSERT INTO auth.users(id,email,last_sign_in_at) VALUES ${users.map((user, index) => `(${q(user)},${q('r02-http-' + index + '@example.invalid')},now())`)};
      INSERT INTO public."User"(id,email,username,name,date_of_birth) SELECT id,email,'r02_http_'||right(id::text,2),'R02 HTTP fixture',current_date-interval '25 years'
        FROM auth.users WHERE id IN(${users.map(q)});
      INSERT INTO public."Home"(id,created_by_user_id,address,address2,city,state,zipcode) VALUES
        ${homes.map(h => `(${q(h)},${q(users[0])},'Owned R02 HTTP Home','Unit 2','Test','WA','98607')`)};
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner) VALUES
        ${homes.map(h => `(${q(h)},${q(users[0])},'verified',true)`)};COMMIT;`);
    initialized = true; server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    if (installed) {
      let ready = false;
      for (let attempt = 0; attempt < 30 && !ready; attempt++) {
        const probe = await client.rpc('get_home_residency_submission', { p_home_id: homes[0], p_actor_id: users[1], p_request_id: id(900) });
        ready = !probe.error && probe.data?.code === 'RESIDENCY_SUBMISSION_NOT_FOUND';
        if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(ready, 'SDK schema cache did not expose the temporary candidate');
    }
  }
  async function request(route, index = 1, body = {}, method = 'POST') {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method,
      headers: { 'Content-Type': 'application/json', 'x-fixture-actor': users[index] },
      body: method === 'GET' ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const value = await r.json(); events.push({ event: 'http', route, index, method, status: r.status, code: value.code,
      body_hash: method === 'GET' ? null : crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex') });
    return { status: r.status, body: value };
  }
  function snapshot() {
    const tables = ['Home', 'HomeResidencyClaim', 'HomeOccupancy', 'HomeOwner', 'HomePermissionOverride', 'HomeAuditLog', 'HomePostcardCode', 'HomeResidencyReviewReceipt'];
    if (installed) tables.push('HomeResidencySubmissionCommand', 'HomePostcardRequestCommand', 'HomePostcardVerificationCommand');
    return read('SELECT jsonb_build_object(' + tables.map(table => `${q(table)},(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')
      FROM public.${ident(table)} r WHERE ${table === 'Home' ? 'id' : 'home_id'} IN(${homes.map(q)}))`).join(',') + ');');
  }
  async function cleanup() {
    if (server) await new Promise(resolve => server.close(resolve));
    save('observations.json', { mode, events, notices, ...(initialized ? { final: snapshot() } : {}) });
    if (initialized) sql(`BEGIN;DROP TRIGGER IF EXISTS r02_http_audit_failure ON public."HomeAuditLog";
      DELETE FROM public."HomeResidencyReviewReceipt" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."HomeAuditLog" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."HomePermissionOverride" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."HomeResidencyClaim" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."HomePostcardCode" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."HomeOwner" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."HomeOccupancy" WHERE home_id IN(${homes.map(q)});
      DELETE FROM public."Home" WHERE id IN(${homes.map(q)});
      DELETE FROM public."User" WHERE id IN(${users.map(q)});DELETE FROM auth.users WHERE id IN(${users.map(q)});COMMIT;`);
    if (installed) {
      const now = functions(), oldIds = new Set(beforeFunctions.map(f => f.oid));
      const introduced = now.filter(f => !oldIds.has(f.oid));
      assert(introduced.every(f => f.name !== 'r02_http_audit_failure' || !beforeFunctions.some(old => old.name === f.name)));
      const restore = beforeFunctions.filter(f => now.some(current => current.oid === f.oid && current.definition !== f.definition));
      const tables = ['HomePostcardVerificationCommand', 'HomePostcardRequestCommand', 'HomeResidencySubmissionCommand'];
      for (const table of tables) assert.equal(read(`SELECT count(*) FROM public.${ident(table)} WHERE actor_user_id NOT IN(${users.map(q)});`), 0,
        'Unrelated command appeared; do not drop its table');
      const currentRoles = roleRows(), key = row => row.role_base + '/' + row.permission;
      for (const row of beforeRoles) assert.deepEqual(currentRoles.find(current => key(current) === key(row)), row,
        'An original role row changed; do not overwrite it during cleanup');
      const addedRoles = currentRoles.filter(row => !beforeRoles.some(old => key(old) === key(row)));
      assert(addedRoles.every(row => ['admin', 'manager', 'member', 'restricted_member', 'guest'].includes(row.role_base)
        && row.permission === 'home.view' && row.allowed === true), 'Unexpected role row appeared; preserve and investigate');
      sql('BEGIN;' + restore.map(f => f.definition + ';').join('\n')
        + introduced.map(f => 'DROP FUNCTION ' + f.signature + ';').join('\n')
        + tables.map(table => 'DROP TABLE public.' + ident(table) + ';').join('\n')
        + addedRoles.map(row => 'DELETE FROM public."HomeRolePermission" WHERE role_base=' + q(row.role_base)
          + ' AND permission=' + q(row.permission) + ';').join('\n') + "NOTIFY pgrst,'reload schema';COMMIT;");
    }
    Module._load = load; global.fetch = rawFetch;
    const after = preservation(); save('preservation-after.json', after);
    const unchanged = JSON.stringify(after) === JSON.stringify(before);
    save('cleanup.json', { exact_owned_rows_cleaned: empty(), complete_populated_rows_schema_preserved: unchanged,
      preserved_tables: before.rows.length, permanent_migration_adoption: false, server_stopped: true, provider_calls: 0 });
    assert(unchanged && empty(), 'Retained DB changed; preserve evidence and investigate');
    assert.deepEqual(sourceHashes(), sourceBefore, 'Source changed during acceptance');
  }
  return { root, id, homes, users, sql, read, q, save, start, request, snapshot, cleanup, events, notices, sourceBefore,
    loseNextReply(name = 'submit_legacy_home_residency') { assert(rpcNames.includes(name)); loseReply = name; },
    failNextRpc(name) { assert(rpcNames.includes(name)); failRpc = name; },
    beforeNextRpc(name, run) { assert(rpcNames.includes(name) && typeof run === 'function'); nextRpcHook = { name, run }; },
    failNextNotice() { failNotices = true; }, functions };
};
