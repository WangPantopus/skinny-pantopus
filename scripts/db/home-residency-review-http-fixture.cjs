// Production residency router/Joi/service + actual isolated SQL. Synthetic auth
// and notification transport only; never accepts a hosted database or provider.
module.exports = function(container, { summary = false, place = false } = {}) {
  const assert = require('node:assert/strict');
  const { execFileSync } = require('node:child_process');
  const Module = require('node:module');
  const path = require('node:path');
  const root = path.resolve(__dirname, '../..');
  assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
  const id = n => `ddc23600-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const actor = id(1), home = id(100), claims = [id(202), id(203), id(204), id(205)];
  const users = Array.from({ length: 6 }, (_, i) => id(i + 1));
  const q = v => `'${String(v).replaceAll("'", "''")}'`;
  function sql(query) {
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      { input: query, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  }
  let loseReply = false, notificationFailure = false, calls = 0;
  const notifications = [], queryCalls = [], diagnostics = []; let queryFailure = null;
  let propertyResult = { profile: null, source: 'fallback' };
  const db = { rpc: async (name, args) => {
    assert(['get_home_residency_review', 'decide_home_residency_review', ...(summary ? ['update_home_seasonal_item', 'update_home_settings'] : [])].includes(name));
    const params = Object.entries(args).map(([key, value]) => {
      assert.match(key, /^p_[a-z_]+$/); return `${key} => ${value == null ? 'NULL' : q(typeof value === 'object' ? JSON.stringify(value) : value)}`;
    });
    const mutation = ['decide_home_residency_review', 'update_home_seasonal_item', 'update_home_settings'].includes(name);
    if (mutation) calls++;
    const data = JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
    if (mutation && data.ok && loseReply) {
      loseReply = false; throw new Error('Synthetic lost committed reply');
    }
    return { data, error: null };
  } };
  // Supabase query adapter for production reads and isolated summary preference/audit writes.
  db.from = table => {
    assert(['Home', 'HomeOccupancy', 'HomeOwner', 'HomeRolePermission', 'HomePermissionOverride',
      'HomePostcardCode', 'HomeOwnershipClaim', ...(summary ? ['HomeSeasonalChecklistItem', 'HomeIssue', 'HomeBill', 'HomeEmergency', 'HomeDocument', 'HomeAuditLog', 'PropertyIntelligenceCache', 'HomePreference', 'BillBenchmark', 'HomePrivacy'] : [])].includes(table));
    const filters = []; let columns = '*', order = '', limit = '', single = false, count = false, head = false, writes = null, conflict = null;
    const column = name => { assert.match(name, /^[a-z_][a-z0-9_]*$/); return `"${name}"`; };
    const query = {
      select(value, options = {}) {
        count = options.count === 'exact'; head = options.head === true;
        if (table === 'HomeOccupancy' && value.includes('user:user_id')) {
          columns = `user_id, jsonb_build_object('id',user_id,'profile_picture_url',(SELECT profile_picture_url FROM public."User" WHERE id=user_id)) AS "user"`;
        } else columns = value === '*' ? '*' : value.split(',').map(v => column(v.trim())).join(',');
        return query;
      },
      insert(value) { assert(summary && ['HomeAuditLog', 'HomeSeasonalChecklistItem'].includes(table)); writes = Array.isArray(value) ? value : [value]; return query; },
      upsert(value, options) { assert(summary && table === 'HomePreference' && options.onConflict === 'home_id,key'); writes = value; conflict = ['home_id', 'key']; return query; },
      gt(key, value) { filters.push(`${column(key)}>${q(value)}`); return query; },
      gte(key, value) { filters.push(`${column(key)}>=${q(value)}`); return query; },
      not(key, operator, value) { assert(operator === 'is' && value === null); filters.push(`${column(key)} IS NOT NULL`); return query; },
      eq(key, value) { filters.push(`${column(key)}=${q(value)}`); return query; },
      in(key, values) { assert(Array.isArray(values) && values.length); filters.push(`${column(key)} IN (${values.map(q)})`); return query; },
      range(start, end) { assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start); limit = ` LIMIT ${end-start+1} OFFSET ${start}`; return query; },
      order(key, options) { order += `${order ? ',' : ' ORDER BY'} ${column(key)} ${options?.ascending === false ? 'DESC' : 'ASC'}`; return query; },
      limit(value) { assert(Number.isInteger(value) && value > 0); limit = ` LIMIT ${value}`; return query; },
      maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        queryCalls.push(table);
        if (queryFailure?.table === table) { const failure = queryFailure; queryFailure = null;
          if (failure.reject) throw new Error('Synthetic summary database transport failure');
          return { data: null, count: null, error: { message: 'Synthetic summary database failure' } }; }
        if (writes) {
          assert(writes.length && writes.every(row => row.home_id === home));
          const keys = Object.keys(writes[0]);
          const literal = value => value == null ? 'NULL' : q(typeof value === 'object' ? JSON.stringify(value) : value);
          const inserted = JSON.parse(sql(`WITH written AS (INSERT INTO public."${table}" (${keys.map(column)}) VALUES ${writes.map(row => '(' + keys.map(key => literal(row[key])).join(',') + ')').join(',')}${conflict ? ` ON CONFLICT (${conflict.map(column)}) DO UPDATE SET ${keys.filter(key => !conflict.includes(key)).map(key => `${column(key)}=EXCLUDED.${column(key)}`).join(',')}` : ''} RETURNING *) SELECT coalesce(jsonb_agg(to_jsonb(written)),'[]') FROM written;`));
          if (table === 'HomePreference' && loseReply) { loseReply = false; throw new Error('Synthetic lost committed preference reply'); }
          return { data: single ? inserted[0] || null : inserted, error: null };
        }
        const rows = JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM (SELECT ${columns} FROM public."${table}"${filters.length ? ' WHERE ' + filters.join(' AND ') : ''}${order}${limit}) r;`));
        if (single && rows.length > 1) throw new Error('Fixture expected a single IAM record');
        return { data: head ? null : single ? rows[0] || null : rows, ...(count ? { count: rows.length } : {}), error: null };
      }).then(resolve, reject); },
    };
    return query;
  };
  const transport = { createNotification: async value => {
    notifications.push(value);
    if (notificationFailure) { notificationFailure = false; throw new Error('Synthetic unavailable notification transport'); }
  } };
  const load = Module._load;
  const express = require(path.join(root, 'backend/node_modules/express'));
  const scope = require(path.join(root, 'backend/utils/requestSessionScope'));
  Module._load = function(request, parent, isMain) {
    if (parent?.filename.startsWith(path.join(root, 'backend/'))) {
      if (request === '../config/supabaseAdmin') return db;
      if (request === '../services/notificationService') return transport;
      if (request === '../utils/logger') return { info() {}, warn() {}, error(message, details) { diagnostics.push({ message, details }); } };
    }
    if (place && parent?.filename.endsWith('/services/placeIntelligenceService.js')) {
      if (!['../utils/geohash', '../serializers/placeIntelligenceSerializer', './homePrivacyService'].includes(request)) return {};
    }
    if (place && parent?.filename.endsWith('/routes/placeIntelligence.js')) {
      if (request === '../middleware/verifyToken') return (req, _res, next) => { req.user = { id: req.headers['x-fixture-actor'] || actor }; next(); };
      if (request === '../services/homeSystemsService') return {};
    }
    if (parent?.filename.endsWith('/routes/homeIam.js') && ['../services/homeAuthorityService', '../services/homeExternalShareService'].includes(request)) return {};
    if (parent?.filename.endsWith('/routes/homeIam.js') && request === '../middleware/verifyToken') return (req, _res, next) => { req.user = { id: req.headers['x-fixture-actor'] || actor }; next(); };
    if (summary && parent?.filename.endsWith('/routes/home.js') && request === '../services/ai/propertyIntelligenceService') return { getProfile: async () => propertyResult };
    if (parent?.filename.endsWith('/routes/home.js')) {
      if (request === '../middleware/verifyToken') return (req, _res, next) => {
        req.user = { id: req.headers['x-fixture-actor'] || actor };
        req.session = { id: req.headers['x-fixture-session'] || 'local-residency-review' }; next();
      };
      if (request === '../middleware/rateLimiter') return new Proxy({}, { get: () => (_req, _res, next) => next() });
      if (request === '../services/addressValidation') return { AddressVerdictStatus: {} };
      if (request === '../utils/homeDocumentAccess') return { HOME_DOCUMENT_TYPES: ['other'], HOME_DOCUMENT_VISIBILITIES: ['members'] };
      if (!['express', 'joi', 'crypto', '../middleware/validate', '../services/homeResidencyReviewService', '../utils/requestSessionScope', ...(summary ? ['../utils/homePermissions', '../services/homeHealthService', '../services/seasonalChecklistService', '../services/ai/seasonalEngine', '../utils/geohash', '../utils/geo'] : [])].includes(request)) return {};
    }
    return load.call(this, request, parent, isMain);
  };
  const router = require(path.join(root, 'backend/routes/home'));
  const app = express(); app.use(express.json());
  if (place) app.use('/api/homes', require(path.join(root, 'backend/routes/placeIntelligence')));
  app.use('/api/homes', router); app.use('/api/homes', require(path.join(root, 'backend/routes/homeIam')));
  function setup() {
    assert.equal(sql(`SELECT (SELECT count(*) FROM auth.users WHERE id IN (${users.map(q)}))+(SELECT count(*) FROM public."Home" WHERE id=${q(home)});`), '0');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ${users.map((u, i) => `(${q(u)},'residency-http-${i + 1}@example.invalid',now())`).join(',')};
      INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'residency_http_'||right(id::text,2),'Residency fixture','user'
        FROM auth.users WHERE id IN (${users.map(q)});
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
        VALUES(${q(home)},${q(actor)},${q(actor)},'Private residency fixture','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
        VALUES(${q(home)},${q(actor)},'verified',true,'strong');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status,start_at,access_end_at)
        SELECT ${q(home)}::uuid,u,CASE WHEN u=${q(actor)}::uuid THEN 'owner' ELSE 'member' END,
        (CASE WHEN u=${q(actor)}::uuid THEN 'owner' ELSE 'member' END)::public.home_role_base,
        'adult',CASE WHEN u=${q(actor)}::uuid THEN 'verified' ELSE 'pending_doc' END,now()-interval '1 day',now()+interval '2 days'
        FROM unnest(ARRAY[${users.slice(0, 5).map(q)}]::uuid[]) u;
      INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_address,claimed_role)
        VALUES ${claims.map((c, i) => `(${q(c)},${q(home)},${q(users[i + 1])},'Private residency fixture','member')`).join(',')};
      COMMIT;`);
  }
  function cleanup() {
    sql(`BEGIN; DROP TRIGGER IF EXISTS residency_http_receipt_failure ON public."HomeResidencyReviewReceipt";
      DROP FUNCTION IF EXISTS public.residency_http_receipt_failure();
      DELETE FROM public."HomeAuditLog" WHERE home_id=${q(home)};
      DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
      DELETE FROM public."HomeResidencyClaim" WHERE home_id=${q(home)};
      DELETE FROM public."HomeOwner" WHERE home_id=${q(home)}; DELETE FROM public."HomeOccupancy" WHERE home_id=${q(home)};
      DELETE FROM public."Home" WHERE id=${q(home)};
      DELETE FROM public."User" WHERE id IN (${users.map(q)}); DELETE FROM auth.users WHERE id IN (${users.map(q)}); COMMIT;`);
    assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeResidencyReviewReceipt" WHERE home_id=${q(home)})+
      (SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN (${users.map(q)}));`), '0');
  }
  return { app, actor, home, claims, users, id, q, sql, scope, setup, cleanup, notifications,
    queryCalls, diagnostics, failNextQuery: (table, reject = false) => { queryFailure = { table, reject }; },
    setPropertyResult: value => { propertyResult = value; },
    get calls() { return calls; }, loseNextReply: () => { loseReply = true; },
    failNextNotification: () => { notificationFailure = true; }, restoreModules: () => { Module._load = load; } };
};
